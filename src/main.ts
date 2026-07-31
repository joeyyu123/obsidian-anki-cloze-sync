import {
  Component,
  MarkdownRenderer,
  Notice,
  Plugin,
  TFile
} from "obsidian";
import { AnkiConnectClient, type AnkiNoteInfo } from "./anki-connect";
import {
  collectMarkdownSyncIds,
  diagnoseMarkdown,
  findCrossFileIdConflicts,
  type MarkdownSyncIds
} from "./diagnostics";
import { diagnoseFrontmatter, resolveNoteFileConfig } from "./frontmatter";
import { protectLatexForAnki } from "./latex";
import { openImageOcclusionCreator } from "./image-occlusion";
import { extractEmbeddedLinks, rewriteEmbeddedMediaForAnki } from "./media";
import { confirmDestructiveAction, SyncPreviewModal } from "./modals";
import {
  addMissingSyncIds,
  ensureFileSyncId,
  parseFlashcards,
  regenerateSyncIds
} from "./parser";
import { AnkiSyncSettingTab } from "./settings";
import {
  CONTENT_HASH_TAG_PREFIX,
  FILE_ID_TAG_PREFIX,
  REMOVED_CARD_TAG,
  canSafelyAttributeLegacyNote,
  contentHashTag,
  createContentHash,
  findStaleNoteIds,
  noteBelongsToFile,
  obsoleteLegacyFileTags
} from "./sync-utils";
import {
  DEFAULT_SETTINGS,
  type AnkiSyncSettings,
  type FileSyncRegistry,
  type NoteFileConfig,
  type ParsedBasicCard,
  type ParsedClozeCard,
  type ParsedFlashcard,
  type ParsedImageOcclusionCard,
  type StoredPluginData,
  type SyncDiagnostic,
  type SyncPreview,
  type SyncResult
} from "./types";

const EMPTY_RESULT = (): SyncResult => ({
  created: 0,
  updated: 0,
  deleted: 0,
  suspended: 0,
  unchanged: 0,
  duplicates: 0,
  total: 0
});

export default class AnkiFlashcardSyncPlugin extends Plugin {
  settings: AnkiSyncSettings = DEFAULT_SETTINGS;
  private syncRegistry: FileSyncRegistry = {};
  private readonly syncTimers = new Map<string, number>();
  private readonly syncingFiles = new Set<TFile>();
  private readonly pendingSyncFiles = new Set<TFile>();
  private readonly deletedDuringSync = new Map<TFile, string>();
  private readonly idsByPath = new Map<string, MarkdownSyncIds>();
  private readonly pendingIdRefreshes = new Map<string, Promise<void>>();
  private readonly infrastructurePromises = new Map<string, Promise<void>>();
  private idIndexPromise?: Promise<void>;
  private registryReconcilePromise?: Promise<void>;
  private vaultSyncPromise?: Promise<void>;
  private saveChain: Promise<void> = Promise.resolve();
  private statusBar?: HTMLElement;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new AnkiSyncSettingTab(this.app, this));
    this.statusBar = this.addStatusBarItem();
    this.statusBar.setText("Anki Sync：就緒");
    void this.ensureIdIndex();
    this.app.workspace.onLayoutReady(() => {
      void this.reconcileRegistryPaths();
    });

    this.addRibbonIcon("refresh-cw", "同步整個 Vault 到 Anki", () => {
      void this.syncVault();
    });

    this.addCommand({
      id: "sync-current-note",
      name: "同步目前筆記到 Anki",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) void this.syncActiveFile(true);
        return true;
      }
    });

    this.addCommand({
      id: "preview-current-note-sync",
      name: "預覽目前筆記的 Anki 同步",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) void this.previewActiveFile();
        return true;
      }
    });

    this.addCommand({
      id: "create-image-occlusion-card",
      name: "新增或編輯影像遮擋卡片",
      editorCallback: (editor) => openImageOcclusionCreator(this.app, editor)
    });

    this.addCommand({
      id: "regenerate-current-note-sync-ids",
      name: "重新產生目前筆記的 Anki 同步 ID",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) void this.regenerateActiveFileIds(file);
        return true;
      }
    });

    this.addCommand({
      id: "sync-entire-vault",
      name: "同步整個 Vault 到 Anki",
      callback: () => void this.syncVault()
    });

    this.addCommand({
      id: "test-anki-connect",
      name: "測試 AnkiConnect 連線",
      callback: () => void this.testConnection()
    });

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        void this.refreshIdIndexForFile(file);
        if (this.syncingFiles.has(file)) {
          this.pendingSyncFiles.add(file);
          return;
        }
        if (!this.settings.autoSync) return;
        this.scheduleSync(file);
      })
    );

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        void this.refreshIdIndexForFile(file);
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        const timer = this.syncTimers.get(file.path);
        if (timer !== undefined) window.clearTimeout(timer);
        this.syncTimers.delete(file.path);
        this.pendingSyncFiles.delete(file);
        this.idsByPath.delete(file.path);
        if (this.syncingFiles.has(file)) {
          this.deletedDuringSync.set(file, file.path);
        } else {
          void this.handleDeletedFile(file.path);
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (!(file instanceof TFile)) return;
        const wasMarkdown = oldPath.toLowerCase().endsWith(".md");
        const isMarkdown = file.extension.toLowerCase() === "md";
        if (!wasMarkdown && !isMarkdown) return;
        const timer = this.syncTimers.get(oldPath);
        if (timer !== undefined) {
          window.clearTimeout(timer);
          this.syncTimers.delete(oldPath);
        }
        if (wasMarkdown && !isMarkdown) {
          this.idsByPath.delete(oldPath);
          this.pendingSyncFiles.delete(file);
          if (this.syncingFiles.has(file)) {
            this.deletedDuringSync.set(file, oldPath);
          } else {
            void this.handleDeletedFile(oldPath);
          }
          return;
        }
        if (!wasMarkdown && isMarkdown) {
          void this.refreshIdIndexForFile(file);
          if (this.settings.autoSync) this.scheduleSync(file);
          return;
        }
        if (timer !== undefined && this.settings.autoSync) this.scheduleSync(file);
        const ids = this.idsByPath.get(oldPath);
        if (ids) {
          this.idsByPath.delete(oldPath);
          this.idsByPath.set(file.path, ids);
        }
        for (const entry of Object.values(this.syncRegistry)) {
          if (entry.path === oldPath) entry.path = file.path;
        }
        void this.savePluginData();
      })
    );
  }

  onunload(): void {
    for (const timer of this.syncTimers.values()) window.clearTimeout(timer);
    this.syncTimers.clear();
  }

  async loadSettings(): Promise<void> {
    const raw = (await this.loadData()) as Partial<StoredPluginData> & Partial<AnkiSyncSettings> | null;
    const storedSettings = raw?.settings ?? raw ?? {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, storedSettings);
    if (!("removedCardAction" in storedSettings)) {
      this.settings.removedCardAction = storedSettings.deleteRemovedCards === false ? "keep" : "suspend";
    }
    this.syncRegistry = raw?.syncRegistry ?? {};
  }

  async saveSettings(): Promise<void> {
    this.infrastructurePromises.clear();
    await this.savePluginData();
  }

  private async savePluginData(): Promise<void> {
    const payload: StoredPluginData = {
      settings: { ...this.settings },
      syncRegistry: Object.fromEntries(
        Object.entries(this.syncRegistry).map(([fileId, entry]) => [
          fileId,
          {
            ...entry,
            noteIds: [...entry.noteIds],
            managedTags: entry.managedTags ? [...entry.managedTags] : undefined
          }
        ])
      )
    };
    const save = this.saveChain.then(() => this.saveData(payload));
    this.saveChain = save.catch(() => undefined);
    await save;
  }

  private scheduleSync(file: TFile): void {
    const scheduledPath = file.path;
    const previousTimer = this.syncTimers.get(scheduledPath);
    if (previousTimer !== undefined) window.clearTimeout(previousTimer);
    const timer = window.setTimeout(() => {
      this.syncTimers.delete(scheduledPath);
      void this.syncFile(file, false).catch(() => undefined);
    }, this.settings.autoSyncDelayMs);
    this.syncTimers.set(scheduledPath, timer);
  }

  private addSyncIdsToCurrentSource(source: string): string {
    if (!resolveNoteFileConfig(source, this.settings).enabled) return source;
    const hasBlockingDiagnostic = [
      ...diagnoseMarkdown(source),
      ...diagnoseFrontmatter(source)
    ].some((item) => item.severity === "error");
    if (hasBlockingDiagnostic) return source;
    const withFileId = ensureFileSyncId(source, () => crypto.randomUUID());
    return addMissingSyncIds(withFileId.markdown, () => crypto.randomUUID()).markdown;
  }

  private async prepareSourceWithSyncIds(file: TFile): Promise<string> {
    const initial = await this.app.vault.read(file);
    if (this.addSyncIdsToCurrentSource(initial) === initial) return initial;

    return this.app.vault.process(file, (current) => this.addSyncIdsToCurrentSource(current));
  }

  private async refreshIdIndexForFile(file: TFile): Promise<void> {
    const path = file.path;
    const refresh = (async () => {
      try {
        const source = await this.app.vault.cachedRead(file);
        if (file.path === path && this.app.vault.getAbstractFileByPath(path) === file) {
          this.idsByPath.set(path, collectMarkdownSyncIds(source));
        }
      } catch {
        // A delete or rename event will remove or relocate the index entry.
      }
    })();
    this.pendingIdRefreshes.set(path, refresh);
    try {
      await refresh;
    } finally {
      if (this.pendingIdRefreshes.get(path) === refresh) {
        this.pendingIdRefreshes.delete(path);
      }
    }
  }

  private async syncActiveFile(showNotice: boolean): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      new Notice("請先開啟一個 Markdown 筆記。");
      return;
    }
    try {
      await this.syncFile(file, showNotice);
    } catch {
      // syncFile already reports manual errors.
    }
  }

  private async previewActiveFile(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") return;
    this.setStatus(`預覽中：${file.basename}`);
    try {
      const preview = await this.createSyncPreview(file);
      new SyncPreviewModal(this.app, preview).open();
      this.setStatus("Anki Sync：預覽完成");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus("Anki Sync：預覽失敗");
      new Notice(`無法產生同步預覽：${message}`, 8000);
    }
  }

  async createSyncPreview(file: TFile): Promise<SyncPreview> {
    const source = await this.app.vault.read(file);
    const config = resolveNoteFileConfig(source, this.settings);
    const diagnostics = [
      ...diagnoseMarkdown(source),
      ...diagnoseFrontmatter(source),
      ...(await this.getCrossFileDiagnostics(file.path, source))
    ];
    const cards = parseFlashcards(source);
    const base: SyncPreview = {
      filePath: file.path,
      enabled: config.enabled,
      deckName: config.deckName,
      tags: config.tags,
      created: 0,
      updated: 0,
      unchanged: 0,
      removed: 0,
      total: cards.length,
      diagnostics,
      cards: []
    };
    if (!config.enabled || diagnostics.some((item) => item.severity === "error")) return base;

    const client = new AnkiConnectClient(this.settings.ankiConnectUrl);
    const fileSyncId = collectMarkdownSyncIds(source).fileId;
    const legacyFileTag = this.buildLegacyFileTag(file);
    const [fileNoteIds, legacyNoteIds] = await Promise.all([
      fileSyncId ? client.findByFileId(fileSyncId) : Promise.resolve([]),
      client.findByLegacyFileTag(legacyFileTag)
    ]);
    const ownershipCandidates = await client.notesInfo(
      [...new Set([...fileNoteIds, ...legacyNoteIds])]
    );
    const safeFileNoteIds = ownershipCandidates
      .filter(
        (info) =>
          fileNoteIds.includes(info.noteId) &&
          noteBelongsToFile(info, fileSyncId, legacyFileTag)
      )
      .map((info) => info.noteId);
    if (safeFileNoteIds.length !== fileNoteIds.length) {
      base.diagnostics.push({
        severity: "error",
        message: "部分 Anki notes 帶有多個或不相符的來源檔案 ID；已停止將它們列為目前筆記。"
      });
      return base;
    }
    const legacyInfos = ownershipCandidates.filter((info) => legacyNoteIds.includes(info.noteId));
    const activeSyncIds = new Set(cards.flatMap((card) => card.id ? [card.id] : []));
    const registeredNoteIds = new Set(
      fileSyncId ? this.syncRegistry[fileSyncId]?.noteIds ?? [] : []
    );
    const safeLegacyNoteIds = legacyInfos
      .filter((info) =>
        canSafelyAttributeLegacyNote(
          info,
          fileSyncId,
          legacyFileTag,
          activeSyncIds,
          registeredNoteIds
        )
      )
      .map((info) => info.noteId);
    const knownNoteIds = new Set([...safeFileNoteIds, ...safeLegacyNoteIds]);
    const activeNoteIds = new Set<number>();
    const noteIdsBySyncId = await client.findBySyncIds(
      cards.flatMap((card) => card.id ? [card.id] : [])
    );
    const allCardNoteIds = [...new Set([...noteIdsBySyncId.values()].flat())];
    const noteInfoById = new Map(
      (await client.notesInfo(allCardNoteIds)).map((info) => [info.noteId, info])
    );

    for (const card of cards) {
      const modelName = this.modelForCard(card);
      const fields = await this.buildFields(file, card, null);
      const frontHtml = card.kind === "cloze"
        ? fields.Text ?? ""
        : card.kind === "image-occlusion"
          ? this.buildImageOcclusionPreview(file, card, fields, false)
          : fields.Front ?? "";
      const backHtml = card.kind === "cloze"
        ? fields["Back Extra"] ?? ""
        : card.kind === "image-occlusion"
          ? this.buildImageOcclusionPreview(file, card, fields, true)
          : fields.Back ?? "";
      if (!card.id) {
        base.created += 1;
        base.cards.push({ kind: card.kind, line: card.startLine + 1, status: "create", frontHtml, backHtml });
        continue;
      }
      const hashTag = await this.buildContentHashTag(config, modelName, fields);
      const noteIds = noteIdsBySyncId.get(card.id) ?? [];
      if (noteIds.length === 0) {
        base.created += 1;
        base.cards.push({ kind: card.kind, line: card.startLine + 1, status: "create", frontHtml, backHtml });
        continue;
      }
      const noteInfos = noteIds
        .map((noteId) => noteInfoById.get(noteId))
        .filter((info): info is AnkiNoteInfo => info !== undefined);
      const ownedInfos = noteInfos.filter(
        (info) => noteBelongsToFile(info, fileSyncId, legacyFileTag)
      );
      if (noteInfos.length > 0 && ownedInfos.length !== noteInfos.length) {
        base.diagnostics.push({
          severity: "error",
          line: card.startLine + 1,
          message: `卡片 ID ${card.id} 已屬於另一份來源筆記。`
        });
        continue;
      }
      const noteInfo = this.choosePrimaryNoteInfo(ownedInfos, modelName);
      const primaryId = noteInfo?.noteId ?? (noteIds[0] as number);
      activeNoteIds.add(primaryId);
      const desiredTags = this.buildTags(file, card.id, fileSyncId, config.tags, hashTag);
      if (
        noteInfo?.modelName === modelName &&
        noteInfo.tags.includes(hashTag) &&
        desiredTags.every((tag) => noteInfo.tags.includes(tag)) &&
        obsoleteLegacyFileTags(noteInfo.tags, legacyFileTag).length === 0
      ) {
        base.unchanged += 1;
        base.cards.push({ kind: card.kind, line: card.startLine + 1, status: "unchanged", frontHtml, backHtml });
      } else {
        base.updated += 1;
        base.cards.push({ kind: card.kind, line: card.startLine + 1, status: "update", frontHtml, backHtml });
      }
    }
    base.removed = findStaleNoteIds(knownNoteIds, activeNoteIds).length;
    return base;
  }

  async syncFile(file: TFile, showNotice: boolean): Promise<SyncResult> {
    if (this.syncingFiles.has(file)) {
      this.pendingSyncFiles.add(file);
      return EMPTY_RESULT();
    }
    this.syncingFiles.add(file);
    this.setStatus(`同步中：${file.basename}`);

    try {
      let source = await this.app.vault.read(file);
      let config = resolveNoteFileConfig(source, this.settings);
      if (!config.enabled) {
        this.setStatus("Anki Sync：已由 frontmatter 排除");
        if (showNotice) new Notice("此筆記已設定 anki-sync: false，不會同步。");
        return EMPTY_RESULT();
      }

      const diagnostics = [
        ...diagnoseMarkdown(source),
        ...diagnoseFrontmatter(source),
        ...(await this.getCrossFileDiagnostics(file.path, source))
      ];
      const errors = diagnostics.filter((item) => item.severity === "error");
      if (errors.length > 0) {
        throw new Error(errors[0]?.message ?? "筆記內容無法安全同步。");
      }

      source = await this.prepareSourceWithSyncIds(file);
      config = resolveNoteFileConfig(source, this.settings);
      if (!config.enabled) {
        this.setStatus("Anki Sync：已由 frontmatter 排除");
        if (showNotice) new Notice("此筆記已設定 anki-sync: false，不會同步。");
        return EMPTY_RESULT();
      }
      const preparedDiagnostics = [
        ...diagnoseMarkdown(source),
        ...diagnoseFrontmatter(source),
        ...(await this.getCrossFileDiagnostics(file.path, source))
      ];
      const preparedErrors = preparedDiagnostics.filter((item) => item.severity === "error");
      if (preparedErrors.length > 0) {
        throw new Error(preparedErrors[0]?.message ?? "筆記內容無法安全同步。");
      }
      this.idsByPath.set(file.path, collectMarkdownSyncIds(source));

      const cards = parseFlashcards(source);
      const fileSyncId = collectMarkdownSyncIds(source).fileId;
      if (cards.length === 0 && !fileSyncId) {
        this.setStatus("Anki Sync：沒有閃卡");
        if (showNotice) new Notice("目前筆記沒有找到填空、問答或影像遮擋卡。");
        return EMPTY_RESULT();
      }

      const client = new AnkiConnectClient(this.settings.ankiConnectUrl);
      const legacyFileTag = this.buildLegacyFileTag(file);
      const [fileNoteIds, legacyNoteIds] = await Promise.all([
        fileSyncId ? client.findByFileId(fileSyncId) : Promise.resolve([]),
        client.findByLegacyFileTag(legacyFileTag)
      ]);
      const ownershipCandidates = await client.notesInfo(
        [...new Set([...fileNoteIds, ...legacyNoteIds])]
      );
      const safeFileNoteIds = ownershipCandidates
        .filter(
          (info) =>
            fileNoteIds.includes(info.noteId) &&
            noteBelongsToFile(info, fileSyncId, legacyFileTag)
        )
        .map((info) => info.noteId);
      if (safeFileNoteIds.length !== fileNoteIds.length) {
        throw new Error("部分 Anki notes 帶有多個或不相符的來源檔案 ID；已停止同步以避免跨筆記修改。");
      }
      const legacyInfos = ownershipCandidates.filter((info) => legacyNoteIds.includes(info.noteId));
      const previousEntry = fileSyncId ? this.syncRegistry[fileSyncId] : undefined;
      const activeSyncIds = new Set(cards.flatMap((card) => card.id ? [card.id] : []));
      const registeredNoteIds = new Set(previousEntry?.noteIds ?? []);
      const safeLegacyNoteIds = legacyInfos
        .filter((info) =>
          canSafelyAttributeLegacyNote(
            info,
            fileSyncId,
            legacyFileTag,
            activeSyncIds,
            registeredNoteIds
          )
        )
        .map((info) => info.noteId);
      const knownFileNoteIds = new Set([...safeFileNoteIds, ...safeLegacyNoteIds]);
      const activeNoteIds = new Set<number>();
      const obsoleteManagedTags = (previousEntry?.managedTags ?? []).filter(
        (tag) => !config.tags.includes(tag)
      );
      const noteIdsBySyncId = await client.findBySyncIds(
        cards.flatMap((card) => card.id ? [card.id] : [])
      );
      const allCardNoteIds = [...new Set([...noteIdsBySyncId.values()].flat())];
      const noteInfoById = new Map(
        (await client.notesInfo(allCardNoteIds)).map((info) => [info.noteId, info])
      );
      for (const card of cards) {
        if (!card.id) continue;
        const candidateInfos = (noteIdsBySyncId.get(card.id) ?? [])
          .map((noteId) => noteInfoById.get(noteId))
          .filter((info): info is AnkiNoteInfo => info !== undefined);
        if (
          candidateInfos.some(
            (info) => !noteBelongsToFile(info, fileSyncId, legacyFileTag)
          )
        ) {
          throw new Error(`卡片 ID ${card.id} 已被另一份來源筆記使用；已停止同步以避免部分更新。`);
        }
      }
      if (obsoleteManagedTags.length > 0) {
        await client.removeTags([...knownFileNoteIds], obsoleteManagedTags);
      }
      await this.ensureInfrastructure(client, config, cards);

      const result = EMPTY_RESULT();
      result.total = cards.length;
      const preparedCards: Array<{
        card: ParsedFlashcard & { id: string };
        fields: Record<string, string>;
        modelName: string;
        hashTag: string;
        tags: string[];
        index: number;
      }> = [];
      for (let index = 0; index < cards.length; index += 1) {
        const card = cards[index] as ParsedFlashcard;
        if (!card.id) continue;
        this.setStatus(`準備同步：${file.basename}（${index + 1}/${cards.length}）`);
        const fields = await this.buildFields(file, card, client);
        const modelName = this.modelForCard(card);
        const hashTag = await this.buildContentHashTag(config, modelName, fields);
        const tags = this.buildTags(file, card.id, fileSyncId, config.tags, hashTag);
        preparedCards.push({
          card: card as ParsedFlashcard & { id: string },
          fields,
          modelName,
          hashTag,
          tags,
          index
        });
      }

      for (const prepared of preparedCards) {
        const { card, fields, modelName, hashTag, tags, index } = prepared;
        this.setStatus(`同步中：${file.basename}（${index + 1}/${cards.length}）`);
        const noteIds = noteIdsBySyncId.get(card.id) ?? [];

        if (noteIds.length === 0) {
          const noteId = await client.addNote({
            deckName: config.deckName,
            modelName,
            fields,
            tags,
            options: { allowDuplicate: true }
          });
          activeNoteIds.add(noteId);
          knownFileNoteIds.add(noteId);
          result.created += 1;
          continue;
        }

        const noteInfos = noteIds
          .map((noteId) => noteInfoById.get(noteId))
          .filter((info): info is AnkiNoteInfo => info !== undefined);
        const ownedInfos = noteInfos.filter(
          (info) => noteBelongsToFile(info, fileSyncId, legacyFileTag)
        );
        if (noteInfos.length > 0 && ownedInfos.length !== noteInfos.length) {
          throw new Error(`卡片 ID ${card.id} 已被另一份來源筆記使用；已停止同步以避免覆寫。`);
        }
        const ownedNoteIds = ownedInfos.map((info) => info.noteId);
        const noteInfo = this.choosePrimaryNoteInfo(ownedInfos, modelName);
        const primaryNoteId = noteInfo?.noteId ?? (ownedNoteIds[0] ?? noteIds[0] as number);
        if (noteInfo && noteInfo.modelName !== modelName) {
          const replacementId = await client.addNote({
            deckName: config.deckName,
            modelName,
            fields,
            tags,
            options: { allowDuplicate: true }
          });
          await client.deleteNotes(ownedNoteIds);
          for (const oldNoteId of ownedNoteIds) knownFileNoteIds.delete(oldNoteId);
          knownFileNoteIds.add(replacementId);
          activeNoteIds.add(replacementId);
          result.updated += 1;
          result.duplicates += Math.max(0, ownedNoteIds.length - 1);
          continue;
        }

        if (noteInfo) await this.restoreIfPluginSuspended(client, noteInfo);
        const hasCurrentHash = noteInfo?.tags.includes(hashTag) ?? false;
        const hasAllTags = tags.every((tag) => noteInfo?.tags.includes(tag));
        const oldLegacyTags = noteInfo
          ? obsoleteLegacyFileTags(noteInfo.tags, legacyFileTag)
          : [];
        if (hasCurrentHash && hasAllTags && oldLegacyTags.length === 0) {
          result.unchanged += 1;
        } else {
          await client.updateNote(primaryNoteId, fields);
          await client.changeDeck(noteInfo?.cards ?? [], config.deckName);
          const oldHashTags = noteInfo?.tags.filter((tag) => tag.startsWith(CONTENT_HASH_TAG_PREFIX)) ?? [];
          await client.removeTags([primaryNoteId], [...oldHashTags, ...oldLegacyTags]);
          await client.addTags([primaryNoteId], tags);
          result.updated += 1;
        }
        activeNoteIds.add(primaryNoteId);
        knownFileNoteIds.add(primaryNoteId);
        if (ownedNoteIds.length > 1) {
          result.duplicates += ownedNoteIds.length - 1;
          for (const duplicateId of ownedNoteIds) {
            if (duplicateId !== primaryNoteId) knownFileNoteIds.add(duplicateId);
          }
        }
      }

      const staleNoteIds = findStaleNoteIds(knownFileNoteIds, activeNoteIds);
      await this.handleRemovedNotes(client, staleNoteIds, result, showNotice);

      if (fileSyncId) {
        const remainingIds = result.deleted > 0
          ? [...knownFileNoteIds].filter((id) => !staleNoteIds.includes(id))
          : [...knownFileNoteIds];
        this.syncRegistry[fileSyncId] = {
          path: file.path,
          noteIds: remainingIds,
          updatedAt: Date.now(),
          managedTags: config.tags,
          deckName: config.deckName
        };
        await this.savePluginData();
      }

      this.setStatus(
        `Anki Sync：新增 ${result.created}、更新 ${result.updated}、不變 ${result.unchanged}、暫停 ${result.suspended}、刪除 ${result.deleted}`
      );
      if (showNotice) {
        new Notice(
          `Anki 同步完成：新增 ${result.created}、更新 ${result.updated}、不變 ${result.unchanged}、暫停 ${result.suspended}、刪除 ${result.deleted}`,
          8000
        );
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus("Anki Sync：失敗");
      if (showNotice) new Notice(`Anki 同步失敗：${message}`, 8000);
      console.error("Anki Flashcard Sync", error);
      throw error;
    } finally {
      this.syncingFiles.delete(file);
      const deletedPath = this.deletedDuringSync.get(file);
      if (deletedPath) {
        this.deletedDuringSync.delete(file);
        await this.handleDeletedFile(deletedPath);
        if (file.path !== deletedPath) await this.handleDeletedFile(file.path);
      } else if (
        this.pendingSyncFiles.delete(file) &&
        this.app.vault.getAbstractFileByPath(file.path) === file
      ) {
        this.scheduleSync(file);
      }
    }
  }

  private async handleRemovedNotes(
    client: AnkiConnectClient,
    noteIds: number[],
    result: SyncResult,
    mayAskForDelete: boolean
  ): Promise<void> {
    if (noteIds.length === 0 || this.settings.removedCardAction === "keep") return;
    if (this.settings.removedCardAction === "delete" && mayAskForDelete) {
      const confirmed = await confirmDestructiveAction(
        this.app,
        "永久刪除 Anki 卡片？",
        `將永久刪除 ${noteIds.length} 則 Anki note 及其複習紀錄。這個動作無法由外掛復原。`,
        "永久刪除"
      );
      if (confirmed) {
        await client.deleteNotes(noteIds);
        result.deleted += noteIds.length;
        return;
      }
    }
    const infos = await client.notesInfo(noteIds);
    const pendingInfos = infos.filter((info) => !info.tags.includes(REMOVED_CARD_TAG));
    const pendingNoteIds = pendingInfos.map((info) => info.noteId);
    await client.addTags(pendingNoteIds, [REMOVED_CARD_TAG]);
    await client.suspendCards(pendingInfos.flatMap((info) => info.cards));
    result.suspended += pendingNoteIds.length;
  }

  private async restoreIfPluginSuspended(
    client: AnkiConnectClient,
    noteInfo: AnkiNoteInfo
  ): Promise<void> {
    if (!noteInfo.tags.includes(REMOVED_CARD_TAG)) return;
    await client.removeTags([noteInfo.noteId], [REMOVED_CARD_TAG]);
    await client.unsuspendCards(noteInfo.cards);
  }

  private async buildFields(
    file: TFile,
    card: ParsedFlashcard,
    client: AnkiConnectClient | null
  ): Promise<Record<string, string>> {
    if (card.kind === "cloze") return this.buildClozeFields(file, card, client);
    if (card.kind === "image-occlusion") return this.buildImageOcclusionFields(file, card, client);
    return this.buildBasicFields(file, card, client);
  }

  private async buildClozeFields(
    file: TFile,
    card: ParsedClozeCard,
    client: AnkiConnectClient | null
  ): Promise<Record<string, string>> {
    const html = await this.renderMarkdown(file, card.markdown, client);
    return {
      Text: html,
      "Back Extra": `<div>來源：${escapeHtml(file.path)}</div>${this.buildSourceLink(file)}`
    };
  }

  private async buildBasicFields(
    file: TFile,
    card: ParsedBasicCard,
    client: AnkiConnectClient | null
  ): Promise<Record<string, string>> {
    const [front, back] = await Promise.all([
      this.renderMarkdown(file, card.questionMarkdown, client),
      this.renderMarkdown(file, card.answerMarkdown, client)
    ]);
    return { Front: front, Back: `${back}${this.buildSourceLink(file)}` };
  }

  private async buildImageOcclusionFields(
    file: TFile,
    card: ParsedImageOcclusionCard,
    client: AnkiConnectClient | null
  ): Promise<Record<string, string>> {
    const [renderedImage, answer] = await Promise.all([
      this.renderMarkdown(file, card.imageMarkdown, client),
      card.answerMarkdown ? this.renderMarkdown(file, card.answerMarkdown, client) : Promise.resolve("")
    ]);
    const probe = document.createElement("div");
    probe.innerHTML = renderedImage;
    const image = probe.querySelector("img");
    if (!image) {
      throw new Error(`第 ${card.startLine + 1} 行的 IO 題型沒有可用的圖片。`);
    }
    image.removeAttribute("loading");
    const masks = card.masks.map((mask, index) =>
      `<span class="image-occlusion-mask" data-order="${index + 1}" style="left:${mask.x}%;top:${mask.y}%;width:${mask.width}%;height:${mask.height}%;" aria-label="影像遮擋區域 ${index + 1}"></span>`
    ).join("");
    return {
      Image: image.outerHTML,
      Mask: masks,
      Answer: answer,
      "Back Extra": this.buildSourceLink(file)
    };
  }

  private buildImageOcclusionPreview(
    file: TFile,
    card: ParsedImageOcclusionCard,
    fields: Record<string, string>,
    revealed: boolean
  ): string {
    const imageContainer = document.createElement("div");
    imageContainer.innerHTML = fields.Image ?? "";
    const embeddedLink = extractEmbeddedLinks(card.imageMarkdown)[0];
    const embeddedFile = embeddedLink
      ? this.app.metadataCache.getFirstLinkpathDest(embeddedLink, file.path)
      : null;
    const image = imageContainer.querySelector("img");
    if (image && embeddedFile instanceof TFile) {
      image.setAttribute("src", this.app.vault.getResourcePath(embeddedFile));
    }
    const maskContainer = document.createElement("div");
    maskContainer.innerHTML = fields.Mask ?? "";
    if (revealed) {
      for (const mask of Array.from(maskContainer.querySelectorAll(".image-occlusion-mask"))) {
        mask.classList.add("image-occlusion-mask--revealed");
      }
    }
    const answer = revealed && fields.Answer
      ? `<div class="standard-answer-content">${fields.Answer}</div>`
      : "";
    const source = revealed ? fields["Back Extra"] ?? "" : "";
    return `<div class="image-occlusion-stage">${imageContainer.innerHTML}${maskContainer.innerHTML}</div>${answer}${source}`;
  }

  private async renderMarkdown(
    file: TFile,
    markdown: string,
    client: AnkiConnectClient | null
  ): Promise<string> {
    const component = new Component();
    component.load();
    const container = document.createElement("div");
    const latex = protectLatexForAnki(markdown);
    try {
      await MarkdownRenderer.render(this.app, latex.markdown, container, file.path, component);
      if (this.settings.syncMedia) {
        const rewritten = await rewriteEmbeddedMediaForAnki(
          this.app,
          file,
          markdown,
          container,
          client
        );
        return latex.restore(rewritten.html);
      }
      return latex.restore(container.innerHTML);
    } finally {
      component.unload();
    }
  }

  private modelForCard(card: ParsedFlashcard): string {
    if (card.kind === "cloze") return this.settings.modelName;
    if (card.kind === "image-occlusion") return this.settings.imageOcclusionModelName;
    return card.kind === "plain" ? this.settings.plainBasicModelName : this.settings.basicModelName;
  }

  private choosePrimaryNoteInfo(infos: AnkiNoteInfo[], modelName: string): AnkiNoteInfo | undefined {
    return infos.find((info) => info.modelName === modelName && !info.tags.includes(REMOVED_CARD_TAG))
      ?? infos.find((info) => info.modelName === modelName)
      ?? infos.find((info) => !info.tags.includes(REMOVED_CARD_TAG))
      ?? infos[0];
  }

  private async ensureInfrastructure(
    client: AnkiConnectClient,
    config: NoteFileConfig,
    cards: ParsedFlashcard[]
  ): Promise<void> {
    if (cards.length === 0) return;
    const endpoint = this.settings.ankiConnectUrl;
    await this.ensureInfrastructureOnce(`deck:${endpoint}:${config.deckName}`, () =>
      client.ensureDeck(config.deckName)
    );
    if (cards.some((card) => card.kind === "cloze")) {
      await this.ensureInfrastructureOnce(`cloze:${endpoint}:${this.settings.modelName}`, () =>
        client.ensureClozeModel(this.settings.modelName)
      );
    }
    if (cards.some((card) => card.kind === "basic")) {
      await this.ensureInfrastructureOnce(`basic:${endpoint}:${this.settings.basicModelName}`, () =>
        client.ensureBasicModel(this.settings.basicModelName)
      );
    }
    if (cards.some((card) => card.kind === "plain")) {
      await this.ensureInfrastructureOnce(`plain:${endpoint}:${this.settings.plainBasicModelName}`, () =>
        client.ensurePlainBasicModel(this.settings.plainBasicModelName)
      );
    }
    if (cards.some((card) => card.kind === "image-occlusion")) {
      await this.ensureInfrastructureOnce(
        `image-occlusion:${endpoint}:${this.settings.imageOcclusionModelName}`,
        () => client.ensureImageOcclusionModel(this.settings.imageOcclusionModelName)
      );
    }
  }

  private async ensureInfrastructureOnce(key: string, action: () => Promise<void>): Promise<void> {
    let pending = this.infrastructurePromises.get(key);
    if (!pending) {
      pending = action().catch((error) => {
        this.infrastructurePromises.delete(key);
        throw error;
      });
      this.infrastructurePromises.set(key, pending);
    }
    await pending;
  }

  private async buildContentHashTag(
    config: NoteFileConfig,
    modelName: string,
    fields: Record<string, string>
  ): Promise<string> {
    return contentHashTag(await createContentHash({ version: 2, deck: config.deckName, modelName, fields, tags: config.tags }));
  }

  private buildSourceLink(file: TFile): string {
    const vault = encodeURIComponent(this.app.vault.getName());
    const path = encodeURIComponent(file.path);
    const sourceUrl = `obsidian://open?vault=${vault}&file=${path}`;
    return `<div class="obsidian-source"><a href="${sourceUrl}">在 Obsidian 開啟「${escapeHtml(file.basename)}」</a></div>`;
  }

  private buildTags(
    file: TFile,
    syncId: string,
    fileSyncId: string | null,
    configuredTags: string[],
    hashTag: string
  ): string[] {
    const fileIdTag = fileSyncId ? [`${FILE_ID_TAG_PREFIX}${fileSyncId}`] : [];
    return [...new Set([
      ...configuredTags,
      `obsidian_sync_id_${syncId}`,
      this.buildLegacyFileTag(file),
      ...fileIdTag,
      hashTag
    ])];
  }

  private buildLegacyFileTag(file: TFile): string {
    return this.buildLegacyFileTagFromPath(file.path);
  }

  private buildLegacyFileTagFromPath(path: string): string {
    const safePath = path.replace(/[^a-zA-Z0-9_]/g, "_");
    return `obsidian_file_${safePath}`;
  }

  private async syncVault(): Promise<void> {
    if (this.vaultSyncPromise) {
      new Notice("Vault 同步已在進行中。");
      return this.vaultSyncPromise;
    }
    const sync = this.performVaultSync();
    this.vaultSyncPromise = sync;
    try {
      await sync;
    } finally {
      if (this.vaultSyncPromise === sync) this.vaultSyncPromise = undefined;
    }
  }

  private async performVaultSync(): Promise<void> {
    await this.reconcileRegistryPaths();
    const files = this.app.vault.getMarkdownFiles();
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let suspended = 0;
    let deleted = 0;
    let failed = 0;
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index] as TFile;
      this.setStatus(`Vault 同步：${index + 1}/${files.length}（${file.basename}）`);
      try {
        const result = await this.syncFile(file, false);
        created += result.created;
        updated += result.updated;
        unchanged += result.unchanged;
        suspended += result.suspended;
        deleted += result.deleted;
      } catch {
        failed += 1;
      }
    }
    new Notice(
      `Vault 同步完成：新增 ${created}、更新 ${updated}、不變 ${unchanged}、暫停 ${suspended}、刪除 ${deleted}、失敗 ${failed}`,
      10000
    );
  }

  private async regenerateActiveFileIds(file: TFile): Promise<void> {
    const confirmed = await confirmDestructiveAction(
      this.app,
      "重新產生同步 ID？",
      "這會讓目前筆記的卡片在下次同步時建立為新的 Anki notes。只有在複製筆記或收到 ID 衝突警告時才應使用。",
      "重新產生"
    );
    if (!confirmed) return;
    let replaced = 0;
    const updated = await this.app.vault.process(file, (source) => {
      const regenerated = regenerateSyncIds(source, () => crypto.randomUUID());
      const withFileId = ensureFileSyncId(regenerated.markdown, () => crypto.randomUUID());
      const withCardIds = addMissingSyncIds(withFileId.markdown, () => crypto.randomUUID());
      replaced = regenerated.replaced + withCardIds.added + (withFileId.added ? 1 : 0);
      return withCardIds.markdown;
    });
    this.idsByPath.set(file.path, collectMarkdownSyncIds(updated));
    new Notice(`已重新產生 ${replaced} 個同步 ID。`);
  }

  private async handleDeletedFile(path: string): Promise<void> {
    const entries = Object.entries(this.syncRegistry).filter(([, entry]) => entry.path === path);
    if (entries.length === 0) return;
    const noteIds = [...new Set(entries.flatMap(([, entry]) => entry.noteIds))];
    try {
      const client = new AnkiConnectClient(this.settings.ankiConnectUrl);
      if (this.settings.removedCardAction === "keep") {
        new Notice(`已保留來自「${path}」的 ${noteIds.length} 則 Anki notes。`);
      } else {
        const infos = await client.notesInfo(noteIds);
        const legacyFileTag = this.buildLegacyFileTagFromPath(path);
        const ownedInfos = infos.filter((info) =>
          entries.some(
            ([fileId, entry]) =>
              entry.noteIds.includes(info.noteId) &&
              noteBelongsToFile(info, fileId, legacyFileTag)
          )
        );
        const existingNoteIds = ownedInfos.map((info) => info.noteId);
        if (this.settings.removedCardAction === "delete" && existingNoteIds.length > 0) {
          const confirmed = await confirmDestructiveAction(
            this.app,
            "來源筆記已刪除",
            `「${path}」已刪除。是否永久刪除其 ${existingNoteIds.length} 則 Anki notes 與複習紀錄？取消時會改為暫停。`,
            "永久刪除"
          );
          if (confirmed) {
            await client.deleteNotes(existingNoteIds);
          } else {
            await client.addTags(existingNoteIds, [REMOVED_CARD_TAG]);
            await client.suspendCards(ownedInfos.flatMap((info) => info.cards));
          }
        } else if (existingNoteIds.length > 0) {
          await client.addTags(existingNoteIds, [REMOVED_CARD_TAG]);
          await client.suspendCards(ownedInfos.flatMap((info) => info.cards));
          new Notice(`已暫停來自已刪除筆記「${path}」的 ${existingNoteIds.length} 則 Anki notes。`);
        }
      }
      for (const [fileId] of entries) delete this.syncRegistry[fileId];
      await this.savePluginData();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`無法處理已刪除筆記的 Anki 卡片：${message}`, 8000);
    }
  }

  private async ensureIdIndex(): Promise<void> {
    if (this.idIndexPromise) return this.idIndexPromise;
    this.idIndexPromise = (async () => {
      const files = this.app.vault.getMarkdownFiles();
      const sources = await Promise.all(files.map(async (file) => ({
        path: file.path,
        source: await this.app.vault.cachedRead(file)
      })));
      this.idsByPath.clear();
      for (const item of sources) {
        this.idsByPath.set(item.path, collectMarkdownSyncIds(item.source));
      }
    })();
    return this.idIndexPromise;
  }

  private async reconcileRegistryPaths(): Promise<void> {
    if (this.registryReconcilePromise) return this.registryReconcilePromise;
    this.registryReconcilePromise = this.performRegistryReconciliation();
    try {
      await this.registryReconcilePromise;
    } finally {
      this.registryReconcilePromise = undefined;
    }
  }

  private async performRegistryReconciliation(): Promise<void> {
    await this.ensureIdIndex();
    const pathsByFileId = new Map<string, string[]>();
    for (const [path, ids] of this.idsByPath.entries()) {
      if (!ids.fileId) continue;
      const paths = pathsByFileId.get(ids.fileId) ?? [];
      paths.push(path);
      pathsByFileId.set(ids.fileId, paths);
    }

    const missingPaths = new Set<string>();
    let changed = false;
    for (const [fileId, entry] of Object.entries(this.syncRegistry)) {
      const currentPaths = pathsByFileId.get(fileId) ?? [];
      if (currentPaths.length > 1) {
        continue;
      }
      const currentPath = currentPaths[0];
      if (currentPath) {
        if (entry.path !== currentPath) {
          entry.path = currentPath;
          changed = true;
        }
      } else {
        missingPaths.add(entry.path);
      }
    }
    if (changed) await this.savePluginData();
    for (const path of missingPaths) await this.handleDeletedFile(path);
  }

  private async getCrossFileDiagnostics(path: string, source: string): Promise<SyncDiagnostic[]> {
    await this.ensureIdIndex();
    await Promise.all(this.pendingIdRefreshes.values());
    const current = collectMarkdownSyncIds(source);
    const others = [...this.idsByPath.entries()].map(([otherPath, ids]) => ({ path: otherPath, ids }));
    return findCrossFileIdConflicts(path, current, others);
  }

  private async testConnection(): Promise<void> {
    try {
      const client = new AnkiConnectClient(this.settings.ankiConnectUrl);
      const version = await client.invoke<number>("version");
      new Notice(`AnkiConnect 連線成功（API ${version}）。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(message, 8000);
    }
  }

  private setStatus(text: string): void {
    this.statusBar?.setText(text);
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

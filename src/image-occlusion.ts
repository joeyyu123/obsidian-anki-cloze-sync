import { App, Editor, FuzzySuggestModal, Modal, Notice, Setting, TFile } from "obsidian";
import {
  buildImageOcclusionCardMarkdown,
  findImageOcclusionCardAtLine,
  moveImageOcclusionMask,
  resizeImageOcclusionMask,
  roundImageOcclusionCoordinate,
  serializeImageOcclusionMask,
  type ImageOcclusionResizeMode
} from "./image-occlusion-utils";
import { extractEmbeddedLinks } from "./media";
import type { ImageOcclusionMask } from "./types";

const IMAGE_EXTENSIONS = new Set(["avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "webp"]);

function insertCard(editor: Editor, markdown: string): void {
  if (editor.somethingSelected()) {
    editor.replaceSelection(markdown);
    return;
  }

  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const before = line.slice(0, cursor.ch);
  const after = line.slice(cursor.ch);
  const prefix = before.trim() ? "\n\n" : cursor.line > 0 ? "\n" : "";
  const suffix = after.trim() ? "\n\n" : "\n";
  editor.replaceSelection(`${prefix}${markdown}${suffix}`);
}

class ImageFileSuggestModal extends FuzzySuggestModal<TFile> {
  constructor(app: App, private readonly onChoose: (file: TFile) => void) {
    super(app);
    this.setPlaceholder("選擇要製作遮擋題的圖片…");
  }

  getItems(): TFile[] {
    return this.app.vault.getFiles().filter((file) => IMAGE_EXTENSIONS.has(file.extension.toLowerCase()));
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onChoose(file);
  }
}

class ImageOcclusionEditorModal extends Modal {
  private readonly masks: ImageOcclusionMask[];
  private draftMask: ImageOcclusionMask | null = null;
  private answer: string;
  private stage?: HTMLDivElement;
  private draftOverlay?: HTMLDivElement;
  private coordinateLabel?: HTMLElement;
  private maskList?: HTMLDivElement;
  private viewportResizeObserver?: ResizeObserver;
  private committedOverlays: HTMLElement[] = [];
  private startPoint: { x: number; y: number } | null = null;
  private maskInteraction: {
    index: number;
    mode: "move" | ImageOcclusionResizeMode;
    origin: { x: number; y: number };
    mask: ImageOcclusionMask;
    target: HTMLElement;
    pointerId: number;
  } | null = null;

  constructor(
    app: App,
    private readonly file: TFile,
    private readonly onSubmit: (masks: ImageOcclusionMask[], answer: string) => void,
    private readonly initial?: {
      masks: ImageOcclusionMask[];
      answer: string;
      editing: boolean;
    }
  ) {
    super(app);
    this.masks = initial?.masks.map((mask) => ({ ...mask })) ?? [];
    this.answer = initial?.answer ?? "";
  }

  onOpen(): void {
    const { contentEl } = this;
    this.modalEl.addClass("anki-image-occlusion-modal");
    contentEl.addClass("anki-image-occlusion-editor");

    const heading = contentEl.createDiv({ cls: "anki-image-occlusion-heading" });
    const titleGroup = heading.createDiv();
    titleGroup.createSpan({
      text: this.initial?.editing ? "VISUAL RECALL / EDIT" : "VISUAL RECALL / NEW",
      cls: "anki-image-occlusion-kicker"
    });
    titleGroup.createEl("h2", {
      text: this.initial?.editing ? "編輯多區域遮擋" : "建立多區域遮擋"
    });
    heading.createSpan({ text: this.file.name, cls: "anki-image-occlusion-filename" });

    contentEl.createEl("p", {
      text: "拖曳空白處新增遮罩；拖曳既有遮罩可移動，拖曳四角可縮放。下方清單可調整揭示順序或移除。",
      cls: "anki-image-occlusion-instruction"
    });

    const viewport = contentEl.createDiv({ cls: "anki-image-occlusion-viewport" });
    const stage = viewport.createDiv({ cls: "anki-image-occlusion-editor-stage" });
    this.stage = stage;
    const image = stage.createEl("img", {
      attr: {
        src: this.app.vault.getResourcePath(this.file),
        alt: this.file.basename,
        draggable: "false"
      }
    });
    this.draftOverlay = stage.createDiv({ cls: "anki-image-occlusion-editor-mask is-draft" });
    this.draftOverlay.setAttr("aria-hidden", "true");

    let imageRatio: number | null = null;
    const fitStageToViewport = (): void => {
      if (!imageRatio) return;
      const styles = window.getComputedStyle(viewport);
      const horizontalPadding =
        Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
      const verticalPadding =
        Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
      const availableWidth = viewport.clientWidth - horizontalPadding;
      const configuredMaxHeight = Number.parseFloat(styles.maxHeight);
      const availableHeight =
        (Number.isFinite(configuredMaxHeight) ? configuredMaxHeight : viewport.clientHeight) -
        verticalPadding;
      if (availableWidth <= 0 || availableHeight <= 0) return;
      stage.style.width = `${Math.min(availableWidth, availableHeight * imageRatio)}px`;
    };

    const activateStage = (): void => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        imageRatio = image.naturalWidth / image.naturalHeight;
        stage.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
        fitStageToViewport();
        if (!this.viewportResizeObserver) {
          this.viewportResizeObserver = new ResizeObserver(fitStageToViewport);
          this.viewportResizeObserver.observe(viewport);
        }
      }
      stage.addClass("is-ready");
    };
    image.addEventListener("load", activateStage);
    image.addEventListener("error", () => new Notice("無法載入這張圖片，請確認檔案仍存在。"));
    if (image.complete && image.naturalWidth > 0) activateStage();
    stage.addEventListener("pointerdown", (event) => this.beginDrawing(event, stage));
    stage.addEventListener("pointermove", (event) => this.continuePointerInteraction(event, stage));
    stage.addEventListener("pointerup", (event) => this.finishPointerInteraction(event, stage));
    stage.addEventListener("pointercancel", () => this.cancelPointerInteraction());

    const dataStrip = contentEl.createDiv({ cls: "anki-image-occlusion-data-strip" });
    dataStrip.createSpan({ text: "Reveal queue" });
    this.coordinateLabel = dataStrip.createEl("code", { text: "尚未框選" });
    this.maskList = contentEl.createDiv({ cls: "anki-image-occlusion-mask-list" });
    this.renderCommittedMasks();
    this.renderMaskList();

    new Setting(contentEl)
      .setClass("anki-image-occlusion-answer")
      .setName("補充答案（選填）")
      .setDesc("所有遮罩依序移除後顯示；可再加上整張圖的名稱、解釋或提示。")
      .addTextArea((text) =>
        text
          .setPlaceholder("例如：左心室")
          .setValue(this.answer)
          .onChange((value) => {
            this.answer = value;
          })
      );

    const actions = new Setting(contentEl).setClass("anki-image-occlusion-actions");
    actions.addButton((button) =>
      button.setButtonText("清除全部").onClick(() => this.resetMasks())
    );
    actions.addButton((button) =>
      button.setButtonText("取消").onClick(() => this.close())
    );
    actions.addButton((button) =>
      button
        .setButtonText(this.initial?.editing ? "儲存遮擋卡" : "新增多區域遮擋卡")
        .setCta()
        .onClick(() => {
          if (this.masks.length === 0) {
            new Notice("請先在圖片上框選至少一個遮擋區域。");
            return;
          }
          this.onSubmit([...this.masks], this.answer);
          this.close();
        })
    );
  }

  private pointInStage(event: PointerEvent, stage: HTMLElement): { x: number; y: number } {
    const bounds = stage.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100)),
      y: Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100))
    };
  }

  private beginDrawing(event: PointerEvent, stage: HTMLElement): void {
    if (
      event.button !== 0 ||
      event.target !== stage ||
      this.maskInteraction ||
      !stage.hasClass("is-ready")
    ) {
      return;
    }
    event.preventDefault();
    stage.setPointerCapture(event.pointerId);
    this.startPoint = this.pointInStage(event, stage);
    this.draftMask = null;
    stage.addClass("is-drawing");
    this.updateOverlay({ x: this.startPoint.x, y: this.startPoint.y, width: 0, height: 0 });
  }

  private continuePointerInteraction(event: PointerEvent, stage: HTMLElement): void {
    if (this.maskInteraction?.pointerId === event.pointerId) {
      this.updateMaskInteraction(this.pointInStage(event, stage));
      return;
    }
    if (this.startPoint && stage.hasPointerCapture(event.pointerId)) {
      this.updateDraftMask(this.pointInStage(event, stage));
    }
  }

  private finishPointerInteraction(event: PointerEvent, stage: HTMLElement): void {
    if (this.maskInteraction?.pointerId === event.pointerId) {
      this.updateMaskInteraction(this.pointInStage(event, stage));
      this.finishMaskInteraction();
      return;
    }
    if (!this.startPoint) return;
    this.updateDraftMask(this.pointInStage(event, stage));
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    stage.removeClass("is-drawing");
    this.startPoint = null;
    if (!this.draftMask || this.draftMask.width < 1 || this.draftMask.height < 1) {
      this.cancelDraft();
      new Notice("遮擋區域太小，請拖曳一個較大的矩形。");
      return;
    }
    this.masks.push(this.draftMask);
    this.draftMask = null;
    this.draftOverlay?.removeClass("is-visible");
    this.renderCommittedMasks();
    this.renderMaskList();
  }

  private cancelPointerInteraction(): void {
    if (this.maskInteraction) {
      const { index, mask } = this.maskInteraction;
      this.masks[index] = mask;
      this.finishMaskInteraction();
      return;
    }
    this.startPoint = null;
    this.cancelDraft();
  }

  private beginMaskInteraction(
    event: PointerEvent,
    index: number,
    mode: "move" | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se",
    target: HTMLElement
  ): void {
    if (event.button !== 0 || !this.stage || this.startPoint || this.maskInteraction) return;
    const mask = this.masks[index];
    if (!mask) return;
    event.preventDefault();
    event.stopPropagation();
    target.setPointerCapture(event.pointerId);
    this.maskInteraction = {
      index,
      mode,
      origin: this.pointInStage(event, this.stage),
      mask: { ...mask },
      target,
      pointerId: event.pointerId
    };
    this.committedOverlays[index]?.addClass("is-active");
    this.coordinateLabel?.setText(
      `${mode === "move" ? "移動" : "縮放"} #${index + 1} · ${serializeImageOcclusionMask(mask)}`
    );
  }

  private updateMaskInteraction(point: { x: number; y: number }): void {
    const interaction = this.maskInteraction;
    if (!interaction) return;
    const deltaX = point.x - interaction.origin.x;
    const deltaY = point.y - interaction.origin.y;
    const next = interaction.mode === "move"
      ? moveImageOcclusionMask(interaction.mask, deltaX, deltaY)
      : resizeImageOcclusionMask(interaction.mask, deltaX, deltaY, interaction.mode);
    this.masks[interaction.index] = next;
    const overlay = this.committedOverlays[interaction.index];
    if (overlay) this.applyMaskPosition(overlay, next);
    this.coordinateLabel?.setText(
      `${interaction.mode === "move" ? "移動" : "縮放"} #${interaction.index + 1} · ${serializeImageOcclusionMask(next)}`
    );
  }

  private finishMaskInteraction(): void {
    const interaction = this.maskInteraction;
    if (!interaction) return;
    if (interaction.target.hasPointerCapture(interaction.pointerId)) {
      interaction.target.releasePointerCapture(interaction.pointerId);
    }
    const current = this.masks[interaction.index];
    if (current) {
      this.masks[interaction.index] = {
        x: roundImageOcclusionCoordinate(current.x),
        y: roundImageOcclusionCoordinate(current.y),
        width: roundImageOcclusionCoordinate(current.width),
        height: roundImageOcclusionCoordinate(current.height)
      };
    }
    this.maskInteraction = null;
    this.renderCommittedMasks();
    this.renderMaskList();
  }

  private updateDraftMask(point: { x: number; y: number }): void {
    if (!this.startPoint) return;
    this.draftMask = {
      x: Math.min(this.startPoint.x, point.x),
      y: Math.min(this.startPoint.y, point.y),
      width: Math.abs(point.x - this.startPoint.x),
      height: Math.abs(point.y - this.startPoint.y)
    };
    this.updateOverlay(this.draftMask);
    if (this.coordinateLabel) {
      this.coordinateLabel.setText(
        `新增 #${this.masks.length + 1} · ${serializeImageOcclusionMask(this.draftMask)}`
      );
    }
  }

  private updateOverlay(mask: ImageOcclusionMask): void {
    if (!this.draftOverlay) return;
    this.applyMaskPosition(this.draftOverlay, mask);
    this.draftOverlay.toggleClass("is-visible", mask.width > 0 && mask.height > 0);
  }

  private applyMaskPosition(element: HTMLElement, mask: ImageOcclusionMask): void {
    element.style.left = `${mask.x}%`;
    element.style.top = `${mask.y}%`;
    element.style.width = `${mask.width}%`;
    element.style.height = `${mask.height}%`;
  }

  private cancelDraft(): void {
    this.draftMask = null;
    this.startPoint = null;
    this.draftOverlay?.removeClass("is-visible");
    this.updateMaskCount();
  }

  private removeMask(index: number): void {
    this.masks.splice(index, 1);
    this.renderCommittedMasks();
    this.renderMaskList();
  }

  private moveMaskInQueue(index: number, direction: -1 | 1): void {
    const nextIndex = index + direction;
    const mask = this.masks[index];
    if (!mask || nextIndex < 0 || nextIndex >= this.masks.length) return;
    this.masks.splice(index, 1);
    this.masks.splice(nextIndex, 0, mask);
    this.renderCommittedMasks();
    this.renderMaskList();
  }

  private renderCommittedMasks(): void {
    for (const overlay of this.committedOverlays) overlay.remove();
    this.committedOverlays = [];
    if (!this.stage || !this.draftOverlay) return;

    this.masks.forEach((mask, index) => {
      const overlay = this.stage?.createDiv({
        cls: "anki-image-occlusion-editor-mask is-visible is-committed",
        attr: {
          role: "button",
          tabindex: "0",
          "aria-label": `第 ${index + 1} 個遮罩；拖曳可移動`
        }
      });
      if (!overlay) return;
      this.applyMaskPosition(overlay, mask);
      overlay.createSpan({
        text: String(index + 1),
        cls: "anki-image-occlusion-editor-mask-number"
      });
      const handles = [
        ["nw", "左上"],
        ["ne", "右上"],
        ["sw", "左下"],
        ["se", "右下"]
      ] as const;
      for (const [corner, label] of handles) {
        const handle = overlay.createDiv({
          cls: `anki-image-occlusion-resize-handle is-${corner}`,
          attr: {
            role: "button",
            "aria-label": `從${label}角縮放第 ${index + 1} 個遮罩`
          }
        });
        handle.addEventListener("pointerdown", (event) => {
          this.beginMaskInteraction(event, index, `resize-${corner}`, handle);
        });
      }
      overlay.addEventListener("pointerdown", (event) => {
        this.beginMaskInteraction(event, index, "move", overlay);
      });
      this.stage?.insertBefore(overlay, this.draftOverlay ?? null);
      this.committedOverlays.push(overlay);
    });
    this.updateMaskCount();
  }

  private renderMaskList(): void {
    if (!this.maskList) return;
    this.maskList.empty();
    if (this.masks.length === 0) {
      this.maskList.createEl("p", { text: "拖曳圖片以加入第一個遮罩。" });
      this.updateMaskCount();
      return;
    }
    this.masks.forEach((mask, index) => {
      const item = this.maskList?.createDiv({ cls: "anki-image-occlusion-mask-item" });
      if (!item) return;
      item.createEl("strong", { text: String(index + 1).padStart(2, "0") });
      item.createEl("code", { text: serializeImageOcclusionMask(mask) });
      const controls = item.createDiv({ cls: "anki-image-occlusion-mask-controls" });
      const moveEarlier = controls.createEl("button", {
        text: "↑",
        attr: {
          type: "button",
          "aria-label": `將第 ${index + 1} 個遮罩提前揭示`
        }
      });
      moveEarlier.disabled = index === 0;
      moveEarlier.addEventListener("click", () => this.moveMaskInQueue(index, -1));
      const moveLater = controls.createEl("button", {
        text: "↓",
        attr: {
          type: "button",
          "aria-label": `將第 ${index + 1} 個遮罩延後揭示`
        }
      });
      moveLater.disabled = index === this.masks.length - 1;
      moveLater.addEventListener("click", () => this.moveMaskInQueue(index, 1));
      controls.createEl("button", {
        text: "移除",
        attr: { type: "button", "aria-label": `移除第 ${index + 1} 個遮罩` }
      }).addEventListener("click", () => this.removeMask(index));
    });
    this.updateMaskCount();
  }

  private updateMaskCount(): void {
    this.coordinateLabel?.setText(
      this.masks.length === 0 ? "尚未框選" : `${this.masks.length} 個遮罩 · 依編號揭示`
    );
  }

  private resetMasks(): void {
    this.masks.splice(0, this.masks.length);
    this.cancelDraft();
    this.renderCommittedMasks();
    this.renderMaskList();
  }

  onClose(): void {
    this.viewportResizeObserver?.disconnect();
    this.viewportResizeObserver = undefined;
    this.contentEl.empty();
  }
}

export function openImageOcclusionCreator(app: App, editor: Editor): void {
  const source = editor.getValue();
  const existingCard = findImageOcclusionCardAtLine(source, editor.getCursor().line);
  if (existingCard) {
    const imageLink = extractEmbeddedLinks(existingCard.imageMarkdown)[0];
    const imageFile = imageLink
      ? app.metadataCache.getFirstLinkpathDest(
        imageLink,
        app.workspace.getActiveFile()?.path ?? ""
      )
      : null;
    if (!(imageFile instanceof TFile) || !IMAGE_EXTENSIONS.has(imageFile.extension.toLowerCase())) {
      new Notice("無法找到這張遮擋卡使用的圖片；請先修正 IO 圖片連結。");
      return;
    }
    new ImageOcclusionEditorModal(
      app,
      imageFile,
      (masks, answer) => {
        const markdown = buildImageOcclusionCardMarkdown(
          existingCard.imageMarkdown,
          masks,
          answer,
          existingCard.id
        );
        const lastLine = existingCard.idLine ?? existingCard.endLine;
        const hasFollowingLine = lastLine < editor.lastLine();
        editor.replaceRange(
          hasFollowingLine ? `${markdown}\n` : markdown,
          { line: existingCard.startLine, ch: 0 },
          hasFollowingLine
            ? { line: lastLine + 1, ch: 0 }
            : { line: lastLine, ch: editor.getLine(lastLine).length }
        );
        const markdownLines = markdown.split("\n");
        const finalLine = markdownLines[markdownLines.length - 1] ?? "";
        editor.setCursor({
          line: existingCard.startLine + markdownLines.length - 1,
          ch: finalLine.length
        });
        new Notice(`已更新包含 ${masks.length} 個區域的影像遮擋卡。`);
      },
      {
        masks: existingCard.masks,
        answer: existingCard.answerMarkdown,
        editing: true
      }
    ).open();
    return;
  }

  const selection = editor.getSelection().trim();
  const selectedLink = extractEmbeddedLinks(selection)[0];
  const selectedFile = selectedLink
    ? app.metadataCache.getFirstLinkpathDest(selectedLink, app.workspace.getActiveFile()?.path ?? "")
    : null;

  const openEditor = (file: TFile): void => {
    if (!IMAGE_EXTENSIONS.has(file.extension.toLowerCase())) {
      new Notice("影像遮擋目前只支援圖片檔。");
      return;
    }
    new ImageOcclusionEditorModal(app, file, (masks, answer) => {
      insertCard(
        editor,
        buildImageOcclusionCardMarkdown(`![[${file.path}]]`, masks, answer)
      );
      new Notice(`已新增包含 ${masks.length} 個區域的影像遮擋卡。`);
    }).open();
  };

  if (selectedFile instanceof TFile && IMAGE_EXTENSIONS.has(selectedFile.extension.toLowerCase())) {
    openEditor(selectedFile);
    return;
  }

  new ImageFileSuggestModal(app, openEditor).open();
}

export interface AnkiSyncSettings {
  ankiConnectUrl: string;
  deckName: string;
  modelName: string;
  basicModelName: string;
  plainBasicModelName: string;
  choiceModelName: string;
  imageOcclusionModelName: string;
  removedCardAction: RemovedCardAction;
  autoSync: boolean;
  autoSyncDelayMs: number;
  additionalTags: string;
  syncMedia: boolean;
}

export type RemovedCardAction = "keep" | "suspend" | "delete";

export const DEFAULT_SETTINGS: AnkiSyncSettings = {
  ankiConnectUrl: "http://127.0.0.1:8765",
  deckName: "Obsidian",
  modelName: "Obsidian Cloze",
  basicModelName: "Obsidian Basic",
  plainBasicModelName: "Obsidian Q&A",
  choiceModelName: "Obsidian Choice",
  imageOcclusionModelName: "Obsidian Image Occlusion",
  removedCardAction: "suspend",
  autoSync: true,
  autoSyncDelayMs: 1500,
  additionalTags: "obsidian",
  syncMedia: true
};

export interface NoteFileConfig {
  enabled: boolean;
  deckName: string;
  tags: string[];
}

export interface FileSyncRegistryEntry {
  path: string;
  noteIds: number[];
  updatedAt: number;
  managedTags?: string[];
  deckName?: string;
}

export type FileSyncRegistry = Record<string, FileSyncRegistryEntry>;

export interface StoredPluginData {
  settings: AnkiSyncSettings;
  syncRegistry: FileSyncRegistry;
}

export interface ParsedClozeCard {
  kind: "cloze";
  id: string | null;
  markdown: string;
  startLine: number;
  endLine: number;
  idLine: number | null;
}

export interface ParsedBasicCard {
  kind: "basic" | "plain";
  id: string | null;
  questionMarkdown: string;
  answerMarkdown: string;
  startLine: number;
  endLine: number;
  idLine: number | null;
}

export interface ChoiceOption {
  markdown: string;
  correct: boolean;
}

export interface ParsedChoiceCard {
  kind: "choice";
  mode: "single" | "multiple";
  id: string | null;
  questionMarkdown: string;
  options: ChoiceOption[];
  explanationMarkdown: string;
  startLine: number;
  endLine: number;
  idLine: number | null;
}

export interface ImageOcclusionMask {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ParsedImageOcclusionCard {
  kind: "image-occlusion";
  id: string | null;
  imageMarkdown: string;
  masks: ImageOcclusionMask[];
  answerMarkdown: string;
  startLine: number;
  endLine: number;
  idLine: number | null;
}

export type ParsedFlashcard =
  | ParsedClozeCard
  | ParsedBasicCard
  | ParsedChoiceCard
  | ParsedImageOcclusionCard;

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  suspended: number;
  unchanged: number;
  duplicates: number;
  total: number;
}

export interface SyncDiagnostic {
  severity: "error" | "warning";
  message: string;
  line?: number;
}

export interface SyncPreview {
  filePath: string;
  enabled: boolean;
  deckName: string;
  tags: string[];
  created: number;
  updated: number;
  unchanged: number;
  removed: number;
  total: number;
  diagnostics: SyncDiagnostic[];
  cards: SyncCardPreview[];
}

export interface SyncCardPreview {
  kind: ParsedFlashcard["kind"];
  line: number;
  status: "create" | "update" | "unchanged";
  frontHtml: string;
  backHtml: string;
}

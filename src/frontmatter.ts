import { getFrontMatterInfo, parseYaml } from "obsidian";
import { resolveNoteFileConfigFromData } from "./note-config";
import type { AnkiSyncSettings, NoteFileConfig, SyncDiagnostic } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function diagnoseFrontmatter(markdown: string): SyncDiagnostic[] {
  const info = getFrontMatterInfo(markdown);
  if (!info.exists) return [];
  try {
    const parsed: unknown = parseYaml(info.frontmatter);
    if (parsed !== null && !isRecord(parsed)) {
      return [{ severity: "error", line: 1, message: "Frontmatter 必須是 YAML 鍵值物件。" }];
    }
    return [];
  } catch (error) {
    const detail = error instanceof Error ? `：${error.message}` : "";
    return [{ severity: "error", line: 1, message: `Frontmatter YAML 無法解析${detail}` }];
  }
}

export function resolveNoteFileConfig(
  markdown: string,
  settings: AnkiSyncSettings
): NoteFileConfig {
  const info = getFrontMatterInfo(markdown);
  let frontmatter: Record<string, unknown> = {};
  if (info.exists) {
    try {
      const parsed: unknown = parseYaml(info.frontmatter);
      if (isRecord(parsed)) {
        frontmatter = parsed;
      }
    } catch {
      // Diagnostics reports malformed frontmatter; defaults remain safe here.
    }
  }

  return resolveNoteFileConfigFromData(frontmatter, settings);
}

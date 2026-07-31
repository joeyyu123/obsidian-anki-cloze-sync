import type { AnkiSyncSettings, NoteFileConfig } from "./types";

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  if (["false", "no", "off", "0"].includes(value.toLowerCase())) return false;
  if (["true", "yes", "on", "1"].includes(value.toLowerCase())) return true;
  return fallback;
}

function toTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((tag) => toTags(tag));
  if (typeof value !== "string") return [];
  return value
    .split(/[\s,]+/)
    .map((tag) => tag.replace(/^#/, "").trim())
    .filter(Boolean);
}

export function resolveNoteFileConfigFromData(
  frontmatter: Record<string, unknown>,
  settings: AnkiSyncSettings
): NoteFileConfig {
  const deckValue = frontmatter["anki-deck"];
  const deckName = typeof deckValue === "string" && deckValue.trim()
    ? deckValue.trim()
    : settings.deckName;
  const settingTags = toTags(settings.additionalTags);
  const noteTags = toTags(frontmatter["anki-tags"]);
  const obsidianTags = toTags(frontmatter.tags);

  return {
    enabled: toBoolean(frontmatter["anki-sync"], true),
    deckName,
    tags: [...new Set([...settingTags, ...obsidianTags, ...noteTags])]
  };
}

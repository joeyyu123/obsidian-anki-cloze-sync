export function findStaleNoteIds(
  knownNoteIds: Iterable<number>,
  activeNoteIds: Iterable<number>
): number[] {
  const active = new Set(activeNoteIds);
  return [...new Set(knownNoteIds)].filter((noteId) => !active.has(noteId));
}

export const CONTENT_HASH_TAG_PREFIX = "obsidian_content_";
export const REMOVED_CARD_TAG = "obsidian_sync_removed";
export const FILE_ID_TAG_PREFIX = "obsidian_file_id_";
export const LEGACY_FILE_TAG_PREFIX = "obsidian_file_";
export const SYNC_ID_TAG_PREFIX = "obsidian_sync_id_";

export interface TaggedNote {
  noteId: number;
  tags: string[];
}

export function mergeNoteIdsBySyncId(
  syncIds: Iterable<string>,
  queriedNoteIds: ReadonlyMap<string, readonly number[]>,
  ownedNotes: Iterable<TaggedNote>
): Map<string, number[]> {
  const desiredIds = new Set(syncIds);
  const result = new Map<string, number[]>();

  for (const syncId of desiredIds) {
    result.set(syncId, [...new Set(queriedNoteIds.get(syncId) ?? [])]);
  }

  for (const note of ownedNotes) {
    for (const tag of note.tags) {
      if (!tag.startsWith(SYNC_ID_TAG_PREFIX)) continue;
      const syncId = tag.slice(SYNC_ID_TAG_PREFIX.length);
      if (!desiredIds.has(syncId)) continue;
      const noteIds = result.get(syncId) ?? [];
      if (!noteIds.includes(note.noteId)) noteIds.push(note.noteId);
      result.set(syncId, noteIds);
    }
  }

  return result;
}

export function noteBelongsToFile(
  note: TaggedNote,
  fileSyncId: string | null,
  legacyFileTag: string
): boolean {
  const fileIdTags = note.tags.filter((tag) => tag.startsWith(FILE_ID_TAG_PREFIX));
  if (fileIdTags.length > 0) {
    return (
      fileSyncId !== null &&
      fileIdTags.length === 1 &&
      fileIdTags[0] === `${FILE_ID_TAG_PREFIX}${fileSyncId}`
    );
  }
  return note.tags.includes(legacyFileTag);
}

export function obsoleteLegacyFileTags(tags: string[], currentLegacyTag: string): string[] {
  return tags.filter(
    (tag) =>
      tag.startsWith(LEGACY_FILE_TAG_PREFIX) &&
      !tag.startsWith(FILE_ID_TAG_PREFIX) &&
      tag !== currentLegacyTag
  );
}

export function canSafelyAttributeLegacyNote(
  note: TaggedNote,
  fileSyncId: string | null,
  legacyFileTag: string,
  activeSyncIds: ReadonlySet<string>,
  registeredNoteIds: ReadonlySet<number>
): boolean {
  const fileIdTags = note.tags.filter((tag) => tag.startsWith(FILE_ID_TAG_PREFIX));
  if (fileIdTags.length > 0) {
    return (
      fileSyncId !== null &&
      fileIdTags.length === 1 &&
      fileIdTags[0] === `${FILE_ID_TAG_PREFIX}${fileSyncId}`
    );
  }
  if (!note.tags.includes(legacyFileTag)) return false;
  if (registeredNoteIds.has(note.noteId)) return true;
  return note.tags.some(
    (tag) =>
      tag.startsWith(SYNC_ID_TAG_PREFIX) &&
      activeSyncIds.has(tag.slice(SYNC_ID_TAG_PREFIX.length))
  );
}

export async function createContentHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return createBinaryHash(bytes);
}

export async function createBinaryHash(value: ArrayBuffer | ArrayBufferView): Promise<string> {
  const source = value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

export function contentHashTag(hash: string): string {
  return `${CONTENT_HASH_TAG_PREFIX}${hash}`;
}

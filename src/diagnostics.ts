import {
  IMAGE_OCCLUSION_MASK_PATTERN,
  IMAGE_OCCLUSION_PATTERN,
  parseImageOcclusionCards,
  parseFlashcards,
  scanSyncIdMarkers
} from "./parser";
import type { SyncDiagnostic } from "./types";

export interface MarkdownSyncIds {
  fileId: string | null;
  cardIds: string[];
}

export function collectMarkdownSyncIds(markdown: string): MarkdownSyncIds {
  const markers = scanSyncIdMarkers(markdown);
  const fileId = markers.fileIds[0]?.id ?? null;
  const cardIds = markers.cardIds.map((marker) => marker.id);
  return { fileId, cardIds };
}

export function diagnoseMarkdown(markdown: string): SyncDiagnostic[] {
  const diagnostics: SyncDiagnostic[] = [];
  const lines = markdown.split("\n");
  const ids = collectMarkdownSyncIds(markdown);
  const markers = scanSyncIdMarkers(markdown);
  const seen = new Set<string>();

  if (lines[0]?.trim() === "---" && !lines.slice(1).some((line) => line.trim() === "---")) {
    diagnostics.push({ severity: "error", line: 1, message: "Frontmatter 缺少結尾的 ---。" });
  }

  for (const id of ids.cardIds) {
    if (seen.has(id)) {
      diagnostics.push({ severity: "error", message: `卡片 ID 重複：${id}` });
    }
    seen.add(id);
  }
  if (markers.fileIds.length > 1) {
    diagnostics.push({
      severity: "error",
      line: (markers.fileIds[1]?.line ?? 0) + 1,
      message: "同一份筆記內有多個來源檔案 ID。"
    });
  }

  let inFence = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    if (/^\s*Q(?:C)?\s*[:：]/i.test(line)) {
      const cardStartsHere = parseFlashcards(lines.slice(index).join("\n"))[0]?.startLine === 0;
      if (!cardStartsHere) {
        diagnostics.push({
          severity: "warning",
          line: index + 1,
          message: "問題缺少相符且非空白的答案，這一題不會同步。"
        });
      }
    }
    if (IMAGE_OCCLUSION_PATTERN.test(line)) {
      const cardStartsHere = parseImageOcclusionCards(lines.slice(index).join("\n"))[0]?.startLine === 0;
      if (!cardStartsHere) {
        diagnostics.push({
          severity: "warning",
          line: index + 1,
          message: "影像遮擋題缺少圖片或有效的 MASK；座標格式應為 x, y, 寬, 高，且範圍為 0–100。"
        });
      }
    }
    let maskBlockStart = index - 1;
    while (maskBlockStart >= 0 && IMAGE_OCCLUSION_MASK_PATTERN.test(lines[maskBlockStart] ?? "")) {
      maskBlockStart -= 1;
    }
    if (IMAGE_OCCLUSION_MASK_PATTERN.test(line) && !IMAGE_OCCLUSION_PATTERN.test(lines[maskBlockStart] ?? "")) {
      diagnostics.push({
        severity: "warning",
        line: index + 1,
        message: "MASK 前沒有對應的 IO 圖片，這一行不會同步。"
      });
    }
    let answerBlockStart = index - 1;
    while (answerBlockStart >= 0 && IMAGE_OCCLUSION_MASK_PATTERN.test(lines[answerBlockStart] ?? "")) {
      answerBlockStart -= 1;
    }
    const isImageOcclusionAnswer =
      IMAGE_OCCLUSION_MASK_PATTERN.test(lines[index - 1] ?? "") &&
      IMAGE_OCCLUSION_PATTERN.test(lines[answerBlockStart] ?? "");
    if (/^\s*A(?:C)?\s*[:：]/i.test(line) && !isImageOcclusionAnswer && (index === 0 || !lines
      .slice(0, index)
      .some((candidate) => /^\s*Q(?:C)?\s*[:：]/i.test(candidate)))) {
      diagnostics.push({
        severity: "warning",
        line: index + 1,
        message: "答案前沒有對應的問題，這一行不會同步。"
      });
    }
  }
  if (inFence) {
    diagnostics.push({ severity: "warning", message: "Markdown 程式碼區塊尚未關閉。" });
  }
  const clozeStarts = markdown.match(/\{\{c\d+::/g)?.length ?? 0;
  const parsedClozeCount = parseFlashcards(markdown).filter((card) => card.kind === "cloze").length;
  if (clozeStarts > 0 && parsedClozeCount === 0) {
    diagnostics.push({ severity: "warning", message: "偵測到未完成或無法解析的 Cloze 語法。" });
  }
  return diagnostics;
}

export function findCrossFileIdConflicts(
  currentPath: string,
  current: MarkdownSyncIds,
  others: Array<{ path: string; ids: MarkdownSyncIds }>
): SyncDiagnostic[] {
  const diagnostics: SyncDiagnostic[] = [];
  for (const other of others) {
    if (other.path === currentPath) continue;
    if (current.fileId && other.ids.fileId === current.fileId) {
      diagnostics.push({
        severity: "error",
        message: `來源檔案 ID 也出現在「${other.path}」；可能是複製筆記造成。`
      });
    }
    const duplicateCards = current.cardIds.filter((id) => other.ids.cardIds.includes(id));
    for (const id of new Set(duplicateCards)) {
      diagnostics.push({
        severity: "error",
        message: `卡片 ID ${id} 也出現在「${other.path}」。`
      });
    }
  }
  return diagnostics;
}

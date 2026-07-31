import { parseImageOcclusionCards } from "./parser";
import type { ImageOcclusionMask, ParsedImageOcclusionCard } from "./types";

export type ImageOcclusionResizeMode =
  | "resize-nw"
  | "resize-ne"
  | "resize-sw"
  | "resize-se";

export const roundImageOcclusionCoordinate = (value: number): number =>
  Math.round(value * 100) / 100;

export function serializeImageOcclusionMask(mask: ImageOcclusionMask): string {
  return [mask.x, mask.y, mask.width, mask.height]
    .map(roundImageOcclusionCoordinate)
    .join(", ");
}

export function buildImageOcclusionCardMarkdown(
  imageMarkdown: string,
  masks: ImageOcclusionMask[],
  answer: string,
  syncId: string | null = null
): string {
  const lines = [
    `IO: ${imageMarkdown}`,
    ...masks.map((mask) => `<!-- MASK: ${serializeImageOcclusionMask(mask)} -->`)
  ];
  const trimmedAnswer = answer.trim();
  if (trimmedAnswer) {
    const [firstLine = "", ...remainingLines] = trimmedAnswer
      .split("\n")
      .filter((line) => line.trim() !== "");
    lines.push(`A: ${firstLine}`, ...remainingLines);
  }
  if (syncId) lines.push(`<!-- anki-sync-id: ${syncId} -->`);
  return lines.join("\n");
}

export function findImageOcclusionCardAtLine(
  markdown: string,
  line: number
): ParsedImageOcclusionCard | null {
  return parseImageOcclusionCards(markdown).find((card) => {
    const lastLine = card.idLine ?? card.endLine;
    return line >= card.startLine && line <= lastLine;
  }) ?? null;
}

export function moveImageOcclusionMask(
  mask: ImageOcclusionMask,
  deltaX: number,
  deltaY: number
): ImageOcclusionMask {
  return {
    ...mask,
    x: Math.min(100 - mask.width, Math.max(0, mask.x + deltaX)),
    y: Math.min(100 - mask.height, Math.max(0, mask.y + deltaY))
  };
}

export function resizeImageOcclusionMask(
  mask: ImageOcclusionMask,
  deltaX: number,
  deltaY: number,
  mode: ImageOcclusionResizeMode
): ImageOcclusionMask {
  const minimumSize = 1;
  let left = mask.x;
  let top = mask.y;
  let right = mask.x + mask.width;
  let bottom = mask.y + mask.height;

  if (mode.endsWith("w")) left = Math.min(right - minimumSize, Math.max(0, left + deltaX));
  if (mode.endsWith("e")) right = Math.max(left + minimumSize, Math.min(100, right + deltaX));
  if (mode.includes("-n")) top = Math.min(bottom - minimumSize, Math.max(0, top + deltaY));
  if (mode.includes("-s")) bottom = Math.max(top + minimumSize, Math.min(100, bottom + deltaY));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

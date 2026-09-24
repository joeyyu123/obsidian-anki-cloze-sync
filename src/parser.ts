import type {
  ImageOcclusionMask,
  ParsedBasicCard,
  ParsedChoiceCard,
  ParsedClozeCard,
  ParsedFlashcard,
  ParsedImageOcclusionCard
} from "./types";

export const SYNC_ID_PATTERN = /^ {0,3}<!--\s*anki-sync-id:\s*([a-zA-Z0-9-]+)\s*-->\s*$/;
export const FILE_SYNC_ID_PATTERN = /^ {0,3}<!--\s*anki-sync-file-id:\s*([a-zA-Z0-9-]+)\s*-->\s*$/m;
const CLOZE_PATTERN = /\{\{c\d+::[\s\S]+?}}/;
const HEADING_OR_RULE_PATTERN = /^\s*(?:#{1,6}\s+|(?:---+|___+|\*\*\*+)\s*$)/;
const FENCE_PATTERN = /^\s*(```|~~~)/;
const QUESTION_PATTERN = /^\s*Q\s*[:：]\s*(.*)$/i;
const ANSWER_PATTERN = /^\s*A\s*[:：]\s*(.*)$/i;
const CODE_QUESTION_PATTERN = /^\s*QC\s*[:：]\s*(.*)$/i;
const CODE_ANSWER_PATTERN = /^\s*AC\s*[:：]\s*(.*)$/i;
export const CHOICE_QUESTION_PATTERN = /^\s*Q([SM])\s*[:：]\s*(.*)$/i;
export const CHOICE_OPTION_PATTERN = /^\s*-\s+\[([ xX-])\]\s+(.+?)\s*$/;
export const CHOICE_EXPLANATION_PATTERN = /^\s*E\s*[:：]\s*(.*)$/i;
export const IMAGE_OCCLUSION_PATTERN = /^\s*IO\s*[:：]\s*(.*)$/i;
export const IMAGE_OCCLUSION_MASK_PATTERN =
  /^\s*<!--\s*MASK\s*[:：]\s*(.*?)\s*-->\s*$/i;
const IMAGE_OCCLUSION_ANSWER_PATTERN = /^\s*A\s*[:：]\s*(.*)$/i;
const REMOVED_NUMBERED_QUESTION_PATTERN = /^\s*Q(?:C)?\d+\s*[:：]/i;
const isQuestionBoundary = (line: string): boolean =>
  QUESTION_PATTERN.test(line) ||
  CODE_QUESTION_PATTERN.test(line) ||
  CHOICE_QUESTION_PATTERN.test(line) ||
  IMAGE_OCCLUSION_PATTERN.test(line) ||
  REMOVED_NUMBERED_QUESTION_PATTERN.test(line);

const startsStandaloneClozeParagraph = (
  lines: string[],
  startLine: number
): boolean => {
  if (startLine >= lines.length) return false;

  const firstLine = lines[startLine] ?? "";
  if (
    SYNC_ID_PATTERN.test(firstLine) ||
    HEADING_OR_RULE_PATTERN.test(firstLine) ||
    FENCE_PATTERN.test(firstLine) ||
    isQuestionBoundary(firstLine)
  ) {
    return false;
  }

  const paragraphLines: string[] = [];
  let cursor = startLine;
  while (cursor < lines.length) {
    const line = lines[cursor] ?? "";
    if (
      line.trim() === "" ||
      HEADING_OR_RULE_PATTERN.test(line) ||
      FENCE_PATTERN.test(line) ||
      isQuestionBoundary(line) ||
      SYNC_ID_PATTERN.test(line)
    ) {
      break;
    }
    paragraphLines.push(line);
    cursor += 1;
  }

  return CLOZE_PATTERN.test(paragraphLines.join("\n"));
};

export interface SyncIdMarker {
  id: string;
  line: number;
}

export interface ScannedSyncIdMarkers {
  fileIds: SyncIdMarker[];
  cardIds: SyncIdMarker[];
}

/**
 * Finds tracking markers that are part of the Markdown document itself.
 * Examples inside fenced code blocks are deliberately ignored.
 */
export function scanSyncIdMarkers(markdown: string): ScannedSyncIdMarkers {
  const fileIds: SyncIdMarker[] = [];
  const cardIds: SyncIdMarker[] = [];
  const lines = markdown.split("\n");
  let fence: { marker: "`" | "~"; length: number } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (fence) {
      const closing = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/)?.[1];
      if (
        closing &&
        closing.charAt(0) === fence.marker &&
        closing.length >= fence.length
      ) {
        fence = null;
      }
      continue;
    }

    const opening = line.match(/^ {0,3}(`{3,}|~{3,})(?:[^`~].*)?$/)?.[1];
    if (opening) {
      fence = {
        marker: opening.charAt(0) as "`" | "~",
        length: opening.length
      };
      continue;
    }

    if (/^(?:\t| {4})/.test(line)) continue;
    const fileId = line.match(FILE_SYNC_ID_PATTERN)?.[1];
    if (fileId) fileIds.push({ id: fileId, line: index });
    const cardId = line.match(SYNC_ID_PATTERN)?.[1];
    if (cardId) cardIds.push({ id: cardId, line: index });
  }

  return { fileIds, cardIds };
}

export function parseImageOcclusionMask(value: string): ImageOcclusionMask | null {
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [x, y, width, height] = parts as [number, number, number, number];
  const epsilon = 0.000001;
  if (
    x < 0 ||
    y < 0 ||
    width <= 0 ||
    height <= 0 ||
    x + width > 100 + epsilon ||
    y + height > 100 + epsilon
  ) {
    return null;
  }
  return { x, y, width, height };
}

/**
 * Parses paragraphs containing Anki's native cloze syntax. Fenced code blocks,
 * frontmatter, headings and blank lines form boundaries and are not cards.
 */
export function parseClozeCards(markdown: string): ParsedClozeCard[] {
  const lines = markdown.split("\n");
  const cards: ParsedClozeCard[] = [];
  let index = 0;
  let inFence = false;
  let inFrontmatter = lines[0]?.trim() === "---";

  if (inFrontmatter) index = 1;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (inFrontmatter) {
      if (line.trim() === "---") inFrontmatter = false;
      index += 1;
      continue;
    }

    if (FENCE_PATTERN.test(line)) {
      inFence = !inFence;
      index += 1;
      continue;
    }

    if (inFence || line.trim() === "" || HEADING_OR_RULE_PATTERN.test(line)) {
      index += 1;
      continue;
    }

    // A sync id belongs to the card immediately before it, never to content after it.
    if (SYNC_ID_PATTERN.test(line)) {
      index += 1;
      continue;
    }

    const startLine = index;
    const contentLines: string[] = [];
    let id: string | null = null;
    let idLine: number | null = null;

    while (index < lines.length) {
      const current = lines[index] ?? "";
      if (current.trim() === "" || HEADING_OR_RULE_PATTERN.test(current) || FENCE_PATTERN.test(current)) {
        break;
      }

      const idMatch = current.match(SYNC_ID_PATTERN);
      if (idMatch) {
        id = idMatch[1] ?? null;
        idLine = index;
      } else {
        contentLines.push(current);
      }
      index += 1;
    }

    const contentEndLine = idLine === null ? index - 1 : idLine - 1;
    const cardMarkdown = contentLines.join("\n").trim();
    if (CLOZE_PATTERN.test(cardMarkdown)) {
      cards.push({ kind: "cloze", id, markdown: cardMarkdown, startLine, endLine: contentEndLine, idLine });
    }
  }

  return cards;
}

/**
 * Parses matching front/back pairs. Plain cards use Q/A; code-practice cards
 * use QC/AC. Both forms are intentionally unnumbered and accept half/full-
 * width colons.
 */
export function parseBasicCards(markdown: string): ParsedBasicCard[] {
  const lines = markdown.split("\n");
  const cards: ParsedBasicCard[] = [];
  let index = 0;
  let inFence = false;
  let inFrontmatter = lines[0]?.trim() === "---";

  if (inFrontmatter) index = 1;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (inFrontmatter) {
      if (line.trim() === "---") inFrontmatter = false;
      index += 1;
      continue;
    }
    if (FENCE_PATTERN.test(line)) {
      inFence = !inFence;
      index += 1;
      continue;
    }
    if (inFence) {
      index += 1;
      continue;
    }

    const codeQuestionMatch = line.match(CODE_QUESTION_PATTERN);
    const questionMatch = codeQuestionMatch ?? line.match(QUESTION_PATTERN);
    if (!questionMatch) {
      index += 1;
      continue;
    }

    const kind = codeQuestionMatch ? "basic" : "plain";
    const answerPattern = codeQuestionMatch ? CODE_ANSWER_PATTERN : ANSWER_PATTERN;
    const questionLines = [questionMatch[1] ?? ""];
    const startLine = index;
    let cursor = index + 1;
    let answerMatch: RegExpMatchArray | null = null;
    let inQuestionFence = false;

    while (cursor < lines.length) {
      const candidate = lines[cursor] ?? "";
      const possibleAnswer = inQuestionFence ? null : candidate.match(answerPattern);
      if (possibleAnswer) {
        answerMatch = possibleAnswer;
        break;
      }
      if (FENCE_PATTERN.test(candidate)) {
        inQuestionFence = !inQuestionFence;
        questionLines.push(candidate);
        cursor += 1;
        continue;
      }
      if (
        !inQuestionFence &&
        (candidate.trim() === "" ||
          HEADING_OR_RULE_PATTERN.test(candidate) ||
          isQuestionBoundary(candidate))
      ) {
        break;
      }
      questionLines.push(candidate);
      cursor += 1;
    }

    if (!answerMatch) {
      index += 1;
      continue;
    }

    const answerLines = [answerMatch[1] ?? ""];
    let endLine = cursor;
    let id: string | null = null;
    let idLine: number | null = null;
    let inAnswerFence = false;
    cursor += 1;

    while (cursor < lines.length) {
      const candidate = lines[cursor] ?? "";
      const idMatch = inAnswerFence ? null : candidate.match(SYNC_ID_PATTERN);
      if (idMatch) {
        id = idMatch[1] ?? null;
        idLine = cursor;
        cursor += 1;
        break;
      }
      if (FENCE_PATTERN.test(candidate)) {
        inAnswerFence = !inAnswerFence;
        answerLines.push(candidate);
        endLine = cursor;
        cursor += 1;
        continue;
      }
      if (!inAnswerFence && candidate.trim() === "") {
        const blankStart = cursor;
        while (
          cursor < lines.length &&
          (lines[cursor] ?? "").trim() === ""
        ) {
          cursor += 1;
        }

        // Blank lines may be part of a multiline answer. Only stop when the
        // next paragraph is an independent Cloze card.
        if (startsStandaloneClozeParagraph(lines, cursor)) break;

        answerLines.push(...lines.slice(blankStart, cursor));
        continue;
      }
      if (
        !inAnswerFence &&
        (HEADING_OR_RULE_PATTERN.test(candidate) ||
          isQuestionBoundary(candidate))
      ) {
        break;
      }
      answerLines.push(candidate);
      endLine = cursor;
      cursor += 1;
    }

    const questionMarkdown = questionLines.join("\n").trim();
    const answerMarkdown = answerLines.join("\n").trim();
    if (questionMarkdown && answerMarkdown) {
      cards.push({
        kind,
        id,
        questionMarkdown,
        answerMarkdown,
        startLine,
        endLine,
        idLine
      });
    }
    index = Math.max(cursor, index + 1);
  }

  return cards;
}

/**
 * Parses interactive choice cards. QS requires exactly one checked option;
 * QM accepts one or more checked options. E adds an optional explanation.
 */
export function parseChoiceCards(markdown: string): ParsedChoiceCard[] {
  const lines = markdown.split("\n");
  const cards: ParsedChoiceCard[] = [];
  let index = 0;
  let inFence = false;
  let inFrontmatter = lines[0]?.trim() === "---";

  if (inFrontmatter) index = 1;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (inFrontmatter) {
      if (line.trim() === "---") inFrontmatter = false;
      index += 1;
      continue;
    }
    if (FENCE_PATTERN.test(line)) {
      inFence = !inFence;
      index += 1;
      continue;
    }
    if (inFence) {
      index += 1;
      continue;
    }

    const questionMatch = line.match(CHOICE_QUESTION_PATTERN);
    if (!questionMatch) {
      index += 1;
      continue;
    }

    const mode = questionMatch[1]?.toUpperCase() === "S" ? "single" : "multiple";
    const questionLines = [questionMatch[2] ?? ""];
    const startLine = index;
    let cursor = index + 1;

    while (cursor < lines.length) {
      const candidate = lines[cursor] ?? "";
      if (CHOICE_OPTION_PATTERN.test(candidate)) break;
      if (
        candidate.trim() === "" ||
        HEADING_OR_RULE_PATTERN.test(candidate) ||
        isQuestionBoundary(candidate) ||
        CHOICE_EXPLANATION_PATTERN.test(candidate) ||
        SYNC_ID_PATTERN.test(candidate)
      ) {
        break;
      }
      questionLines.push(candidate);
      cursor += 1;
    }

    const options: ParsedChoiceCard["options"] = [];
    let hasUnsupportedCompletedMarker = false;
    let endLine = startLine;
    while (cursor < lines.length) {
      const optionMatch = (lines[cursor] ?? "").match(CHOICE_OPTION_PATTERN);
      if (!optionMatch) break;
      if ((optionMatch[1] ?? "").toLowerCase() === "x") {
        hasUnsupportedCompletedMarker = true;
      }
      options.push({
        correct: optionMatch[1] === "-",
        markdown: optionMatch[2]?.trim() ?? ""
      });
      endLine = cursor;
      cursor += 1;
    }

    const explanationLines: string[] = [];
    const explanationMatch = (lines[cursor] ?? "").match(CHOICE_EXPLANATION_PATTERN);
    if (explanationMatch) {
      explanationLines.push(explanationMatch[1] ?? "");
      endLine = cursor;
      cursor += 1;
      let inExplanationFence = false;
      while (cursor < lines.length) {
        const candidate = lines[cursor] ?? "";
        if (FENCE_PATTERN.test(candidate)) {
          inExplanationFence = !inExplanationFence;
          explanationLines.push(candidate);
          endLine = cursor;
          cursor += 1;
          continue;
        }
        if (
          !inExplanationFence &&
          (candidate.trim() === "" ||
            HEADING_OR_RULE_PATTERN.test(candidate) ||
            isQuestionBoundary(candidate) ||
            SYNC_ID_PATTERN.test(candidate))
        ) {
          break;
        }
        explanationLines.push(candidate);
        endLine = cursor;
        cursor += 1;
      }
    }

    let id: string | null = null;
    let idLine: number | null = null;
    const idMatch = (lines[cursor] ?? "").match(SYNC_ID_PATTERN);
    if (idMatch) {
      id = idMatch[1] ?? null;
      idLine = cursor;
      cursor += 1;
    }

    const questionMarkdown = questionLines.join("\n").trim();
    const correctCount = options.filter((option) => option.correct).length;
    const hasValidAnswer = mode === "single" ? correctCount === 1 : correctCount >= 1;
    if (
      questionMarkdown &&
      options.length >= 2 &&
      hasValidAnswer &&
      !hasUnsupportedCompletedMarker
    ) {
      cards.push({
        kind: "choice",
        mode,
        id,
        questionMarkdown,
        options,
        explanationMarkdown: explanationLines.join("\n").trim(),
        startLine,
        endLine,
        idLine
      });
    }
    index = Math.max(cursor, index + 1);
  }

  return cards;
}

/**
 * Parses image-occlusion blocks with one or more masks. Coordinates are
 * percentages of the source image in x, y, width, height order so masks stay
 * aligned responsively and can be revealed in authoring order.
 */
export function parseImageOcclusionCards(markdown: string): ParsedImageOcclusionCard[] {
  const lines = markdown.split("\n");
  const cards: ParsedImageOcclusionCard[] = [];
  let index = 0;
  let inFence = false;
  let inFrontmatter = lines[0]?.trim() === "---";

  if (inFrontmatter) index = 1;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (inFrontmatter) {
      if (line.trim() === "---") inFrontmatter = false;
      index += 1;
      continue;
    }
    if (FENCE_PATTERN.test(line)) {
      inFence = !inFence;
      index += 1;
      continue;
    }
    if (inFence) {
      index += 1;
      continue;
    }

    const imageMatch = line.match(IMAGE_OCCLUSION_PATTERN);
    if (!imageMatch) {
      index += 1;
      continue;
    }

    const startLine = index;
    const imageMarkdown = (imageMatch[1] ?? "").trim();
    let cursor = index + 1;
    const masks: ImageOcclusionMask[] = [];
    let invalidMask = false;
    let endLine = startLine;

    while (cursor < lines.length) {
      const maskMatch = (lines[cursor] ?? "").match(IMAGE_OCCLUSION_MASK_PATTERN);
      if (!maskMatch) break;
      const mask = parseImageOcclusionMask(maskMatch[1] ?? "");
      if (!mask) invalidMask = true;
      else masks.push(mask);
      endLine = cursor;
      cursor += 1;
    }

    if (!imageMarkdown || masks.length === 0 || invalidMask) {
      index += 1;
      continue;
    }

    let id: string | null = null;
    let idLine: number | null = null;
    const answerLines: string[] = [];

    const firstAnswer = (lines[cursor] ?? "").match(IMAGE_OCCLUSION_ANSWER_PATTERN);
    if (firstAnswer) {
      answerLines.push(firstAnswer[1] ?? "");
      endLine = cursor;
      cursor += 1;
      while (cursor < lines.length) {
        const candidate = lines[cursor] ?? "";
        const candidateId = candidate.match(SYNC_ID_PATTERN);
        if (candidateId) {
          id = candidateId[1] ?? null;
          idLine = cursor;
          cursor += 1;
          break;
        }
        if (
          candidate.trim() === "" ||
          HEADING_OR_RULE_PATTERN.test(candidate) ||
          isQuestionBoundary(candidate) ||
          IMAGE_OCCLUSION_MASK_PATTERN.test(candidate)
        ) {
          break;
        }
        answerLines.push(candidate);
        endLine = cursor;
        cursor += 1;
      }
    } else {
      const candidateId = (lines[cursor] ?? "").match(SYNC_ID_PATTERN);
      if (candidateId) {
        id = candidateId[1] ?? null;
        idLine = cursor;
        cursor += 1;
      }
    }

    cards.push({
      kind: "image-occlusion",
      id,
      imageMarkdown,
      masks,
      answerMarkdown: answerLines.join("\n").trim(),
      startLine,
      endLine,
      idLine
    });
    index = Math.max(cursor, index + 1);
  }

  return cards;
}

export function parseFlashcards(markdown: string): ParsedFlashcard[] {
  const basicCards = parseBasicCards(markdown);
  const choiceCards = parseChoiceCards(markdown);
  const imageOcclusionCards = parseImageOcclusionCards(markdown);
  const structuredCards: ParsedFlashcard[] = [...basicCards, ...choiceCards, ...imageOcclusionCards];
  const clozeCards = parseClozeCards(markdown).filter(
    (cloze) =>
      !structuredCards.some(
        (card) => cloze.startLine <= card.endLine && card.startLine <= cloze.endLine
      )
  );
  return [...structuredCards, ...clozeCards].sort((a, b) => a.startLine - b.startLine);
}

export function addMissingSyncIds(
  markdown: string,
  createId: () => string
): { markdown: string; added: number } {
  const cards = parseFlashcards(markdown);
  const lines = markdown.split("\n");
  let added = 0;

  for (const card of [...cards].reverse()) {
    if (card.id) continue;
    lines.splice(card.endLine + 1, 0, `<!-- anki-sync-id: ${createId()} -->`);
    added += 1;
  }

  return { markdown: lines.join("\n"), added };
}

export function ensureFileSyncId(
  markdown: string,
  createId: () => string
): { markdown: string; id: string | null; added: boolean } {
  const markers = scanSyncIdMarkers(markdown);
  const existing = markers.fileIds[0];
  if (existing) return { markdown, id: existing.id, added: false };
  const hasCardMarker = markers.cardIds.length > 0;
  if (parseFlashcards(markdown).length === 0 && !hasCardMarker) {
    return { markdown, id: null, added: false };
  }

  const id = createId();
  const lines = markdown.split("\n");
  let insertionLine = 0;
  if (lines[0]?.trim() === "---") {
    const closingFrontmatter = lines.findIndex(
      (line, index) => index > 0 && line.trim() === "---"
    );
    if (closingFrontmatter >= 0) insertionLine = closingFrontmatter + 1;
  }

  const marker = `<!-- anki-sync-file-id: ${id} -->`;
  if ((lines[insertionLine] ?? "").trim() === "") {
    lines.splice(insertionLine, 0, marker);
  } else {
    lines.splice(insertionLine, 0, marker, "");
  }
  return { markdown: lines.join("\n"), id, added: true };
}

export function hasCloze(markdown: string): boolean {
  return CLOZE_PATTERN.test(markdown);
}

export function regenerateSyncIds(
  markdown: string,
  createId: () => string
): { markdown: string; replaced: number } {
  let replaced = 0;
  const markers = scanSyncIdMarkers(markdown);
  const fileIdLines = new Set(markers.fileIds.map((marker) => marker.line));
  const cardIdLines = new Set(markers.cardIds.map((marker) => marker.line));
  const result = markdown
    .split("\n")
    .map((line, index) => {
      if (fileIdLines.has(index)) {
        replaced += 1;
        return `<!-- anki-sync-file-id: ${createId()} -->`;
      }
      if (cardIdLines.has(index)) {
        replaced += 1;
        return `<!-- anki-sync-id: ${createId()} -->`;
      }
      return line;
    })
    .join("\n");
  return { markdown: result, replaced };
}

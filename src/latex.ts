interface ProtectedLatex {
  markdown: string;
  restore: (html: string) => string;
}

interface LatexToken {
  placeholder: string;
  html: string;
}

const PLACEHOLDER_PREFIX = "ANKILATEXPLACEHOLDER";

const isEscaped = (value: string, index: number): boolean => {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
};

const escapeMathHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const countRun = (value: string, index: number, character: string): number => {
  let length = 0;
  while (value[index + length] === character) length += 1;
  return length;
};

const findClosingFence = (
  markdown: string,
  contentStart: number,
  marker: string,
  minimumLength: number
): number => {
  let lineStart = contentStart;
  while (lineStart < markdown.length) {
    const lineEnd = markdown.indexOf("\n", lineStart);
    const end = lineEnd === -1 ? markdown.length : lineEnd;
    const line = markdown.slice(lineStart, end);
    const match = line.match(/^ {0,3}(`+|~+)\s*$/);
    const fenceRun = match?.[1];
    if (fenceRun && fenceRun.charAt(0) === marker && fenceRun.length >= minimumLength) {
      return lineEnd === -1 ? markdown.length : lineEnd + 1;
    }
    if (lineEnd === -1) break;
    lineStart = lineEnd + 1;
  }
  return markdown.length;
};

const findClosingInlineMath = (markdown: string, start: number): number => {
  for (let cursor = start; cursor < markdown.length; cursor += 1) {
    if (markdown[cursor] === "\n") return -1;
    if (
      markdown[cursor] === "$" &&
      markdown[cursor + 1] !== "$" &&
      !isEscaped(markdown, cursor) &&
      cursor > start &&
      !/\s/.test(markdown.charAt(cursor - 1))
    ) {
      return cursor;
    }
  }
  return -1;
};

const findClosingBlockMath = (markdown: string, start: number): number => {
  for (let cursor = start; cursor < markdown.length - 1; cursor += 1) {
    if (
      markdown[cursor] === "$" &&
      markdown[cursor + 1] === "$" &&
      !isEscaped(markdown, cursor)
    ) {
      return cursor;
    }
  }
  return -1;
};

/** Protect Obsidian LaTeX from MarkdownRenderer and restore Anki MathJax markup. */
export const protectLatexForAnki = (markdown: string): ProtectedLatex => {
  const tokens: LatexToken[] = [];
  let protectedMarkdown = "";
  let cursor = 0;

  const addToken = (source: string, display: boolean): void => {
    const placeholder = `${PLACEHOLDER_PREFIX}${tokens.length}X`;
    const expression = escapeMathHtml(source);
    const html = display
      ? `<span class="anki-math-block">\\[${expression}\\]</span>`
      : `<span class="anki-math-inline">\\(${expression}\\)</span>`;
    tokens.push({ placeholder, html });
    protectedMarkdown += placeholder;
  };

  while (cursor < markdown.length) {
    const atLineStart = cursor === 0 || markdown[cursor - 1] === "\n";
    if (atLineStart) {
      const fenceMatch = markdown.slice(cursor).match(/^ {0,3}(`{3,}|~{3,})[^\n]*(?:\n|$)/);
      if (fenceMatch) {
        const markerRun = fenceMatch[1];
        if (!markerRun) {
          protectedMarkdown += markdown.charAt(cursor);
          cursor += 1;
          continue;
        }
        const contentStart = cursor + fenceMatch[0].length;
        const fenceEnd = findClosingFence(
          markdown,
          contentStart,
          markerRun.charAt(0),
          markerRun.length
        );
        protectedMarkdown += markdown.slice(cursor, fenceEnd);
        cursor = fenceEnd;
        continue;
      }
    }

    if (markdown[cursor] === "`") {
      const runLength = countRun(markdown, cursor, "`");
      const delimiter = "`".repeat(runLength);
      const close = markdown.indexOf(delimiter, cursor + runLength);
      const end = close === -1 ? markdown.length : close + runLength;
      protectedMarkdown += markdown.slice(cursor, end);
      cursor = end;
      continue;
    }

    if (markdown[cursor] === "$" && !isEscaped(markdown, cursor)) {
      if (markdown[cursor + 1] === "$") {
        const close = findClosingBlockMath(markdown, cursor + 2);
        if (close !== -1) {
          addToken(markdown.slice(cursor + 2, close).trim(), true);
          cursor = close + 2;
          continue;
        }
      } else if (cursor + 1 < markdown.length && !/\s/.test(markdown.charAt(cursor + 1))) {
        const close = findClosingInlineMath(markdown, cursor + 1);
        if (close !== -1) {
          addToken(markdown.slice(cursor + 1, close), false);
          cursor = close + 1;
          continue;
        }
      }
    }

    protectedMarkdown += markdown.charAt(cursor);
    cursor += 1;
  }

  return {
    markdown: protectedMarkdown,
    restore: (html: string): string =>
      tokens.reduce(
        (result, token) => result.split(token.placeholder).join(token.html),
        html
      )
  };
};

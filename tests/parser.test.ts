import assert from "node:assert/strict";
import test from "node:test";
import {
  addMissingSyncIds,
  ensureFileSyncId,
  parseBasicCards,
  parseChoiceCards,
  parseClozeCards,
  parseFlashcards,
  parseImageOcclusionCards,
  parseImageOcclusionMask,
  regenerateSyncIds
} from "../src/parser";
import {
  CONTENT_HASH_TAG_PREFIX,
  canSafelyAttributeLegacyNote,
  contentHashTag,
  createContentHash,
  findStaleNoteIds,
  mergeNoteIdsBySyncId,
  noteBelongsToFile,
  obsoleteLegacyFileTags
} from "../src/sync-utils";
import {
  collectMarkdownSyncIds,
  diagnoseMarkdown,
  findCrossFileIdConflicts
} from "../src/diagnostics";
import {
  extractEmbeddedLinks,
  isExactMediaSourceMatch,
  rewriteEmbeddedMediaForAnki
} from "../src/media";
import { resolveNoteFileConfigFromData } from "../src/note-config";
import { DEFAULT_SETTINGS } from "../src/types";

test("parses a cloze paragraph and its stable id", () => {
  const source = [
    "# Biology",
    "",
    "The powerhouse is {{c1::the mitochondrion}}.",
    "<!-- anki-sync-id: card-123 -->"
  ].join("\n");
  const cards = parseClozeCards(source);

  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.id, "card-123");
  assert.equal(cards[0]?.markdown, "The powerhouse is {{c1::the mitochondrion}}.");
});

test("supports multiple clozes and hints in one note", () => {
  const cards = parseClozeCards("{{c1::Paris::city}} is in {{c2::France::country}}.");
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.id, null);
});

test("ignores cloze syntax in frontmatter and fenced code", () => {
  const source = [
    "---",
    "example: '{{c1::ignored}}'",
    "---",
    "",
    "```md",
    "{{c1::ignored too}}",
    "```"
  ].join("\n");
  assert.deepEqual(parseClozeCards(source), []);
});

test("adds ids in reverse order without shifting insertion positions", () => {
  let next = 0;
  const source = "First {{c1::one}}.\n\nSecond {{c1::two}}.";
  const result = addMissingSyncIds(source, () => `id-${++next}`);
  const cards = parseClozeCards(result.markdown);

  assert.equal(result.added, 2);
  assert.equal(cards.length, 2);
  assert.equal(cards[0]?.id, "id-2");
  assert.equal(cards[1]?.id, "id-1");
});

test("does not create another id after the first sync", () => {
  const first = addMissingSyncIds("Question {{c1::answer}}", () => "stable");
  const second = addMissingSyncIds(first.markdown, () => "unexpected");
  assert.equal(second.added, 0);
  assert.equal(second.markdown, first.markdown);
});

test("does not parse removed numbered Q1/A1 cards", () => {
  const source = [
    "Q1: 1+1 = ?",
    "A1: 2",
    "<!-- anki-sync-id: math-1 -->"
  ].join("\n");
  assert.deepEqual(parseBasicCards(source), []);
});

test("supports full-width colons and unnumbered Q/A cards", () => {
  const cards = parseBasicCards("Q：台灣的首都是？\nA：台北");
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.kind, "plain");
  assert.equal(cards[0]?.questionMarkdown, "台灣的首都是？");
});

test("parses unnumbered QC/AC as a code-practice card", () => {
  const cards = parseBasicCards("QC: Implement pop.\nAC: Use array.pop().");

  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.kind, "basic");
});

test("does not parse removed numbered QC1/AC1 cards", () => {
  assert.deepEqual(parseBasicCards("QC1: Question\nAC1: Answer"), []);
});

test("does not treat removed QB/AB aliases as cards", () => {
  assert.deepEqual(parseBasicCards("QB1: Question\nAB1: Answer"), []);
});

test("parses adjacent Q/A pairs without requiring blank lines", () => {
  const source = "Q: One?\nA: First\nQ: Two?\nA: Second";
  const cards = parseBasicCards(source);
  assert.equal(cards.length, 2);
  assert.equal(cards[1]?.answerMarkdown, "Second");
});


test("keeps blank lines and restarted lists inside Q/A answers", () => {
  const answers = [
    "First paragraph.\n\nSecond paragraph.",
    "First paragraph.\n\n\nSecond paragraph.",
    "1. first\n2. second\n\n1. another first\n2. another second"
  ];

  for (const answer of answers) {
    const cards = parseBasicCards(`Q: Why?\nA:\n${answer}`);
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.answerMarkdown, answer);
  }
});

test("keeps an existing Q/A sync id across blank lines", () => {
  for (const gap of ["\n\n", "\n\n\n"]) {
    const source = `Q: question\nA: answer${gap}<!-- anki-sync-id: stable-id -->`;
    const cards = parseBasicCards(source);
    const result = addMissingSyncIds(source, () => "unexpected");

    assert.equal(cards[0]?.id, "stable-id");
    assert.equal(result.added, 0);
    assert.equal(result.markdown, source);
  }
});

test("keeps a following standalone cloze separate from a Q/A answer", () => {
  const source = [
    "Q: question",
    "A: answer",
    "",
    "This is {{c1::cloze}}"
  ].join("\n");

  const cards = parseFlashcards(source);

  assert.deepEqual(cards.map((card) => card.kind), ["plain", "cloze"]);
  assert.equal(cards[0]?.kind === "plain" ? cards[0].answerMarkdown : null, "answer");
});

test("does not reuse a Q/A sync id for a following cloze card", () => {
  const source = [
    "Q: question",
    "A: answer",
    "",
    "<!-- anki-sync-id: qa-id -->",
    "This is {{c1::cloze}}"
  ].join("\n");

  const cards = parseFlashcards(source);

  assert.equal(cards.length, 2);
  assert.equal(cards[0]?.kind, "plain");
  assert.equal(cards[0]?.id, "qa-id");
  assert.equal(cards[1]?.kind, "cloze");
  assert.equal(cards[1]?.id, null);
});

test("adds a separate id to cloze after a Q/A stable id", () => {
  const source = [
    "Q: question",
    "A: answer",
    "",
    "<!-- anki-sync-id: qa-id -->",
    "This is {{c1::cloze}}"
  ].join("\n");

  const result = addMissingSyncIds(source, () => "cloze-id");
  const cards = parseFlashcards(result.markdown);

  assert.equal(result.added, 1);
  assert.equal(cards[0]?.id, "qa-id");
  assert.equal(cards[1]?.id, "cloze-id");
});

test("adds one id after a complete multiline Q/A answer and is idempotent", () => {
  const source = [
    "Q: List both groups.",
    "A:",
    "1. first",
    "2. second",
    "",
    "1. another first",
    "2. another second"
  ].join("\n");
  const first = addMissingSyncIds(source, () => "stable-id");
  const second = addMissingSyncIds(first.markdown, () => "unexpected");

  assert.equal(first.added, 1);
  assert.equal(first.markdown, `${source}\n<!-- anki-sync-id: stable-id -->`);
  assert.equal(parseBasicCards(first.markdown)[0]?.id, "stable-id");
  assert.equal(second.added, 0);
  assert.equal(second.markdown, first.markdown);
});

test("keeps question markers, headings and rules as Q/A answer boundaries", () => {
  const source = "Q: question 1\nA: answer 1\n\nQ: question 2\nA: answer 2";
  const cards = parseBasicCards(source);

  assert.equal(cards.length, 2);
  assert.deepEqual(cards.map((card) => card.answerMarkdown), ["answer 1", "answer 2"]);

  for (const boundary of ["## Notes", "---"]) {
    const boundaryCards = parseBasicCards(
      `Q: question\nA: answer\n\n${boundary}\nordinary prose`
    );
    assert.equal(boundaryCards[0]?.answerMarkdown, "answer");
  }
});

test("supports a fenced code block as the reference answer", () => {
  const source = [
    "QC: Implement a stack push method.",
    "AC:",
    "```ts",
    "push(value: T): void {",
    "  this.items.push(value);",
    "}",
    "```"
  ].join("\n");
  const cards = parseBasicCards(source);

  assert.equal(cards.length, 1);
  assert.match(cards[0]?.answerMarkdown ?? "", /^```ts/);
  assert.match(cards[0]?.answerMarkdown ?? "", /this\.items\.push\(value\)/);
});

test("keeps removed numbered questions out of a preceding answer", () => {
  const cards = parseBasicCards("Q: Current\nA: Answer\nQ1: Removed\nA1: Removed answer");
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.answerMarkdown, "Answer");
});

test("parses QS as a single-choice card with an optional explanation", () => {
  const source = [
    "QS: HTTP 的預設連接埠是？",
    "- [ ] 21",
    "- [ ] 22",
    "- [-] **80**",
    "- [ ] 443",
    "E: HTTPS 才預設使用 443。",
    "<!-- anki-sync-id: http-port -->"
  ].join("\n");
  const cards = parseChoiceCards(source);

  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.mode, "single");
  assert.equal(cards[0]?.questionMarkdown, "HTTP 的預設連接埠是？");
  assert.deepEqual(cards[0]?.options, [
    { markdown: "21", correct: false },
    { markdown: "22", correct: false },
    { markdown: "**80**", correct: true },
    { markdown: "443", correct: false }
  ]);
  assert.equal(cards[0]?.explanationMarkdown, "HTTPS 才預設使用 443。");
  assert.equal(cards[0]?.id, "http-port");
});

test("parses QM with multiple correct answers and full-width punctuation", () => {
  const cards = parseChoiceCards([
    "QM：下列哪些是 JavaScript primitive？",
    "- [-] string",
    "- [-] bigint",
    "- [ ] Array",
    "- [-] undefined"
  ].join("\n"));

  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.mode, "multiple");
  assert.deepEqual(cards[0]?.options.map((option) => option.correct), [true, true, false, true]);
});

test("rejects choice cards with invalid answer counts", () => {
  assert.deepEqual(parseChoiceCards("QS: Pick one\n- [-] A\n- [-] B"), []);
  assert.deepEqual(parseChoiceCards("QM: Pick many\n- [ ] A\n- [ ] B"), []);
  assert.deepEqual(parseChoiceCards("QS: Too few\n- [-] A"), []);
});

test("rejects completed task markers so Obsidian does not strike through answers", () => {
  const source = "QS: Pick one\n- [ ] A\n- [x] B";
  assert.deepEqual(parseChoiceCards(source), []);
  assert.ok(diagnoseMarkdown(source).some((item) =>
    item.message.includes("[-]") && item.message.includes("[x]")
  ));
});

test("keeps a preceding Q/A answer separate from an adjacent choice card", () => {
  const source = "Q: One?\nA: First\nQS: Two?\n- [ ] A\n- [-] B";
  const cards = parseFlashcards(source);
  assert.deepEqual(cards.map((card) => card.kind), ["plain", "choice"]);
  assert.equal(cards[0]?.kind === "plain" ? cards[0].answerMarkdown : null, "First");
});

test("adds a stable id to a choice card and does not duplicate it", () => {
  const source = "QS: Pick one\n- [ ] A\n- [-] B";
  const first = addMissingSyncIds(source, () => "choice-stable");
  const second = addMissingSyncIds(first.markdown, () => "unexpected");

  assert.equal(first.added, 1);
  assert.equal(second.added, 0);
  assert.equal(parseChoiceCards(second.markdown)[0]?.id, "choice-stable");
});

test("adds stable ids to mixed cloze and basic cards", () => {
  let next = 0;
  const source = "Q: 1+1?\nA: 2\n\nWater is {{c1::H2O}}.";
  const result = addMissingSyncIds(source, () => `mixed-${++next}`);
  const cards = parseFlashcards(result.markdown);

  assert.equal(result.added, 2);
  assert.deepEqual(cards.map((card) => card.kind), ["plain", "cloze"]);
  assert.ok(cards.every((card) => card.id !== null));
});

test("parses an image occlusion card with multiple masks in reveal order", () => {
  const source = [
    "IO: ![[anatomy/heart.png]]",
    "<!-- MASK: 12.5, 24, 30, 18.25 -->",
    "<!-- MASK: 55, 16, 18, 22 -->",
    "<!-- MASK: 42, 63, 14, 12 -->",
    "A: 左心室",
    "<!-- anki-sync-id: heart-left-ventricle -->"
  ].join("\n");
  const cards = parseImageOcclusionCards(source);

  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.kind, "image-occlusion");
  assert.equal(cards[0]?.imageMarkdown, "![[anatomy/heart.png]]");
  assert.deepEqual(cards[0]?.masks, [
    { x: 12.5, y: 24, width: 30, height: 18.25 },
    { x: 55, y: 16, width: 18, height: 22 },
    { x: 42, y: 63, width: 14, height: 12 }
  ]);
  assert.equal(cards[0]?.answerMarkdown, "左心室");
  assert.equal(cards[0]?.id, "heart-left-ventricle");
});

test("image occlusion answer is optional and full-width colons are accepted", () => {
  const cards = parseImageOcclusionCards("IO：![[brain.png]]\n<!-- MASK：0, 0, 20, 10 -->");
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.masks.length, 1);
  assert.equal(cards[0]?.answerMarkdown, "");
});

test("rejects an image occlusion block when any mask is invalid", () => {
  const source = [
    "IO: ![[brain.png]]",
    "<!-- MASK: 10, 10, 20, 20 -->",
    "<!-- MASK: 90, 90, 20, 20 -->"
  ].join("\n");
  assert.deepEqual(parseImageOcclusionCards(source), []);
});

test("rejects image occlusion masks outside the image", () => {
  assert.equal(parseImageOcclusionMask("90, 10, 20, 10"), null);
  assert.equal(parseImageOcclusionMask("10, 95, 10, 10"), null);
  assert.equal(parseImageOcclusionMask("10, 10, 0, 5"), null);
  assert.deepEqual(parseImageOcclusionMask("0, 0, 100, 100"), {
    x: 0,
    y: 0,
    width: 100,
    height: 100
  });
});

test("does not parse a bare MASK line", () => {
  assert.deepEqual(
    parseImageOcclusionCards("IO: ![[brain.png]]\nMASK: 10, 10, 20, 20"),
    []
  );
});

test("adds stable ids to image occlusion cards in mixed notes", () => {
  let next = 0;
  const source = [
    "Q: 1+1?",
    "A: 2",
    "",
    "IO: ![[map.png]]",
    "<!-- MASK: 20, 30, 15, 10 -->"
  ].join("\n");
  const result = addMissingSyncIds(source, () => `card-${++next}`);
  const cards = parseFlashcards(result.markdown);

  assert.deepEqual(cards.map((card) => card.kind), ["plain", "image-occlusion"]);
  assert.ok(cards.every((card) => card.id));
});

test("adds one stable file id after frontmatter", () => {
  const source = "---\ntags: [study]\n---\nQ: 1+1?\nA: 2";
  const first = ensureFileSyncId(source, () => "file-123");
  const second = ensureFileSyncId(first.markdown, () => "unexpected");

  assert.equal(first.added, true);
  assert.match(first.markdown, /---\n<!-- anki-sync-file-id: file-123 -->\n\nQ:/);
  assert.equal(second.added, false);
  assert.equal(second.id, "file-123");
});

test("keeps the file id after all cards are removed", () => {
  const source = "<!-- anki-sync-file-id: file-123 -->\n\nNo cards remain.";
  const result = ensureFileSyncId(source, () => "unexpected");
  assert.equal(result.id, "file-123");
  assert.equal(result.added, false);
});

test("adds a file id when an older synced card was removed", () => {
  const source = "<!-- anki-sync-id: old-card -->";
  const result = ensureFileSyncId(source, () => "migrated-file");
  assert.equal(result.id, "migrated-file");
  assert.equal(result.added, true);
});

test("finds notes removed from the current Markdown file", () => {
  assert.deepEqual(findStaleNoteIds([10, 20, 20, 30], [10, 30]), [20]);
});

test("recovers a card match from owned note tags when the direct Anki query misses it", () => {
  const result = mergeNoteIdsBySyncId(
    ["card-123", "card-456"],
    new Map([
      ["card-123", []],
      ["card-456", [20]]
    ]),
    [
      {
        noteId: 10,
        tags: ["obsidian_file_note", "obsidian_sync_id_card-123"]
      },
      {
        noteId: 20,
        tags: ["obsidian_file_note", "obsidian_sync_id_card-456"]
      }
    ]
  );

  assert.deepEqual(result.get("card-123"), [10]);
  assert.deepEqual(result.get("card-456"), [20]);
});

test("regenerates file and card ids without changing card content", () => {
  let next = 0;
  const source = [
    "<!-- anki-sync-file-id: old-file -->",
    "Q: One?",
    "A: First",
    "<!-- anki-sync-id: old-card -->"
  ].join("\n");
  const result = regenerateSyncIds(source, () => `new-${++next}`);

  assert.equal(result.replaced, 2);
  assert.match(result.markdown, /anki-sync-file-id: new-1/);
  assert.match(result.markdown, /anki-sync-id: new-2/);
  const card = parseFlashcards(result.markdown)[0];
  assert.equal(card?.kind === "plain" ? card.questionMarkdown : null, "One?");
});

test("ignores sync id examples inside fenced code blocks", () => {
  const source = [
    "```md",
    "<!-- anki-sync-file-id: example-file -->",
    "<!-- anki-sync-id: example-card -->",
    "```",
    "",
    "    <!-- anki-sync-id: indented-example -->",
    "",
    "Q: Real card?",
    "A: Yes"
  ].join("\n");

  assert.deepEqual(collectMarkdownSyncIds(source), { fileId: null, cardIds: [] });
  const withFileId = ensureFileSyncId(source, () => "real-file");
  assert.equal(withFileId.id, "real-file");
  const regenerated = regenerateSyncIds(withFileId.markdown, () => "new-real-file");
  assert.match(regenerated.markdown, /anki-sync-file-id: example-file/);
  assert.match(regenerated.markdown, /anki-sync-id: example-card/);
  assert.match(regenerated.markdown, /anki-sync-id: indented-example/);
  assert.match(regenerated.markdown, /anki-sync-file-id: new-real-file/);
});

test("diagnoses multiple top-level file ids", () => {
  const diagnostics = diagnoseMarkdown([
    "<!-- anki-sync-file-id: first -->",
    "<!-- anki-sync-file-id: second -->"
  ].join("\n"));
  assert.ok(diagnostics.some((item) => item.severity === "error" && item.message.includes("多個")));
});

test("diagnoses duplicate ids and incomplete questions", () => {
  const source = [
    "Q: Missing answer",
    "",
    "First {{c1::one}}.",
    "<!-- anki-sync-id: duplicate -->",
    "",
    "Second {{c1::two}}.",
    "<!-- anki-sync-id: duplicate -->"
  ].join("\n");
  const diagnostics = diagnoseMarkdown(source);

  assert.ok(diagnostics.some((item) => item.severity === "error" && item.message.includes("重複")));
  assert.ok(diagnostics.some((item) => item.line === 1 && item.message.includes("缺少")));
});

test("diagnoses malformed image occlusion blocks", () => {
  const diagnostics = diagnoseMarkdown("IO: ![[heart.png]]\n<!-- MASK: 80, 80, 30, 30 -->");
  assert.ok(diagnostics.some((item) => item.line === 1 && item.message.includes("影像遮擋")));
});

test("diagnoses invalid single- and multiple-choice answers", () => {
  const diagnostics = diagnoseMarkdown([
    "QS: Invalid single",
    "- [-] A",
    "- [-] B",
    "",
    "QM: Invalid multiple",
    "- [ ] A",
    "- [ ] B"
  ].join("\n"));

  assert.ok(diagnostics.some((item) => item.line === 1 && item.message.includes("剛好")));
  assert.ok(diagnostics.some((item) => item.line === 5 && item.message.includes("至少")));
});

test("accepts consecutive masks without orphan diagnostics", () => {
  const source = [
    "IO: ![[heart.png]]",
    "<!-- MASK: 10, 10, 20, 20 -->",
    "<!-- MASK: 45, 30, 15, 15 -->",
    "A: 心臟構造"
  ].join("\n");
  const diagnostics = diagnoseMarkdown(source);
  assert.equal(diagnostics.filter((item) => item.message.includes("MASK 前沒有")).length, 0);
  assert.equal(diagnostics.filter((item) => item.message.includes("答案前沒有")).length, 0);
});

test("detects copied file and card ids across notes", () => {
  const current = collectMarkdownSyncIds(
    "<!-- anki-sync-file-id: same-file -->\n<!-- anki-sync-id: same-card -->"
  );
  const diagnostics = findCrossFileIdConflicts("copy.md", current, [{
    path: "original.md",
    ids: current
  }]);

  assert.equal(diagnostics.filter((item) => item.severity === "error").length, 2);
});

test("extracts Obsidian and Markdown media embeds", () => {
  const links = extractEmbeddedLinks(
    "![[diagram.png|600]]\n![recording](media/voice.mp3)\n![remote](https://example.com/a.png)"
  );
  assert.deepEqual(links, ["diagram.png", "media/voice.mp3"]);
});

test("matches same-named media by full resource path", () => {
  assert.equal(
    isExactMediaSourceMatch(
      "app://vault/folder-a/image.png",
      "",
      "app://vault/folder-a/image.png",
      "folder-a/image.png"
    ),
    true
  );
  assert.equal(
    isExactMediaSourceMatch(
      "app://vault/folder-b/image.png",
      "",
      "app://vault/folder-a/image.png",
      "folder-a/image.png"
    ),
    false
  );
});

test("preview mode preserves rendered media paths", async () => {
  const container = { innerHTML: '<img src="app://vault/image.png">' } as HTMLElement;
  const result = await rewriteEmbeddedMediaForAnki(
    {} as never,
    {} as never,
    "![[image.png]]",
    container,
    null
  );
  assert.equal(result.html, container.innerHTML);
  assert.equal(result.mediaCount, 0);
});

test("isolates notes by stable file id before using legacy tags", () => {
  const current = {
    noteId: 1,
    tags: ["obsidian_file_id_current", "obsidian_file_shared_md"]
  };
  const foreign = {
    noteId: 2,
    tags: ["obsidian_file_id_foreign", "obsidian_file_shared_md"]
  };
  const legacy = {
    noteId: 3,
    tags: ["obsidian_file_shared_md"]
  };
  const ambiguous = {
    noteId: 4,
    tags: [
      "obsidian_file_id_current",
      "obsidian_file_id_foreign",
      "obsidian_file_shared_md"
    ]
  };

  assert.equal(noteBelongsToFile(current, "current", "obsidian_file_shared_md"), true);
  assert.equal(noteBelongsToFile(foreign, "current", "obsidian_file_shared_md"), false);
  assert.equal(noteBelongsToFile(legacy, "current", "obsidian_file_shared_md"), true);
  assert.equal(noteBelongsToFile(ambiguous, "current", "obsidian_file_shared_md"), false);
});

test("only adopts unowned legacy notes that match an active card or registry entry", () => {
  const matchingCard = {
    noteId: 1,
    tags: ["obsidian_file_shared_md", "obsidian_sync_id_active"]
  };
  const registeredRemovedCard = {
    noteId: 2,
    tags: ["obsidian_file_shared_md", "obsidian_sync_id_removed"]
  };
  const ambiguousLegacyCard = {
    noteId: 3,
    tags: ["obsidian_file_shared_md", "obsidian_sync_id_other-file"]
  };
  const activeIds = new Set(["active"]);
  const registeredIds = new Set([2]);

  assert.equal(
    canSafelyAttributeLegacyNote(
      matchingCard,
      "current",
      "obsidian_file_shared_md",
      activeIds,
      registeredIds
    ),
    true
  );
  assert.equal(
    canSafelyAttributeLegacyNote(
      registeredRemovedCard,
      "current",
      "obsidian_file_shared_md",
      activeIds,
      registeredIds
    ),
    true
  );
  assert.equal(
    canSafelyAttributeLegacyNote(
      ambiguousLegacyCard,
      "current",
      "obsidian_file_shared_md",
      activeIds,
      registeredIds
    ),
    false
  );
});

test("finds obsolete legacy path tags without removing stable file ids", () => {
  assert.deepEqual(
    obsoleteLegacyFileTags(
      [
        "obsidian_file_old_md",
        "obsidian_file_current_md",
        "obsidian_file_id_file-123"
      ],
      "obsidian_file_current_md"
    ),
    ["obsidian_file_old_md"]
  );
});

test("creates stable content hash tags for incremental sync", async () => {
  const first = contentHashTag(await createContentHash({ Front: "Q", Back: "A" }));
  const second = contentHashTag(await createContentHash({ Front: "Q", Back: "A" }));
  const changed = contentHashTag(await createContentHash({ Front: "Q", Back: "B" }));

  assert.ok(first.startsWith(CONTENT_HASH_TAG_PREFIX));
  assert.equal(first, second);
  assert.notEqual(first, changed);
});

test("frontmatter overrides deck, merges tags and can disable syncing", () => {
  const config = resolveNoteFileConfigFromData({
    "anki-sync": false,
    "anki-deck": "CS::Algorithms",
    tags: ["course/cs", "#exam"],
    "anki-tags": "exam graph"
  }, { ...DEFAULT_SETTINGS, additionalTags: "obsidian study" });

  assert.equal(config.enabled, false);
  assert.equal(config.deckName, "CS::Algorithms");
  assert.deepEqual(config.tags, ["obsidian", "study", "course/cs", "exam", "graph"]);
});

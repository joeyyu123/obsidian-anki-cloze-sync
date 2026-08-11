import assert from "node:assert/strict";
import test from "node:test";
import {
  BASE_CARD_CSS,
  BASIC_CODE_BACK,
  BASIC_CODE_FRONT,
  CHOICE_BACK,
  CHOICE_FRONT,
  CLOZE_BACK,
  CLOZE_FRONT,
  IMAGE_OCCLUSION_BACK,
  IMAGE_OCCLUSION_FRONT,
  PLAIN_BASIC_BACK,
  PLAIN_BASIC_FRONT
} from "../src/anki-templates";

test("code practice front provides a multiline editor without answer comparison", () => {
  assert.match(BASIC_CODE_FRONT, /<textarea/);
  assert.match(BASIC_CODE_FRONT, /selectionStart/);
  assert.doesNotMatch(BASIC_CODE_FRONT, /\{\{type:Back}}/);
});

test("code practice back shows the draft and reference answer separately", () => {
  assert.match(BASIC_CODE_BACK, /你的作答/);
  assert.match(BASIC_CODE_BACK, /參考答案/);
  assert.match(BASIC_CODE_BACK, /\{\{Back}}/);
  assert.doesNotMatch(BASIC_CODE_BACK, /typeGood|typeBad|typeMissed/);
});

test("card styling supports responsive answer columns and night mode", () => {
  assert.match(BASE_CARD_CSS, /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(BASE_CARD_CSS, /@media \(max-width: 700px\)/);
  assert.match(BASE_CARD_CSS, /nightMode/);
  assert.match(BASE_CARD_CSS, /obsidian-source/);
});

test("card styling keeps display equations scrollable on narrow screens", () => {
  assert.match(BASE_CARD_CSS, /\.anki-math-block/);
  assert.match(BASE_CARD_CSS, /overflow-x:\s*auto/);
});

test("cloze templates share the review shell and keep source metadata on the back", () => {
  assert.match(CLOZE_FRONT, /review-shell--cloze/);
  assert.match(CLOZE_FRONT, /\{\{cloze:Text}}/);
  assert.match(CLOZE_BACK, /\{\{Back Extra}}/);
});

test("plain Q&A templates reveal the answer without a text input", () => {
  assert.match(PLAIN_BASIC_FRONT, /\{\{Front}}/);
  assert.doesNotMatch(PLAIN_BASIC_FRONT, /textarea|code-practice-input/);
  assert.match(PLAIN_BASIC_BACK, /參考答案/);
  assert.match(PLAIN_BASIC_BACK, /\{\{Back}}/);
});

test("choice templates preserve selections and classify review results", () => {
  assert.match(CHOICE_FRONT, /\{\{Question}}/);
  assert.match(CHOICE_FRONT, /data-mode="\{\{Mode}}"/);
  assert.match(CHOICE_FRONT, /sessionStorage/);
  assert.match(CHOICE_FRONT, /role.*checkbox/);
  assert.match(CHOICE_BACK, /is-correct/);
  assert.match(CHOICE_BACK, /is-incorrect/);
  assert.match(CHOICE_BACK, /is-missed/);
  assert.match(CHOICE_BACK, /\{\{#Explanation}}/);
  assert.match(CHOICE_BACK, /\{\{Back Extra}}/);
  for (const template of [CHOICE_FRONT, CHOICE_BACK]) {
    const script = template.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script);
    assert.doesNotThrow(() => Function(script));
  }
});

test("choice styling has selected, correct, incorrect and missed states", () => {
  assert.match(BASE_CARD_CSS, /\.choice-option\.is-selected/);
  assert.match(BASE_CARD_CSS, /\.choice-option\.is-correct/);
  assert.match(BASE_CARD_CSS, /\.choice-option\.is-incorrect/);
  assert.match(BASE_CARD_CSS, /\.choice-option\.is-missed/);
});

test("image occlusion templates render multiple mask markup and reveal sequentially", () => {
  assert.match(IMAGE_OCCLUSION_FRONT, /\{\{Image}}/);
  assert.match(IMAGE_OCCLUSION_FRONT, /\{\{Mask}}/);
  assert.match(IMAGE_OCCLUSION_BACK, /revealNext/);
  assert.match(IMAGE_OCCLUSION_BACK, /is-removing/);
  assert.doesNotMatch(IMAGE_OCCLUSION_BACK, /setTimeout\(revealNext/);
  assert.match(IMAGE_OCCLUSION_BACK, />揭示下一個</);
  assert.match(IMAGE_OCCLUSION_BACK, /\{\{#Answer}}/);
  assert.match(IMAGE_OCCLUSION_BACK, /\{\{Back Extra}}/);
});

test("image occlusion styling keeps masks aligned with responsive images", () => {
  assert.match(BASE_CARD_CSS, /\.image-occlusion-stage\s*\{[\s\S]*position:\s*relative/);
  assert.match(BASE_CARD_CSS, /\.image-occlusion-mask\s*\{[\s\S]*position:\s*absolute/);
  assert.match(BASE_CARD_CSS, /content:\s*attr\(data-order\)/);
  assert.match(BASE_CARD_CSS, /\.image-occlusion-mask\.is-removing/);
  assert.match(BASE_CARD_CSS, /\.image-occlusion-stage > img[\s\S]*width:\s*100%/);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildImageOcclusionCardMarkdown,
  findImageOcclusionCardAtLine,
  moveImageOcclusionMask,
  resizeImageOcclusionMask
} from "../src/image-occlusion-utils";
import { parseImageOcclusionCards } from "../src/parser";

test("finds an existing image occlusion card from its image, mask, answer, or id line", () => {
  const source = [
    "Introduction",
    "",
    "IO: ![[heart.png]]",
    "<!-- MASK: 10, 20, 30, 15 -->",
    "A: 左心室",
    "<!-- anki-sync-id: heart-card -->",
    "",
    "Conclusion"
  ].join("\n");

  for (const line of [2, 3, 4, 5]) {
    assert.equal(findImageOcclusionCardAtLine(source, line)?.id, "heart-card");
  }
  assert.equal(findImageOcclusionCardAtLine(source, 1), null);
  assert.equal(findImageOcclusionCardAtLine(source, 6), null);
});

test("rebuilds an edited card while preserving the image source and sync id", () => {
  const markdown = buildImageOcclusionCardMarkdown(
    "![[anatomy/heart.png|600]]",
    [
      { x: 12.345, y: 20, width: 30, height: 15 },
      { x: 55, y: 42, width: 18, height: 12 }
    ],
    "左心室\n負責將血液送往全身",
    "heart-card"
  );
  const [card] = parseImageOcclusionCards(markdown);

  assert.match(markdown, /MASK: 12\.35, 20, 30, 15/);
  assert.equal(card?.imageMarkdown, "![[anatomy/heart.png|600]]");
  assert.equal(card?.answerMarkdown, "左心室\n負責將血液送往全身");
  assert.equal(card?.id, "heart-card");
  assert.equal(card?.masks.length, 2);
});

test("moves masks without allowing them outside the image", () => {
  const mask = { x: 10, y: 20, width: 30, height: 40 };

  assert.deepEqual(moveImageOcclusionMask(mask, -50, 80), {
    x: 0,
    y: 60,
    width: 30,
    height: 40
  });
});

test("resizes masks from every corner with a one-percent minimum size", () => {
  const mask = { x: 20, y: 20, width: 30, height: 30 };

  assert.deepEqual(resizeImageOcclusionMask(mask, -10, -5, "resize-nw"), {
    x: 10,
    y: 15,
    width: 40,
    height: 35
  });
  assert.deepEqual(resizeImageOcclusionMask(mask, -50, -50, "resize-se"), {
    x: 20,
    y: 20,
    width: 1,
    height: 1
  });
  assert.deepEqual(resizeImageOcclusionMask(mask, 80, 80, "resize-se"), {
    x: 20,
    y: 20,
    width: 80,
    height: 80
  });
});

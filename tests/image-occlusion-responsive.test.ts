import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const editorSource = readFileSync(
  new URL("../src/image-occlusion.ts", import.meta.url),
  "utf8"
);
const pluginStyles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("image occlusion editor responds to modal and viewport size changes", () => {
  assert.match(editorSource, /modalEl\.addClass\("anki-image-occlusion-modal"\)/);
  assert.match(editorSource, /new ResizeObserver\(fitStageToViewport\)/);
  assert.match(editorSource, /viewportResizeObserver\?\.disconnect\(\)/);
  assert.match(
    pluginStyles,
    /\.modal\.anki-image-occlusion-modal\s*\{[\s\S]*max-height:\s*min\(94dvh,\s*920px\)/
  );
  assert.match(
    pluginStyles,
    /\.is-mobile \.modal\.anki-image-occlusion-modal\s*\{[\s\S]*height:\s*100dvh/
  );
});

test("narrow image occlusion controls collapse without horizontal overflow", () => {
  assert.match(pluginStyles, /@media \(max-width:\s*620px\)/);
  assert.match(
    pluginStyles,
    /\.anki-image-occlusion-mask-list\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/
  );
  assert.match(
    pluginStyles,
    /\.anki-image-occlusion-actions \.setting-item-control\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
  );
  assert.match(
    pluginStyles,
    /\.anki-image-occlusion-answer textarea\s*\{[\s\S]*width:\s*100%/
  );
});

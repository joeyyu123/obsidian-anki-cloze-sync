import { writeFile } from "node:fs/promises";
import {
  BASE_CARD_CSS,
  BASIC_CODE_BACK,
  BASIC_CODE_FRONT,
  CLOZE_BACK,
  IMAGE_OCCLUSION_BACK,
  IMAGE_OCCLUSION_FRONT,
  PLAIN_BASIC_BACK,
  PLAIN_BASIC_FRONT
} from "../src/anki-templates";

const question = `
<h2>請實作 Min Heap 的 <code>push</code> 操作</h2>
<p>加入新節點後，維持完全二元樹結構與 heap property，並分析時間複雜度。</p>`;
const reference = `
<pre><code>push(value: number): void {
  this.heap.push(value);
  let index = this.heap.length - 1;

  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (this.heap[parent] &lt;= this.heap[index]) break;
    [this.heap[parent], this.heap[index]] =
      [this.heap[index], this.heap[parent]];
    index = parent;
  }
}</code></pre>
<p>時間複雜度：<code>O(log n)</code></p>
<div class="obsidian-source"><a href="#">在 Obsidian 開啟「Heap」</a></div>`;
const cloze = `
<p>Min Heap 的每個父節點都必須 <span class="cloze">小於或等於</span> 它的子節點，因此根節點保存全域最小值。</p>`;
const plainQuestion = `
<h2>Min Heap 的根節點保存什麼？</h2>
<p>先在心中作答，再顯示答案。</p>`;
const plainAnswer = `
<p>根節點保存整棵 Min Heap 的<strong>最小值</strong>。</p>
<div class="obsidian-source"><a href="#">在 Obsidian 開啟「Heap」</a></div>`;
const occlusionSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480">
  <rect width="800" height="480" fill="#dfe9e4"/>
  <path d="M405 392C258 307 208 229 240 151c28-68 117-71 165-8 49-63 138-60 166 8 32 78-18 156-166 241Z" fill="#b8534f" stroke="#7d3335" stroke-width="10"/>
  <path d="M405 149c-18 61-13 141 9 231M309 142c38 43 55 94 48 154M505 142c-38 43-55 94-48 154" fill="none" stroke="#f1c7b8" stroke-width="13" stroke-linecap="round"/>
  <circle cx="318" cy="207" r="28" fill="#e9ae91"/><circle cx="493" cy="207" r="28" fill="#e9ae91"/>
  <text x="400" y="445" text-anchor="middle" font-family="serif" font-size="26" fill="#344a43">HEART / STRUCTURE STUDY</text>
</svg>`;
const occlusionImage = `<img alt="心臟構造示意圖" src="data:image/svg+xml;base64,${Buffer.from(occlusionSvg).toString("base64")}">`;

const replaceFields = (template: string, fields: Record<string, string>): string =>
  Object.entries(fields).reduce(
    (result, [field, value]) => result.replaceAll(`{{${field}}}`, value),
    template
  );

const front = replaceFields(BASIC_CODE_FRONT, { Front: question });
const back = replaceFields(BASIC_CODE_BACK, { Front: question, Back: reference })
  .replace('<code id="code-draft-output"></code>', `<code id="code-draft-output">push(value) {
  // TODO: bubble up
}</code>`)
  .replace(/<script>[\s\S]*?<\/script>/g, "");
const clozeCard = replaceFields(CLOZE_BACK, {
  "cloze:Text": cloze,
  "Back Extra": `<div>來源：Data Structures/Heap.md</div>${reference.match(/<div class="obsidian-source">[\s\S]*<\/div>/)?.[0] ?? ""}`
});
const plainFront = replaceFields(PLAIN_BASIC_FRONT, { Front: plainQuestion });
const plainBack = replaceFields(PLAIN_BASIC_BACK, {
  Front: plainQuestion,
  Back: plainAnswer
});
const occlusionFields = {
  Image: occlusionImage,
  Mask: [
    '<span class="image-occlusion-mask" data-order="1" style="left:23%;top:28%;width:16%;height:18%;" aria-label="影像遮擋區域 1"></span>',
    '<span class="image-occlusion-mask" data-order="2" style="left:61%;top:28%;width:16%;height:18%;" aria-label="影像遮擋區域 2"></span>',
    '<span class="image-occlusion-mask" data-order="3" style="left:45%;top:52%;width:18%;height:24%;" aria-label="影像遮擋區域 3"></span>'
  ].join(""),
  Answer: "<p><strong>心臟構造</strong>：依序辨識左右心房與心室。</p>",
  "Back Extra": `<div class="obsidian-source"><a href="#">在 Obsidian 開啟「Anatomy」</a></div>`
};
const occlusionFront = replaceFields(IMAGE_OCCLUSION_FRONT, occlusionFields);
const occlusionBack = replaceFields(IMAGE_OCCLUSION_BACK, occlusionFields)
  .replace("{{#Answer}}", "")
  .replace("{{/Answer}}", "");

const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Anki Card Preview</title>
  <style>
    ${BASE_CARD_CSS}
    body { margin: 0; background: #0d1110; }
    .preview-heading { margin: 0; padding: 28px 32px 0; color: #d9e2dd; font: 700 12px/1.4 ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; }
    .preview-grid { display: grid; grid-template-columns: repeat(2, minmax(420px, 1fr)); gap: 24px; padding: 24px; align-items: start; }
    .preview-grid > .card { min-height: 780px; border-radius: 22px; overflow: auto; }
    .preview-grid > .card.cloze-preview { grid-column: 1 / -1; min-height: 540px; }
    @media (max-width: 980px) { .preview-grid { grid-template-columns: 1fr; padding: 12px; } .preview-grid > .card.cloze-preview { grid-column: auto; } }
  </style>
</head>
<body>
  <h1 class="preview-heading">Anki Flashcard Sync · Card System Preview</h1>
  <div class="preview-grid">
    <section class="card">${front}</section>
    <section class="card nightMode">${back}</section>
    <section class="card">${plainFront}</section>
    <section class="card nightMode">${plainBack}</section>
    <section class="card">${occlusionFront}</section>
    <section class="card nightMode">${occlusionBack}</section>
    <section class="card cloze-preview">${clozeCard}</section>
  </div>
</body>
</html>`;

await writeFile(new URL("../card-preview.html", import.meta.url), html, "utf8");
console.log("Generated card-preview.html");

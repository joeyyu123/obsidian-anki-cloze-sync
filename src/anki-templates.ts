export const BASE_CARD_CSS = `
.card {
  --paper: #f2efe5;
  --paper-raised: #fbfaf6;
  --ink: #17201e;
  --muted: #68716d;
  --line: #d8d3c5;
  --teal: #087f73;
  --teal-soft: #d9ebe6;
  --amber: #c96a24;
  --success: #24745f;
  --success-soft: #dcece5;
  --danger: #a64235;
  --danger-soft: #f2dfdb;
  --editor: #18201f;
  --editor-raised: #222c2a;
  --editor-ink: #eef5ef;
  --editor-muted: #a8b7b1;
  --serif: "Iowan Old Style", "Palatino Linotype", "Noto Serif TC", Georgia, serif;
  --mono: "SFMono-Regular", "Cascadia Code", Consolas, "Liberation Mono", Menlo, monospace;

  box-sizing: border-box;
  min-height: 100vh;
  margin: 0;
  padding: clamp(18px, 4vw, 48px);
  color: var(--ink);
  background:
    radial-gradient(circle at 12% 8%, rgba(8, 127, 115, 0.08), transparent 28rem),
    linear-gradient(rgba(23, 32, 30, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(23, 32, 30, 0.025) 1px, transparent 1px),
    var(--paper);
  background-size: auto, 24px 24px, 24px 24px, auto;
  font-family: var(--serif);
  font-size: clamp(18px, 2.1vw, 22px);
  line-height: 1.65;
  text-align: left;
}

.card *, .card *::before, .card *::after { box-sizing: border-box; }

.nightMode.card,
.night_mode.card {
  --paper: #121715;
  --paper-raised: #19201e;
  --ink: #edf0e8;
  --muted: #a1aaa5;
  --line: #35403c;
  --teal: #5cc4b3;
  --teal-soft: #1b3934;
  --amber: #f0a15d;
  --success: #72cbb0;
  --success-soft: #18382f;
  --danger: #ef8f80;
  --danger-soft: #432622;
  --editor: #0c1110;
  --editor-raised: #151c1a;
  --editor-ink: #f2f5ef;
  --editor-muted: #98aaa3;
  background:
    radial-gradient(circle at 12% 8%, rgba(92, 196, 179, 0.09), transparent 28rem),
    linear-gradient(rgba(237, 240, 232, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(237, 240, 232, 0.025) 1px, transparent 1px),
    var(--paper);
  background-size: auto, 24px 24px, 24px 24px, auto;
}

.review-shell {
  width: min(100%, 980px);
  margin: 0 auto;
  animation: card-enter 260ms ease-out both;
}

.review-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
  font-family: var(--mono);
}

.review-identity { display: flex; align-items: center; gap: 11px; min-width: 0; }
.review-mark {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--ink);
  border-radius: 50%;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: -0.04em;
}
.review-kicker {
  overflow: hidden;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}
.review-state {
  flex: 0 0 auto;
  padding: 5px 9px;
  border-radius: 999px;
  color: var(--teal);
  background: var(--teal-soft);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 10px;
  color: var(--muted);
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.section-label::after { content: ""; height: 1px; flex: 1; background: var(--line); }
.section-number { color: var(--amber); }

.prompt-panel {
  position: relative;
  margin-bottom: 22px;
  padding: clamp(20px, 4vw, 34px);
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 3px 18px 18px 3px;
  background: var(--paper-raised);
  box-shadow: 0 18px 45px rgba(23, 32, 30, 0.06);
}
.prompt-panel::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--teal);
}
.prompt-content { max-width: 78ch; }
.prompt-content > :first-child { margin-top: 0; }
.prompt-content > :last-child { margin-bottom: 0; }
.prompt-content h1,
.prompt-content h2,
.prompt-content h3 { line-height: 1.25; }

.workspace-panel {
  position: relative;
  padding: 16px;
  overflow: hidden;
  border: 1px solid #2f3b38;
  border-radius: 18px 4px 18px 18px;
  color: var(--editor-ink);
  background: var(--editor);
  box-shadow: 0 24px 55px rgba(11, 16, 15, 0.22);
}
.workspace-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 0 2px;
  color: var(--editor-muted);
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.08em;
}
.workspace-dots { display: flex; gap: 6px; }
.workspace-dots i { display: block; width: 7px; height: 7px; border-radius: 50%; background: #596662; }
.workspace-dots i:first-child { background: var(--amber); }
.workspace-language { text-transform: uppercase; }

.code-practice-input {
  display: block;
  width: 100%;
  min-height: clamp(280px, 42vh, 500px);
  padding: clamp(15px, 2.5vw, 24px);
  border: 1px solid #34413e;
  border-radius: 10px;
  outline: none;
  resize: vertical;
  tab-size: 4;
  color: var(--editor-ink);
  background:
    linear-gradient(90deg, rgba(92, 196, 179, 0.03), transparent 30%),
    var(--editor-raised);
  caret-color: #78d8c6;
  font-family: var(--mono);
  font-size: clamp(14px, 1.8vw, 17px);
  line-height: 1.65;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.code-practice-input:focus {
  border-color: #5cc4b3;
  box-shadow: 0 0 0 3px rgba(92, 196, 179, 0.14);
}
.code-practice-input::placeholder { color: #71817b; }
.code-practice-hint {
  margin: 11px 4px 0;
  color: var(--editor-muted);
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.025em;
}
.keycap {
  display: inline-block;
  margin: 0 2px;
  padding: 1px 5px;
  border: 1px solid #53605c;
  border-bottom-width: 2px;
  border-radius: 4px;
  color: var(--editor-ink);
  background: #293431;
}

.answer-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}
.answer-column {
  min-width: 0;
  padding: clamp(16px, 2.5vw, 24px);
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--paper-raised);
}
.answer-column--draft { border-top: 3px solid var(--teal); }
.answer-column--reference { border-top: 3px solid var(--amber); }
.answer-column pre,
.prompt-content pre,
.cloze-content pre {
  max-width: 100%;
  overflow-x: auto;
  padding: 15px;
  border: 1px solid #34413e;
  border-radius: 9px;
  tab-size: 4;
  color: var(--editor-ink);
  background: var(--editor);
  font-family: var(--mono);
  font-size: 0.72em;
  line-height: 1.6;
  white-space: pre;
}
.answer-column code,
.prompt-content code,
.cloze-content code { font-family: var(--mono); }
.answer-column :not(pre) > code,
.prompt-content :not(pre) > code,
.cloze-content :not(pre) > code {
  padding: 0.12em 0.35em;
  border-radius: 4px;
  color: var(--teal);
  background: var(--teal-soft);
  font-size: 0.82em;
}
#code-draft-output { white-space: pre; }

.cloze-panel { padding: clamp(24px, 5vw, 48px); }
.cloze-content { max-width: 72ch; font-size: clamp(21px, 3.1vw, 30px); line-height: 1.7; }
.cloze {
  display: inline;
  padding: 0 0.12em;
  color: var(--teal);
  background: linear-gradient(transparent 62%, var(--teal-soft) 62%);
  font-weight: 800;
}
.cloze-meta {
  margin-top: 18px;
  padding: 15px 18px;
  border: 1px dashed var(--line);
  border-radius: 10px;
  color: var(--muted);
  background: var(--paper-raised);
  font-family: var(--mono);
  font-size: 11px;
}

.recall-instruction {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  color: var(--muted);
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.04em;
}
.recall-instruction::before {
  content: "";
  width: 28px;
  height: 1px;
  flex: 0 0 auto;
  background: var(--amber);
}
.standard-answer-panel {
  position: relative;
  padding: clamp(22px, 4vw, 38px);
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 18px 3px 18px 18px;
  background: var(--paper-raised);
  box-shadow: 0 18px 45px rgba(23, 32, 30, 0.06);
}
.standard-answer-panel::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 4px;
  background: var(--amber);
}
.standard-answer-content {
  max-width: 78ch;
  font-size: clamp(19px, 2.5vw, 25px);
  line-height: 1.75;
}
.standard-answer-content > :first-child { margin-top: 0; }
.standard-answer-content > :last-child { margin-bottom: 0; }
.standard-answer-content pre {
  max-width: 100%;
  overflow-x: auto;
  padding: 15px;
  border: 1px solid #34413e;
  border-radius: 9px;
  color: var(--editor-ink);
  background: var(--editor);
  font-family: var(--mono);
  font-size: 0.68em;
  line-height: 1.6;
}

.choice-board {
  position: relative;
  padding: clamp(14px, 2.5vw, 22px);
  border: 1px solid var(--line);
  border-radius: 18px 4px 18px 18px;
  background:
    linear-gradient(90deg, transparent 0 42px, rgba(201, 106, 36, 0.12) 42px 43px, transparent 43px),
    repeating-linear-gradient(0deg, transparent 0 47px, rgba(23, 32, 30, 0.035) 47px 48px),
    var(--paper-raised);
  box-shadow: 0 18px 45px rgba(23, 32, 30, 0.06);
}
.choice-list { display: grid; gap: 10px; }
.choice-option {
  position: relative;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  min-height: 62px;
  padding: 10px 14px 10px 8px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 9px 14px 14px 9px;
  outline: none;
  color: var(--ink);
  background: var(--paper-raised);
  box-shadow: 0 3px 0 rgba(23, 32, 30, 0.035);
  cursor: pointer;
  user-select: none;
  transition: transform 140ms ease, border-color 140ms ease, background 140ms ease, box-shadow 140ms ease;
}
.choice-option:hover { border-color: var(--teal); transform: translateX(3px); }
.choice-option:focus-visible { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(8, 127, 115, 0.18); }
.choice-option.is-selected {
  border-color: var(--teal);
  background: var(--teal-soft);
  box-shadow: inset 4px 0 0 var(--teal), 0 4px 12px rgba(8, 127, 115, 0.1);
}
.choice-option-marker {
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 50%;
  color: var(--muted);
  background: var(--paper);
  font: 800 10px/1 var(--mono);
  transition: color 140ms ease, border-color 140ms ease, background 140ms ease;
}
.choice-list[data-mode="multiple"] .choice-option-marker { border-radius: 7px; }
.choice-option.is-selected .choice-option-marker { border-color: var(--teal); color: var(--paper-raised); background: var(--teal); }
.choice-option-content { min-width: 0; font-size: clamp(17px, 2.1vw, 21px); line-height: 1.55; }
.choice-option-content > :first-child { margin-top: 0; }
.choice-option-content > :last-child { margin-bottom: 0; }
.choice-option-result {
  display: none;
  margin-left: 10px;
  padding: 4px 7px;
  border-radius: 999px;
  font: 800 9px/1.2 var(--mono);
  letter-spacing: 0.08em;
  white-space: nowrap;
}
.choice-option.is-correct { border-color: var(--success); background: var(--success-soft); box-shadow: inset 4px 0 0 var(--success); }
.choice-option.is-correct .choice-option-marker { border-color: var(--success); color: var(--paper-raised); background: var(--success); }
.choice-option.is-correct .choice-option-result { display: inline-block; color: var(--paper-raised); background: var(--success); }
.choice-option.is-incorrect { border-color: var(--danger); background: var(--danger-soft); box-shadow: inset 4px 0 0 var(--danger); }
.choice-option.is-incorrect .choice-option-marker { border-color: var(--danger); color: var(--paper-raised); background: var(--danger); }
.choice-option.is-incorrect .choice-option-result { display: inline-block; color: var(--paper-raised); background: var(--danger); }
.choice-option.is-missed { border-style: dashed; border-color: var(--amber); background: var(--paper-raised); }
.choice-option.is-missed .choice-option-marker { border-color: var(--amber); color: var(--paper-raised); background: var(--amber); }
.choice-option.is-missed .choice-option-result { display: inline-block; color: var(--paper-raised); background: var(--amber); }
.choice-answer-summary {
  margin-bottom: 14px;
  padding: 10px 13px;
  border-left: 3px solid var(--teal);
  color: var(--muted);
  background: var(--teal-soft);
  font: 700 10px/1.55 var(--mono);
  letter-spacing: 0.025em;
}
.choice-explanation { margin-top: 18px; }
.choice-explanation .standard-answer-content { font-size: clamp(17px, 2.2vw, 22px); }
.choice-mode-hint { color: var(--teal); font-weight: 800; }

.image-occlusion-panel {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 220px;
  padding: clamp(14px, 3vw, 28px);
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 3px 18px 18px 3px;
  background:
    linear-gradient(45deg, rgba(23, 32, 30, 0.035) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(23, 32, 30, 0.035) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(23, 32, 30, 0.035) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(23, 32, 30, 0.035) 75%),
    var(--paper-raised);
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  background-size: 16px 16px;
  box-shadow: 0 18px 45px rgba(23, 32, 30, 0.08);
}
.image-occlusion-stage {
  position: relative;
  display: block;
  width: 100%;
  max-width: 980px;
  overflow: hidden;
  border-radius: 8px;
  line-height: 0;
  box-shadow: 0 12px 32px rgba(11, 16, 15, 0.2);
}
.image-occlusion-stage > img {
  display: block;
  width: 100%;
  max-width: none;
  height: auto;
  margin: 0;
}
.image-occlusion-mask-data { display: none !important; }
.image-occlusion-mask {
  position: absolute;
  z-index: 2;
  display: block;
  border: 2px solid #0e5f57;
  border-radius: 5px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.12), transparent 42%),
    var(--teal);
  box-shadow: 0 4px 16px rgba(8, 70, 64, 0.34), inset 0 0 0 1px rgba(255, 255, 255, 0.16);
  transition: opacity 320ms ease, transform 320ms ease, filter 320ms ease;
}
.image-occlusion-mask::after {
  content: attr(data-order);
  position: absolute;
  inset: 50% auto auto 50%;
  color: #f7fffc;
  font-family: var(--mono);
  font-size: clamp(14px, 2.5vw, 24px);
  font-weight: 800;
  line-height: 1;
  transform: translate(-50%, -50%);
}
.image-occlusion-mask.is-removing {
  opacity: 0;
  filter: blur(3px);
  transform: scale(0.82);
}
.image-occlusion-mask--revealed {
  border: 3px solid var(--amber);
  background: rgba(201, 106, 36, 0.08);
  box-shadow: 0 0 0 2px rgba(251, 250, 246, 0.88), 0 5px 18px rgba(11, 16, 15, 0.2);
}
.image-occlusion-mask--revealed::after { content: none; }
.image-occlusion-reveal-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 15px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  color: var(--muted);
  background: var(--paper-raised);
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.04em;
}
.image-occlusion-reveal-controls button {
  padding: 8px 12px;
  border: 1px solid var(--teal);
  border-radius: 999px;
  color: var(--paper-raised);
  background: var(--teal);
  font: 700 10px/1.2 var(--mono);
  letter-spacing: 0.04em;
  cursor: pointer;
}
.image-occlusion-reveal-controls button:disabled {
  border-color: var(--line);
  color: var(--muted);
  background: var(--paper);
  cursor: default;
}
.image-occlusion-answer.is-pending {
  max-height: 0;
  margin-top: 0;
  padding-top: 0;
  padding-bottom: 0;
  overflow: hidden;
  border-width: 0;
  opacity: 0;
}
.image-occlusion-answer.is-visible {
  animation: image-answer-enter 300ms ease-out both;
}
.image-occlusion-answer {
  margin-top: 18px;
  border-top: 3px solid var(--amber);
}
.image-occlusion-answer .standard-answer-content { font-size: clamp(17px, 2.2vw, 23px); }
.image-occlusion-meta {
  margin-top: 18px;
  color: var(--muted);
  font-family: var(--mono);
  font-size: 11px;
}

.obsidian-source {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-family: var(--mono);
  font-size: 10px;
}
.obsidian-source::before { content: "SOURCE"; letter-spacing: 0.14em; }
.obsidian-source a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--teal);
  background: var(--paper-raised);
  font-weight: 700;
  text-decoration: none;
}
.obsidian-source a::after { content: "↗"; }

.anki-math-inline {
  display: inline-block;
  max-width: 100%;
  vertical-align: -0.08em;
}
.anki-math-block {
  display: block;
  max-width: 100%;
  margin: 1.15rem 0;
  overflow-x: auto;
  overflow-y: hidden;
  text-align: center;
  -webkit-overflow-scrolling: touch;
}
.anki-math-block mjx-container { min-width: max-content; }

@keyframes card-enter {
  from { opacity: 0; transform: translateY(7px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes image-answer-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 700px) {
  .card { padding: 14px; font-size: 18px; background-size: auto, 20px 20px, 20px 20px, auto; }
  .review-header { margin-bottom: 15px; }
  .review-kicker { letter-spacing: 0.1em; }
  .prompt-panel { margin-bottom: 14px; border-radius: 3px 13px 13px 3px; }
  .workspace-panel { padding: 10px; border-radius: 13px 3px 13px 13px; }
  .code-practice-input { min-height: 48vh; padding: 14px; }
  .answer-grid { grid-template-columns: 1fr; }
  .choice-board { padding: 10px; background-position: -8px 0, 0 0, 0 0; }
  .choice-option { grid-template-columns: 38px minmax(0, 1fr); padding-right: 10px; }
  .choice-option-result { grid-column: 2; width: max-content; margin: 6px 0 0; }
  .image-occlusion-reveal-controls { align-items: stretch; flex-direction: column; }
  .image-occlusion-reveal-controls button { width: 100%; }
  .obsidian-source { align-items: flex-start; flex-direction: column; }
}

@media (prefers-reduced-motion: reduce) {
  .review-shell { animation: none; }
  .code-practice-input { transition: none; }
  .image-occlusion-mask { transition: none; }
  .image-occlusion-answer.is-visible { animation: none; }
}
`;

export const BASIC_CODE_CSS = BASE_CARD_CSS;

export const BASIC_CODE_FRONT = `
<main class="review-shell review-shell--practice">
  <header class="review-header">
    <div class="review-identity">
      <span class="review-mark">DS</span>
      <span class="review-kicker">Data Structure Practice Lab</span>
    </div>
    <span class="review-state">Draft</span>
  </header>

  <section class="prompt-panel">
    <div class="section-label"><span class="section-number">01</span> 問題</div>
    <div class="prompt-content">{{Front}}</div>
  </section>

  <section class="workspace-panel">
    <div class="workspace-toolbar">
      <span class="workspace-dots"><i></i><i></i><i></i></span>
      <span class="workspace-language">solution.draft</span>
    </div>
    <textarea id="code-practice-input" class="code-practice-input" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="程式碼作答區" placeholder="// 在這裡推導並撰寫你的解法…"></textarea>
    <div class="code-practice-hint"><span class="keycap">Tab</span> 縮排四格 · 完成後點擊 Anki 的「顯示答案」</div>
  </section>
</main>
<script>
(() => {
  const storageKey = "obsidian-anki-code-draft";
  const input = document.getElementById("code-practice-input");
  if (!input) return;
  window.__obsidianAnkiCodeDraft = "";
  try { sessionStorage.setItem(storageKey, ""); } catch (_) {}
  input.addEventListener("input", () => {
    window.__obsidianAnkiCodeDraft = input.value;
    try { sessionStorage.setItem(storageKey, input.value); } catch (_) {}
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.setRangeText("    ", start, end, "end");
    input.dispatchEvent(new Event("input"));
  });
  window.setTimeout(() => input.focus(), 0);
})();
</script>
`;

export const BASIC_CODE_BACK = `
<main class="review-shell review-shell--answer">
  <header class="review-header">
    <div class="review-identity">
      <span class="review-mark">DS</span>
      <span class="review-kicker">Data Structure Practice Lab</span>
    </div>
    <span class="review-state">Reflect</span>
  </header>

  <section class="prompt-panel">
    <div class="section-label"><span class="section-number">01</span> 問題</div>
    <div class="prompt-content">{{Front}}</div>
  </section>

  <section id="answer" class="answer-grid">
    <article class="answer-column answer-column--draft">
      <div class="section-label"><span class="section-number">02</span> 你的作答</div>
      <pre><code id="code-draft-output"></code></pre>
    </article>
    <article class="answer-column answer-column--reference">
      <div class="section-label"><span class="section-number">03</span> 參考答案</div>
      <div class="reference-content">{{Back}}</div>
    </article>
  </section>
</main>
<script>
(() => {
  const storageKey = "obsidian-anki-code-draft";
  const output = document.getElementById("code-draft-output");
  if (!output) return;
  let draft = window.__obsidianAnkiCodeDraft || "";
  try { draft = sessionStorage.getItem(storageKey) || draft; } catch (_) {}
  output.textContent = draft || "（未作答）";
})();
</script>
`;

export const PLAIN_BASIC_FRONT = `
<main class="review-shell review-shell--basic">
  <header class="review-header">
    <div class="review-identity">
      <span class="review-mark">QA</span>
      <span class="review-kicker">Focused Recall Card</span>
    </div>
    <span class="review-state">Recall</span>
  </header>
  <section class="prompt-panel">
    <div class="section-label"><span class="section-number">01</span> 問題</div>
    <div class="prompt-content">{{Front}}</div>
  </section>
  <div class="recall-instruction">先在腦中組織答案，再點擊 Anki 的「顯示答案」</div>
</main>
`;

export const PLAIN_BASIC_BACK = `
<main class="review-shell review-shell--basic">
  <header class="review-header">
    <div class="review-identity">
      <span class="review-mark">QA</span>
      <span class="review-kicker">Focused Recall Card</span>
    </div>
    <span class="review-state">Answer</span>
  </header>
  <section class="prompt-panel">
    <div class="section-label"><span class="section-number">01</span> 問題</div>
    <div class="prompt-content">{{Front}}</div>
  </section>
  <section id="answer" class="standard-answer-panel">
    <div class="section-label"><span class="section-number">02</span> 參考答案</div>
    <div class="standard-answer-content">{{Back}}</div>
  </section>
</main>
`;

export const CHOICE_FRONT = `
<main class="review-shell review-shell--choice">
  <header class="review-header">
    <div class="review-identity">
      <span class="review-mark">CH</span>
      <span class="review-kicker">Decision Practice Sheet</span>
    </div>
    <span class="review-state">Choose</span>
  </header>
  <section class="prompt-panel">
    <div class="section-label"><span class="section-number">01</span> 題目</div>
    <div class="prompt-content">{{Question}}</div>
  </section>
  <section class="choice-board">
    <div class="section-label"><span class="section-number">02</span> 作答</div>
    <div id="choice-front-list" class="choice-list" data-mode="{{Mode}}">{{Options}}</div>
  </section>
  <div class="recall-instruction"><span class="choice-mode-hint" id="choice-mode-hint"></span>選好後，點擊 Anki 的「顯示答案」</div>
</main>
<script>
(() => {
  const storageKey = "obsidian-anki-choice-selection";
  const list = document.getElementById("choice-front-list");
  const hint = document.getElementById("choice-mode-hint");
  if (!list) return;
  const mode = list.getAttribute("data-mode") === "multiple" ? "multiple" : "single";
  const options = Array.from(list.querySelectorAll(".choice-option"));
  let selected = [];
  try { sessionStorage.setItem(storageKey, "[]"); } catch (_) {}
  if (hint) hint.textContent = mode === "multiple" ? "多選題 · 可選多項 · " : "單選題 · 選一項 · ";

  const persist = () => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(selected)); } catch (_) {}
    window.__obsidianAnkiChoiceSelection = selected.slice();
  };
  const render = () => {
    options.forEach((option, index) => {
      const active = selected.includes(index);
      option.classList.toggle("is-selected", active);
      option.setAttribute("aria-checked", String(active));
    });
  };
  const choose = (index) => {
    if (mode === "single") selected = [index];
    else selected = selected.includes(index)
      ? selected.filter((value) => value !== index)
      : selected.concat(index);
    render();
    persist();
  };

  options.forEach((option, index) => {
    option.setAttribute("role", mode === "multiple" ? "checkbox" : "radio");
    option.setAttribute("tabindex", "0");
    option.setAttribute("aria-checked", "false");
    option.addEventListener("click", () => choose(index));
    option.addEventListener("keydown", (event) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      choose(index);
    });
  });
  persist();
})();
</script>
`;

export const CHOICE_BACK = `
<main class="review-shell review-shell--choice">
  <header class="review-header">
    <div class="review-identity">
      <span class="review-mark">CH</span>
      <span class="review-kicker">Decision Practice Sheet</span>
    </div>
    <span class="review-state">Review</span>
  </header>
  <section class="prompt-panel">
    <div class="section-label"><span class="section-number">01</span> 題目</div>
    <div class="prompt-content">{{Question}}</div>
  </section>
  <section class="choice-board">
    <div class="section-label"><span class="section-number">02</span> 作答結果</div>
    <div id="choice-answer-summary" class="choice-answer-summary" aria-live="polite">正在核對答案…</div>
    <div id="choice-back-list" class="choice-list" data-mode="{{Mode}}">{{Options}}</div>
  </section>
  {{#Explanation}}
  <section class="standard-answer-panel choice-explanation">
    <div class="section-label"><span class="section-number">03</span> 詳解</div>
    <div class="standard-answer-content">{{Explanation}}</div>
  </section>
  {{/Explanation}}
  <section class="image-occlusion-meta">{{Back Extra}}</section>
</main>
<script>
(() => {
  const storageKey = "obsidian-anki-choice-selection";
  const list = document.getElementById("choice-back-list");
  const summary = document.getElementById("choice-answer-summary");
  if (!list) return;
  const options = Array.from(list.querySelectorAll(".choice-option"));
  let selected = Array.isArray(window.__obsidianAnkiChoiceSelection)
    ? window.__obsidianAnkiChoiceSelection
    : [];
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
    if (Array.isArray(stored)) selected = stored.filter((value) => Number.isInteger(value));
  } catch (_) {}

  let correctSelections = 0;
  let wrongSelections = 0;
  let missed = 0;
  options.forEach((option, index) => {
    const correct = option.getAttribute("data-correct") === "true";
    const chosen = selected.includes(index);
    const result = option.querySelector(".choice-option-result");
    option.removeAttribute("tabindex");
    option.setAttribute("aria-disabled", "true");
    if (chosen && correct) {
      correctSelections += 1;
      option.classList.add("is-correct");
      if (result) result.textContent = "正確";
    } else if (chosen) {
      wrongSelections += 1;
      option.classList.add("is-incorrect");
      if (result) result.textContent = "選錯";
    } else if (correct) {
      missed += 1;
      option.classList.add("is-missed");
      if (result) result.textContent = "漏選";
    }
  });

  if (summary) {
    if (selected.length === 0) summary.textContent = "這次未作答；橘色虛線標出了正確選項。";
    else if (wrongSelections === 0 && missed === 0) summary.textContent = "完全正確 · 已選中所有正確選項。";
    else summary.textContent = "核對結果 · 答對 " + correctSelections + " 項，選錯 " + wrongSelections + " 項，漏選 " + missed + " 項。";
  }
})();
</script>
`;

export const IMAGE_OCCLUSION_FRONT = `
<main class="review-shell review-shell--image-occlusion">
  <header class="review-header">
    <div class="review-identity">
      <span class="review-mark">IO</span>
      <span class="review-kicker">Visual Recall Atlas</span>
    </div>
    <span class="review-state">Identify</span>
  </header>
  <div class="section-label"><span class="section-number">01</span> 辨識遮擋區域</div>
  <section class="image-occlusion-panel">
    <div id="image-occlusion-front-stage" class="image-occlusion-stage">
      {{Image}}
      <div id="image-occlusion-front-mask-data" class="image-occlusion-mask-data">{{Mask}}</div>
    </div>
  </section>
  <div class="recall-instruction">依編號辨識每個遮擋區域，再點擊 Anki 的「顯示答案」</div>
</main>
<script>
(() => {
  const stage = document.getElementById("image-occlusion-front-stage");
  const data = document.getElementById("image-occlusion-front-mask-data");
  if (!stage || !data) return;
  const prepared = Array.from(data.querySelectorAll(".image-occlusion-mask"));
  prepared.forEach((mask, index) => {
    if (!mask.getAttribute("data-order")) mask.setAttribute("data-order", String(index + 1));
    stage.insertBefore(mask, data);
  });
  data.remove();
})();
</script>
`;

export const IMAGE_OCCLUSION_BACK = `
<main class="review-shell review-shell--image-occlusion">
  <header class="review-header">
    <div class="review-identity">
      <span class="review-mark">IO</span>
      <span class="review-kicker">Visual Recall Atlas</span>
    </div>
    <span class="review-state">Revealed</span>
  </header>
  <div class="section-label"><span class="section-number">01</span> 依序揭示答案</div>
  <section class="image-occlusion-panel">
    <div id="image-occlusion-reveal-stage" class="image-occlusion-stage">
      {{Image}}
      <div id="image-occlusion-back-mask-data" class="image-occlusion-mask-data">{{Mask}}</div>
    </div>
  </section>
  <div class="image-occlusion-reveal-controls">
    <span id="image-occlusion-reveal-status" aria-live="polite">準備依序揭示…</span>
    <button id="image-occlusion-reveal-next" type="button">揭示下一個</button>
  </div>
  {{#Answer}}
  <section id="image-occlusion-answer" class="standard-answer-panel image-occlusion-answer is-pending">
    <div class="section-label"><span class="section-number">02</span> 補充答案</div>
    <div class="standard-answer-content">{{Answer}}</div>
  </section>
  {{/Answer}}
  <section class="image-occlusion-meta">{{Back Extra}}</section>
</main>
<script>
(() => {
  const stage = document.getElementById("image-occlusion-reveal-stage");
  const status = document.getElementById("image-occlusion-reveal-status");
  const nextButton = document.getElementById("image-occlusion-reveal-next");
  const answer = document.getElementById("image-occlusion-answer");
  if (!stage || !status || !nextButton) return;
  const data = document.getElementById("image-occlusion-back-mask-data");
  if (data) {
    const prepared = Array.from(data.querySelectorAll(".image-occlusion-mask"));
    prepared.forEach((mask, index) => {
      if (!mask.getAttribute("data-order")) mask.setAttribute("data-order", String(index + 1));
      stage.insertBefore(mask, data);
    });
    data.remove();
  }
  const masks = Array.from(stage.querySelectorAll(".image-occlusion-mask"));
  let revealed = 0;

  const complete = () => {
    status.textContent = "全部 " + masks.length + " 個區域已揭示";
    nextButton.textContent = "全部已揭示";
    nextButton.disabled = true;
    if (answer) {
      answer.classList.remove("is-pending");
      answer.classList.add("is-visible");
    }
  };

  const revealNext = () => {
    const mask = masks[revealed];
    if (!mask) {
      complete();
      return;
    }
    mask.classList.add("is-removing");
    mask.setAttribute("aria-hidden", "true");
    window.setTimeout(() => { mask.style.display = "none"; }, 340);
    revealed += 1;
    if (revealed >= masks.length) {
      window.setTimeout(complete, 360);
      return;
    }
    status.textContent = "已揭示 " + revealed + " / " + masks.length + " · 下一個是 #" + (revealed + 1);
  };

  nextButton.addEventListener("click", revealNext);
  if (masks.length === 0) complete();
  else status.textContent = "共 " + masks.length + " 個區域 · 點擊揭示 #1";
})();
</script>
`;

export const CLOZE_FRONT = `
<main class="review-shell review-shell--cloze">
  <header class="review-header">
    <div class="review-identity">
      <span class="review-mark">CL</span>
      <span class="review-kicker">Active Recall Note</span>
    </div>
    <span class="review-state">Recall</span>
  </header>
  <section class="prompt-panel cloze-panel">
    <div class="section-label"><span class="section-number">01</span> 完成這段敘述</div>
    <div class="cloze-content">{{cloze:Text}}</div>
  </section>
</main>
`;

export const CLOZE_BACK = `
<main class="review-shell review-shell--cloze">
  <header class="review-header">
    <div class="review-identity">
      <span class="review-mark">CL</span>
      <span class="review-kicker">Active Recall Note</span>
    </div>
    <span class="review-state">Resolved</span>
  </header>
  <section class="prompt-panel cloze-panel">
    <div class="section-label"><span class="section-number">01</span> 完成這段敘述</div>
    <div class="cloze-content">{{cloze:Text}}</div>
  </section>
  <section class="cloze-meta">{{Back Extra}}</section>
</main>
`;

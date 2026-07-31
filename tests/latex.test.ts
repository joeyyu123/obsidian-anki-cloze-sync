import assert from "node:assert/strict";
import test from "node:test";
import { protectLatexForAnki } from "../src/latex";

test("converts inline and display LaTeX to Anki MathJax delimiters", () => {
  const protectedLatex = protectLatexForAnki(
    "面積是 $\\pi r^2$。\n\n$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$"
  );
  const html = protectedLatex.restore(`<p>${protectedLatex.markdown}</p>`);

  assert.match(html, /class="anki-math-inline">\\\(\\pi r\^2\\\)<\/span>/);
  assert.match(html, /class="anki-math-block">\\\[\\sum_\{i=1}\^\{n} i = \\frac/);
});

test("does not convert dollars inside inline or fenced code", () => {
  const source = "`const price = '$5'`\n\n```ts\nconst formula = '$x$';\n```";
  const protectedLatex = protectLatexForAnki(source);

  assert.equal(protectedLatex.markdown, source);
  assert.equal(protectedLatex.restore(source), source);
});

test("does not convert dollars after an unclosed inline-code delimiter", () => {
  const source = "`const formula = '$x$'";
  const protectedLatex = protectLatexForAnki(source);

  assert.equal(protectedLatex.markdown, source);
});

test("keeps escaped dollars and ordinary currency as text", () => {
  const source = "價格是 \\$5，折扣後從 $10 到 $8。";
  const protectedLatex = protectLatexForAnki(source);

  assert.equal(protectedLatex.markdown, source);
});

test("escapes HTML-significant characters inside formulas", () => {
  const protectedLatex = protectLatexForAnki("$x < y & y > 0$");
  const html = protectedLatex.restore(protectedLatex.markdown);

  assert.match(html, /x &lt; y &amp; y &gt; 0/);
});

test("supports LaTeX inside an Anki cloze", () => {
  const protectedLatex = protectLatexForAnki("{{c1::$E=mc^2$}}");
  const html = protectedLatex.restore(protectedLatex.markdown);

  assert.match(html, /^\{\{c1::<span class="anki-math-inline">\\\(E=mc\^2\\\)<\/span>}}$/);
});

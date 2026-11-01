import assert from "node:assert/strict";
import { test } from "node:test";
import { checkImage, generateProject } from "../generate.mjs";
import { renderHtml } from "../html.mjs";
import { parseBlocks, renderBlocks, renderInline } from "../markdown.mjs";
import { findSkippedLines, githubSlug, headingIds } from "../readme.mjs";
import { updateIndex } from "../sync.mjs";

// Helpers

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>');

function memorySource(files) {
  const tree = new Map();
  for (const file of Object.keys(files)) {
    const parts = file.split("/");
    for (let i = 1; i < parts.length; i++) tree.set(parts.slice(0, i).join("/"), "tree");
    tree.set(file, "blob");
  }
  return {
    commit: null,
    tree,
    read: (file) => {
      if (!(file in files)) throw new Error(`missing ${file}`);
      return Buffer.isBuffer(files[file]) ? files[file] : Buffer.from(files[file]);
    },
  };
}

const PROJECT = { repo: "owner/demo", slug: "demo", branch: "main", download: true };

const README = `# <img src="assets/logo.svg" alt="" width="40" align="center"> Demo

<!-- web:skip -->
[English](#english) · [Deutsch](#deutsch)
<!-- /web:skip -->

## English

Demo is a tool. It does things.

<p>
  <img src="assets/a.png" alt="A" width="49%">
  <img src="assets/b.png" alt="B" width="49%">
</p>

### Firmware
See [Firmware](#firmware), [changelog](app/CHANGELOG.md), [docs](docs), [releases](../../releases), [issues](../../issues) and [Building](#building).

<!-- web:skip -->

### Building
#### Firmware
Build it.

<!-- /web:skip -->

### License
[MIT](LICENSE)

## Deutsch

Demo ist ein Werkzeug.

### Firmware
Siehe [Firmware](#firmware-2) und [Bauen](#bauen).

<!-- web:skip -->

### Bauen
#### Firmware
Bauen.

<!-- /web:skip -->
`;

function demoFiles(readme = README) {
  return {
    "README.md": readme,
    "assets/logo.svg": SVG,
    "assets/a.png": PNG,
    "assets/b.png": PNG,
    "app/CHANGELOG.md": "# Changelog",
    "docs/protocol.md": "# Protocol",
    LICENSE: "MIT",
  };
}

// Skip markers

test("skip markers remove the marked lines including the markers", () => {
  const lines = ["a", "<!-- web:skip -->", "b", "<!-- /web:skip -->", "c"];
  assert.deepEqual([...findSkippedLines(lines)].sort(), [1, 2, 3]);
});

test("an unclosed skip marker is an error", () => {
  assert.throws(() => findSkippedLines(["a", "<!-- web:skip -->", "b"]), /never closed/);
});

test("a stray or nested skip marker is an error", () => {
  assert.throws(() => findSkippedLines(["<!-- /web:skip -->"]), /without matching/);
  assert.throws(() => findSkippedLines(["<!-- web:skip -->", "<!-- web:skip -->", "<!-- /web:skip -->"]), /nested/);
});

test("skip markers inside code blocks are ignored", () => {
  assert.deepEqual([...findSkippedLines(["```", "<!-- web:skip -->", "```"])], []);
});

// Heading anchors

test("anchors follow GitHub and number duplicates across the whole README", () => {
  const ids = headingIds(["# Firmware", "## How it works", "```", "# Firmware", "```", "## Firmware", "### Firmware", "## Installer-Parameter", "## Über `code`!"]);
  assert.deepEqual([...ids.values()], ["firmware", "how-it-works", "firmware-1", "firmware-2", "installer-parameter", "über-code"]);
  assert.equal(githubSlug(" FlexPad"), "-flexpad");
});

// Markdown

test("renders lists, nested lists, tables and code", () => {
  const md = "1. One\n2. Two:\n   - **A**: a\n   - B\n\n| A | B |\n|---|---|\n| `x\\|y` | *z* |\n\n```\n<b>\n```";
  const html = renderBlocks(parseBlocks(md.split("\n")), { link: () => null, image: () => null, warn: () => {}, headingId: () => null });
  assert.match(html, /<ol>\n<li>One<\/li>\n<li>Two:\n<ul>\n<li><strong>A<\/strong>: a<\/li>\n<li>B<\/li>\n<\/ul><\/li>\n<\/ol>/);
  assert.match(html, /<td><code>x\|y<\/code><\/td><td><em>z<\/em><\/td>/);
  assert.match(html, /<pre><code>&lt;b&gt;<\/code><\/pre>/);
});

test("raw HTML is limited to p, img and br", () => {
  const warnings = [];
  const ctx = { image: (src) => src, warn: (w) => warnings.push(w) };
  const html = renderHtml('<p onclick="x"><img src="a.png" onerror="alert(1)" alt="x" width="49%" style="x"><script>alert(1)</script><a href="javascript:x">y</a></p>', ctx);
  assert.equal(html, '<p><img src="a.png" alt="x" width="49%" loading="lazy" decoding="async">&lt;script&gt;alert(1)&lt;/script&gt;&lt;a href=&quot;javascript:x&quot;&gt;y&lt;/a&gt;</p>');
  assert.equal(warnings.length, 4);
});

test("unsafe link schemes are dropped", () => {
  const ctx = { link: (url) => (url.startsWith("javascript:") ? null : { href: url }), image: () => null, warn: () => {} };
  assert.equal(renderInline("[x](javascript:alert(1)) [y](https://a.b)", ctx), 'x <a href="https://a.b">y</a>');
});

// Project pages

test("generates the page with rewritten links and skipped sections removed", () => {
  const { files, title, logo } = generateProject(PROJECT, memorySource(demoFiles()));
  const html = files.get("index.html");
  assert.equal(title, "Demo");
  assert.equal(logo, "assets/logo.svg");
  assert.deepEqual([...files.keys()].sort(), ["assets/a.png", "assets/b.png", "assets/logo.svg", "index.html"]);
  assert.doesNotMatch(html, /Build it|Bauen\.|id="building"|id="bauen"|id="firmware-1"|id="firmware-3"/);
  assert.match(html, /<h3 id="firmware">Firmware<\/h3>/);
  assert.match(html, /<h3 id="firmware-2">Firmware<\/h3>/);
  assert.match(html, /href="#firmware"/);
  assert.match(html, /href="#firmware-2"/);
  assert.match(html, /href="https:\/\/github.com\/owner\/demo\/blob\/main\/README.md#building"/);
  assert.match(html, /href="https:\/\/github.com\/owner\/demo\/blob\/main\/README.md#bauen"/);
  assert.match(html, /href="https:\/\/github.com\/owner\/demo\/blob\/main\/app\/CHANGELOG.md"/);
  assert.match(html, /href="https:\/\/github.com\/owner\/demo\/tree\/main\/docs"/);
  assert.match(html, /href="https:\/\/github.com\/owner\/demo\/releases"/);
  assert.match(html, /href="https:\/\/github.com\/owner\/demo\/issues"/);
  assert.match(html, /href="https:\/\/github.com\/owner\/demo\/blob\/main\/LICENSE"/);
  assert.match(html, /href="https:\/\/github.com\/owner\/demo\/releases\/latest"[^>]*>Download</);
  assert.match(html, /<section lang="de">\n<h2 id="deutsch">/);
  assert.match(html, /<img src="assets\/a.png" alt="A" width="49%"/);
  assert.doesNotMatch(html, /<script/);
});

test("broken links and missing images stop the generator", () => {
  const readme = "# Demo\n\n## English\n\nText [x](missing.md) [y](#nowhere) ![z](assets/none.png)\n";
  assert.throws(() => generateProject(PROJECT, memorySource({ ...demoFiles(), "README.md": readme })), (error) => {
    assert.equal(error.problems.length, 3);
    return true;
  });
});

test("images must be safe files of the declared type", () => {
  assert.equal(checkImage("a.png", PNG), null);
  assert.match(checkImage("a.png", SVG), /does not match/);
  assert.match(checkImage("a.svg", Buffer.from('<svg onload="x"></svg>')), /scripts/);
  assert.match(checkImage("a.svg", Buffer.from('<svg><image href="https://x/y.png"/></svg>')), /external/);
  assert.match(checkImage("a.exe", PNG), /unsupported/);
});

test("project list on the home page is replaced between the markers", () => {
  const html = "<ul>\n    <li>old</li>\n    <!-- generated:projects -->\n    <li>stale</li>\n    <!-- /generated:projects -->\n</ul>";
  const updated = updateIndex(html, [{ project: { slug: "demo" }, title: "Demo", logo: "assets/logo.svg" }]);
  assert.equal(updated, '<ul>\n    <li>old</li>\n    <!-- generated:projects -->\n    <li><a href="/demo/"><img src="/demo/assets/logo.svg" alt="" width="20" height="20">Demo</a></li>\n    <!-- /generated:projects -->\n</ul>');
});

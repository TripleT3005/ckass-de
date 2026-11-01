import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import os from "node:os";
import path from "node:path";
import { checkSite, checkSitemap } from "../check.mjs";
import { checkImage, generateProject } from "../generate.mjs";
import { acceptLanguagePattern, ZOOM_SCRIPT } from "../page.mjs";
import { renderHtml, stripTags } from "../html.mjs";
import { parseBlocks, renderBlocks, renderInline } from "../markdown.mjs";
import { findSkippedLines, githubSlug, headingIds } from "../readme.mjs";
import { buildSitemap } from "../sitemap.mjs";
import { homeAbout, homeDescription, renderHome, updateHtaccess, updateIndex } from "../sync.mjs";

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

const PROJECT = { repo: "owner/demo", slug: "demo", branch: "main", download: true, changelog: "app/CHANGELOG.md" };

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
See [Firmware](#firmware), [Deutsch](#deutsch), [changelog](app/CHANGELOG.md), [docs](docs), [releases](../../releases), [issues](../../issues) and [Building](#building).

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

test("stripTags leaves no tag openers behind", () => {
  assert.equal(stripTags("<b>A</b> &amp; <i>B</i>"), "A & B");
  assert.equal(stripTags("<<b>script>x<scr<i>ipt"), "script>xipt");
  assert.equal(stripTags("a <script"), "a ");
  assert.equal(stripTags("x &lt;b&gt;"), "x <b>");
});

test("unsafe link schemes are dropped", () => {
  const ctx = { link: (url) => (/^https?:/i.test(url) ? { href: url } : null), image: () => null, warn: () => {} };
  assert.equal(renderInline("[x](javascript:alert(1)) [y](https://a.b)", ctx), 'x <a href="https://a.b">y</a>');
});

// Project pages

test("generates one page per language with rewritten links and skipped sections removed", () => {
  const { files, title, logo } = generateProject(PROJECT, memorySource(demoFiles()));
  assert.equal(title, "Demo");
  assert.equal(logo, "assets/logo.svg");
  assert.deepEqual([...files.keys()].sort(), [".htaccess", "assets/a.png", "assets/b.png", "assets/logo.svg", "de/index.html", "en/index.html", "index.html"]);
  const en = files.get("en/index.html");
  const de = files.get("de/index.html");
  for (const html of [en, de]) {
    assert.doesNotMatch(html.replace(ZOOM_SCRIPT, ""), /Build it|Bauen\.|id="building"|id="bauen"|id="firmware-1"|id="firmware-3"|<script(?! type="application\/ld\+json")/);
    assert.match(html, /href="https:\/\/github.com\/owner\/demo\/releases\/latest"[^>]*>Download</);
    assert.match(html, /href="https:\/\/github.com\/owner\/demo\/blob\/main\/app\/CHANGELOG.md"[^>]*>Changelog</);
    assert.match(html, /<link rel="alternate" hreflang="de" href="https:\/\/ckass.de\/demo\/de\/">/);
    assert.match(html, /<img src="..\/assets\/logo.svg" alt="" width="64" height="64">/);
  }
  assert.ok(en.includes(ZOOM_SCRIPT));
  assert.ok(!de.includes(ZOOM_SCRIPT));
  assert.match(en, /<html lang="en">/);
  assert.match(en, /<section id="english">/);
  assert.doesNotMatch(en, /Demo ist ein Werkzeug|<h2/);
  assert.match(en, /<h3 id="firmware">Firmware<\/h3>/);
  assert.match(en, /href="#firmware"/);
  assert.match(en, /href="..\/de\/#deutsch"/);
  assert.match(en, /href="https:\/\/github.com\/owner\/demo\/blob\/main\/README.md#building"/);
  assert.match(en, /href="https:\/\/github.com\/owner\/demo\/blob\/main\/app\/CHANGELOG.md"/);
  assert.match(en, /href="https:\/\/github.com\/owner\/demo\/tree\/main\/docs"/);
  assert.match(en, /href="https:\/\/github.com\/owner\/demo\/releases"/);
  assert.match(en, /href="https:\/\/github.com\/owner\/demo\/issues"/);
  assert.match(en, /href="https:\/\/github.com\/owner\/demo\/blob\/main\/LICENSE"/);
  assert.match(en, /<img src="..\/assets\/a.png" alt="A" width="49%"/);
  assert.match(en, /<a href="..\/en\/" hreflang="en" lang="en" aria-current="page"/);
  assert.match(en, /<a href="..\/de\/" hreflang="de" lang="de" aria-label="Deutsch"/);
  assert.match(de, /<html lang="de">/);
  assert.match(de, /<section id="deutsch">/);
  assert.match(de, /<h3 id="firmware-2">Firmware<\/h3>/);
  assert.match(de, /href="#firmware-2"/);
  assert.match(de, />Quellcode</);
  assert.match(de, /href="https:\/\/github.com\/owner\/demo\/blob\/main\/README.md#bauen"/);
  assert.doesNotMatch(de, /Demo is a tool/);
  const fallback = files.get("index.html");
  assert.match(fallback, /<link rel="canonical" href="https:\/\/ckass.de\/demo\/en\/">/);
  assert.match(fallback, /<a href="de\/" hreflang="de"/);
  assert.match(fallback, /<img src="assets\/a.png"/);
  assert.match(files.get(".htaccess"), /RewriteRule \^\(index\\.html\)\?\$ \/demo\/de\/ \[R=302,L,E=LANGUAGE_REDIRECT:1\]/);
  assert.match(en, /<footer><a href="\/en\/">ckass.de<\/a>/);
  assert.match(de, /<footer><a href="\/de\/">ckass.de<\/a>/);
});

test("a README with one language becomes a single page", () => {
  const readme = "# Demo\n\n## English\n\nDemo is a tool.\n\n### Usage\nSee [usage](#usage).\n";
  const { files } = generateProject(PROJECT, memorySource({ ...demoFiles(), "README.md": readme }));
  assert.deepEqual([...files.keys()], ["index.html"]);
  assert.match(files.get("index.html"), /<h2 id="english">English<\/h2>/);
  assert.doesNotMatch(files.get("index.html"), /class="switch"|<script(?! type="application\/ld\+json")/);
});

function structuredData(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map((m) => JSON.parse(m[1]));
}

test("project pages describe the project as free software with breadcrumbs", () => {
  const { files } = generateProject(PROJECT, memorySource(demoFiles()));
  const [data] = structuredData(files.get("de/index.html"));
  const [app, breadcrumbs] = data["@graph"];
  assert.equal(app["@type"], "SoftwareApplication");
  assert.equal(app.name, "Demo");
  assert.equal(app.description, "Demo ist ein Werkzeug.");
  assert.equal(app.url, "https://ckass.de/demo/de/");
  assert.equal(app.inLanguage, "de");
  assert.equal(app.downloadUrl, "https://github.com/owner/demo/releases/latest");
  assert.equal(app.sameAs, "https://github.com/owner/demo");
  assert.deepEqual(app.offers, { "@type": "Offer", price: "0", priceCurrency: "EUR" });
  assert.deepEqual(
    breadcrumbs.itemListElement.map((i) => i.item),
    ["https://ckass.de/de/", "https://ckass.de/demo/de/"],
  );
  const single = generateProject({ ...PROJECT, download: false }, memorySource({ ...demoFiles(), "README.md": "# Demo\n\nDemo is a tool.\n" })).files.get("index.html");
  const [singleApp, singleCrumbs] = structuredData(single)[0]["@graph"];
  assert.equal(singleApp.downloadUrl, undefined);
  assert.equal(singleCrumbs.itemListElement[0].item, "https://ckass.de/");
});

test("structured data cannot close its script element", () => {
  const readme = "# Demo </script><script>alert(1)</script>\n\nDemo is a tool.\n";
  const html = generateProject(PROJECT, memorySource({ ...demoFiles(), "README.md": readme })).files.get("index.html");
  const block = /<script type="application\/ld\+json">[\s\S]*?<\/script>/.exec(html)[0];
  assert.doesNotMatch(block.slice(1, -"</script>".length), /</);
});

test("the redirect picks the first supported browser language", () => {
  const pattern = new RegExp(acceptLanguagePattern("de", ["en", "de"]), "i");
  const cases = {
    "de-DE,de;q=0.9,en;q=0.8": true,
    "de": true,
    "DE-AT": true,
    "fr-FR,fr;q=0.9,de;q=0.8,en;q=0.7": true,
    "en-US,en;q=0.9,de;q=0.8": false,
    "en-GB,de": false,
    "fr-FR,it": false,
    "dense": false,
    "": false,
  };
  for (const [header, german] of Object.entries(cases)) assert.equal(pattern.test(header), german, header);
});

test("the link check finds missing anchors and active content", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pages-"));
  const { files } = generateProject(PROJECT, memorySource(demoFiles()));
  for (const [file, data] of files) {
    fs.mkdirSync(path.dirname(path.join(dir, "demo", file)), { recursive: true });
    fs.writeFileSync(path.join(dir, "demo", file), data);
  }
  for (const lang of ["en", "de"]) {
    fs.mkdirSync(path.join(dir, lang));
    fs.writeFileSync(path.join(dir, lang, "index.html"), "<p>home</p>");
  }
  fs.writeFileSync(path.join(dir, "index.html"), '<a href="/demo/de/#firmware-2">x</a>');
  assert.deepEqual(checkSite(dir).problems, []);
  fs.writeFileSync(path.join(dir, "index.html"), '<a href="/demo/en/#firmware-2">x</a>');
  assert.match(checkSite(dir).problems.join(), /missing anchor/);
  fs.writeFileSync(path.join(dir, "demo", "de", "index.html"), files.get("de/index.html").replace("</main>", "<script>alert(1)</script></main>"));
  assert.match(checkSite(dir).problems.join(), /active content/);
  fs.writeFileSync(path.join(dir, "demo", "de", "index.html"), files.get("de/index.html").replace("</head>", '<script type="application/ld+json">{oops</script></head>'));
  assert.match(checkSite(dir).problems.join(), /invalid structured data/);
  fs.rmSync(dir, { recursive: true, force: true });
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
  assert.equal(checkImage("a.svg", Buffer.from(`<?xml version="1.0"?>\n<!-- a --> <!-- b -->\n${SVG}`)), null);
  assert.match(checkImage("a.svg", Buffer.from("<!-- a <svg>")), /does not match/);
  assert.match(checkImage("a.svg", Buffer.from(`<!--${"<!--".repeat(100000)}`)), /does not match/);
  assert.match(checkImage("a.svg", Buffer.from('<svg><image href="https://x/y.png"/></svg>')), /external/);
  assert.match(checkImage("a.exe", PNG), /unsupported/);
});

test("project list on the home page links to the page in the same language", () => {
  const html = "<ul>\n    <li>old</li>\n    <!-- generated:projects -->\n    <li>stale</li>\n    <!-- /generated:projects -->\n</ul>";
  const results = [
    { project: { slug: "demo" }, title: "Demo", logo: "assets/logo.svg", languages: ["en", "de"] },
    { project: { slug: "solo" }, title: "Solo", logo: null, languages: ["en"] },
  ];
  assert.equal(
    updateIndex(html, results, "de"),
    '<ul>\n    <li>old</li>\n    <!-- generated:projects -->\n    <li><a href="/demo/de/"><img src="/demo/assets/logo.svg" alt="" width="20" height="20">Demo</a></li>\n    <li><a href="/solo/">Solo</a></li>\n    <!-- /generated:projects -->\n</ul>',
  );
});

test("home pages get the language, flags and alternates", () => {
  const template = '<html lang="{{lang}}">\n<head>{{head}}\n<style>{{switchStyle}}</style></head>\n<body>\n{{switch}}\n<ul>\n<!-- generated:projects -->\n<!-- /generated:projects -->\n</ul>';
  const results = [{ project: { slug: "demo" }, title: "Demo", logo: null, languages: ["en", "de"] }];
  const de = renderHome(template, results, "de", "/de/");
  assert.match(de, /<html lang="de">/);
  assert.match(de, /<link rel="canonical" href="https:\/\/ckass.de\/de\/">/);
  assert.match(de, /<meta property="og:url" content="https:\/\/ckass.de\/de\/">/);
  assert.match(de, /<meta property="og:locale" content="de_DE">/);
  const [website, author, profile] = structuredData(de)[0]["@graph"];
  assert.equal(website["@type"], "WebSite");
  assert.equal(website.inLanguage, "de");
  assert.deepEqual(author.sameAs, ["https://github.com/TripleT3005", "https://www.twitch.tv/TripleT3005"]);
  assert.equal(profile.url, "https://ckass.de/de/");
  assert.match(de, /<link rel="alternate" hreflang="en" href="https:\/\/ckass.de\/en\/">/);
  assert.match(de, /\.switch a\[aria-current="page"\]/);
  assert.match(de, /\n<nav class="switch" aria-label="Language \/ Sprache">\n  <a href="\/en\/" hreflang="en"/);
  assert.match(de, /<a href="\/de\/" hreflang="de" lang="de" aria-current="page"/);
  assert.match(de, /<li><a href="\/demo\/de\/">Demo<\/a><\/li>/);
  assert.doesNotMatch(de, /\{\{/);
  assert.match(renderHome(template, results, "en", "/en/"), /<link rel="canonical" href="https:\/\/ckass.de\/en\/">/);
});

test("the home about text follows the page language", () => {
  assert.match(homeAbout("de"), /^Hi, ich bin Christoph Kaß, online TripleT3005\..* erreichst du mich auf Discord\.$/);
  assert.match(homeAbout("en"), /^Hi, I'm Christoph Kaß, known online as TripleT3005\..* Discord is the quickest way to reach me\.$/);
  assert.doesNotMatch(homeAbout("de"), /<a /);
  assert.equal(homeAbout("fr"), homeAbout("en"));
});

test("the home description lists the projects in the page language", () => {
  const results = ["A", "B", "C"].map((title) => ({ title }));
  assert.equal(homeDescription(results, "en"), "Open-source projects by TripleT3005: A, B and C.");
  assert.equal(homeDescription(results.slice(0, 1), "de"), "Open-Source-Projekte von TripleT3005: A.");
  assert.equal(homeDescription([], "en"), "Open-source projects by TripleT3005.");
});

test("project pages point to themselves as canonical and carry Open Graph tags", () => {
  const { files } = generateProject(PROJECT, memorySource(demoFiles()));
  assert.match(files.get("en/index.html"), /<link rel="canonical" href="https:\/\/ckass.de\/demo\/en\/">/);
  assert.match(files.get("de/index.html"), /<link rel="canonical" href="https:\/\/ckass.de\/demo\/de\/">/);
  assert.match(files.get("de/index.html"), /<meta property="og:title" content="Demo">/);
  assert.match(files.get("de/index.html"), /<meta property="og:description" content="Demo · Demo ist ein Werkzeug\.">/);
  const single = generateProject(PROJECT, memorySource({ ...demoFiles(), "README.md": "# Demo\n\nDemo is a tool.\n" })).files.get("index.html");
  assert.match(single, /<link rel="canonical" href="https:\/\/ckass.de\/demo\/">/);
});

test("the sitemap lists indexable pages under their canonical address only", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sitemap-"));
  const page = (file, head) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), `<head>${head}</head>`);
  };
  page("index.html", '<link rel="canonical" href="https://ckass.de/en/">');
  page("en/index.html", '<link rel="canonical" href="https://ckass.de/en/">');
  page("demo/de/index.html", '<link rel="canonical" href="https://ckass.de/demo/de/">');
  page("solo/index.html", "");
  page("404.html", '<meta name="robots" content="noindex, nofollow">');
  assert.equal(
    buildSitemap(dir),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://ckass.de/demo/de/</loc></url>\n  <url><loc>https://ckass.de/en/</loc></url>\n  <url><loc>https://ckass.de/solo/</loc></url>\n</urlset>\n',
  );
  assert.deepEqual(checkSitemap(dir), ["sitemap.xml is missing"]);
  fs.writeFileSync(path.join(dir, "sitemap.xml"), buildSitemap(dir));
  assert.deepEqual(checkSitemap(dir), []);
  page("new/index.html", "");
  assert.match(checkSitemap(dir).join(), /out of date/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the root .htaccess keeps its own lines and gets one redirect block", () => {
  const base = "ErrorDocument 404 /404.html\nOptions -Indexes\n";
  const once = updateHtaccess(base);
  assert.ok(once.startsWith(base));
  assert.match(once, /RewriteRule \^\(index\\.html\)\?\$ \/de\/ \[R=302,L,E=LANGUAGE_REDIRECT:1\]/);
  assert.equal(updateHtaccess(once), once);
  assert.equal(updateHtaccess(once.replace("/de/ [R", "/old/ [R")), once);
});

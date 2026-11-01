import fs from "node:fs";
import path from "node:path";
import { decodeEntities, escapeText } from "./html.mjs";
import { SITE } from "./page.mjs";

// Pages

export function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith(".html") ? [full] : [];
  });
}

function pageUrl(publicDir, file) {
  const rel = path.relative(publicDir, file).split(path.sep).join("/");
  return `${SITE}/${rel === "index.html" ? "" : rel.replace(/(^|\/)index\.html$/, "$1")}`;
}

export function indexablePages(publicDir) {
  return htmlFiles(publicDir)
    .flatMap((file) => {
      const html = fs.readFileSync(file, "utf8");
      if (/<meta name="robots" content="[^"]*noindex/i.test(html)) return [];
      const url = pageUrl(publicDir, file);
      const canonical = /<link rel="canonical" href="([^"]*)">/.exec(html)?.[1];
      return canonical && decodeEntities(canonical) !== url ? [] : [url];
    })
    .sort();
}

// Sitemap

export function buildSitemap(publicDir) {
  const urls = indexablePages(publicDir).map((url) => `  <url><loc>${escapeText(encodeURI(url))}</loc></url>\n`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("")}</urlset>\n`;
}

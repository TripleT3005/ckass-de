import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeEntities } from "./html.mjs";
import { GENERATED_MARK, ZOOM_SCRIPT } from "./page.mjs";
import { buildSitemap, htmlFiles } from "./sitemap.mjs";
import { SITE_ICONS } from "./sync.mjs";

// Pages

function idsOf(html) {
  return new Set([...html.matchAll(/\sid="([^"]*)"/g)].map((m) => decodeEntities(m[1])));
}

function targetFile(publicDir, fromFile, urlPath) {
  const base = urlPath.startsWith("/") ? path.join(publicDir, ...urlPath.slice(1).split("/")) : path.join(path.dirname(fromFile), ...urlPath.split("/"));
  if (urlPath.endsWith("/") || (fs.existsSync(base) && fs.statSync(base).isDirectory())) return path.join(base, "index.html");
  return base;
}

// Checks

export function checkSite(publicDir) {
  const problems = [];
  const files = htmlFiles(publicDir);
  const ids = new Map(files.map((f) => [f, idsOf(fs.readFileSync(f, "utf8"))]));
  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");
    const rel = path.relative(publicDir, file).split(path.sep).join("/");
    const generated = html.includes(GENERATED_MARK);
    if (generated) {
      const content = html.replace(ZOOM_SCRIPT, "").replace(/<script type="application\/ld\+json">([^<]*)<\/script>/g, (_, json) => {
        try {
          JSON.parse(json);
        } catch {
          problems.push(`${rel}: invalid structured data`);
        }
        return "";
      });
      if (/<script|<iframe|<object|<embed|<form/i.test(content)) problems.push(`${rel}: contains active content`);
      if (/\son[a-z]+\s*=/i.test(content)) problems.push(`${rel}: contains an event handler attribute`);
    }
    for (const m of html.matchAll(/\s(href|src)="([^"]*)"/g)) {
      const [, attr, raw] = m;
      const url = decodeEntities(raw);
      if (/^(https?:|mailto:)/i.test(url)) {
        if (attr === "src" && generated) problems.push(`${rel}: external resource ${url}`);
        continue;
      }
      if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(url) || url.startsWith("//") || url === "") {
        problems.push(`${rel}: unexpected ${attr} "${url}"`);
        continue;
      }
      const hash = url.indexOf("#");
      const urlPath = decodeURIComponent((hash >= 0 ? url.slice(0, hash) : url).replace(/\?.*$/, ""));
      const fragment = hash >= 0 ? decodeURIComponent(url.slice(hash + 1)) : "";
      const target = urlPath ? targetFile(publicDir, file, urlPath) : file;
      if (!fs.existsSync(target)) {
        problems.push(`${rel}: ${attr} "${url}" points to a missing file`);
        continue;
      }
      if (fragment && !(ids.get(target) ?? new Set()).has(fragment)) problems.push(`${rel}: ${attr} "${url}" points to a missing anchor`);
    }
  }
  return { files: files.length, problems };
}

export function checkSiteIcons(publicDir, iconDir) {
  return SITE_ICONS.filter(([source, target]) => {
    const published = path.join(publicDir, target);
    return !fs.existsSync(published) || !fs.readFileSync(published).equals(fs.readFileSync(path.join(iconDir, source)));
  }).map(([source, target]) => `${target} does not match assets/icons/${source}, run scripts/project-pages/sync.mjs`);
}

export function checkSitemap(publicDir) {
  const file = path.join(publicDir, "sitemap.xml");
  if (!fs.existsSync(file)) return ["sitemap.xml is missing"];
  return fs.readFileSync(file, "utf8") === buildSitemap(publicDir) ? [] : ["sitemap.xml is out of date, run scripts/project-pages/sync.mjs"];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const publicDir = path.resolve(process.argv[2] ?? fileURLToPath(new URL("../../public", import.meta.url)));
  const { files, problems } = checkSite(publicDir);
  problems.push(...checkSitemap(publicDir));
  if (!process.argv[2]) problems.push(...checkSiteIcons(publicDir, fileURLToPath(new URL("../../assets/icons", import.meta.url))));
  for (const problem of problems) console.log(`::error::${problem}`);
  console.log(`Checked ${files} pages, ${problems.length} problem(s).`);
  if (problems.length) process.exit(1);
}

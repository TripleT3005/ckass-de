import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeEntities } from "./html.mjs";
import { GENERATED_MARK, ZOOM_SCRIPT } from "./page.mjs";

// Pages

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith(".html") ? [full] : [];
  });
}

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
      const content = html.replace(ZOOM_SCRIPT, "");
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const publicDir = path.resolve(process.argv[2] ?? fileURLToPath(new URL("../../public", import.meta.url)));
  const { files, problems } = checkSite(publicDir);
  for (const problem of problems) console.log(`::error::${problem}`);
  console.log(`Checked ${files} pages, ${problems.length} problem(s).`);
  if (problems.length) process.exit(1);
}

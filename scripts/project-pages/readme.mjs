import { inlineText } from "./markdown.mjs";

// Skip markers

const SKIP_START = /^\s*<!--\s*web:skip\s*-->\s*$/;
const SKIP_END = /^\s*<!--\s*\/web:skip\s*-->\s*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

export function findSkippedLines(lines) {
  const skipped = new Set();
  let start = -1;
  let fence = null;
  lines.forEach((line, i) => {
    const f = FENCE.exec(line);
    if (f) {
      if (!fence) fence = f[1];
      else if (f[1][0] === fence[0] && f[1].length >= fence.length && line.trim() === f[1]) fence = null;
    }
    if (fence && !f) {
      if (start >= 0) skipped.add(i);
      return;
    }
    if (SKIP_START.test(line)) {
      if (start >= 0) throw new Error(`README.md:${i + 1}: nested <!-- web:skip --> (previous one opened on line ${start + 1})`);
      start = i;
    } else if (SKIP_END.test(line)) {
      if (start < 0) throw new Error(`README.md:${i + 1}: <!-- /web:skip --> without matching <!-- web:skip -->`);
      for (let k = start; k <= i; k++) skipped.add(k);
      start = -1;
    } else if (start >= 0) {
      skipped.add(i);
    }
  });
  if (start >= 0) throw new Error(`README.md:${start + 1}: <!-- web:skip --> is never closed with <!-- /web:skip -->`);
  return skipped;
}

// Heading anchors

export function githubSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}

export function headingIds(lines) {
  const ids = new Map();
  const seen = new Map();
  let fence = null;
  lines.forEach((line, i) => {
    const f = FENCE.exec(line);
    if (f) {
      if (!fence) fence = f[1];
      else if (f[1][0] === fence[0] && f[1].length >= fence.length && line.trim() === f[1]) fence = null;
      return;
    }
    if (fence) return;
    const m = /^ {0,3}#{1,6}(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/.exec(line);
    if (!m) return;
    const base = githubSlug(inlineText(m[1] ?? "", false));
    let id = base;
    let count = seen.get(base) ?? 0;
    while (seen.has(id)) id = `${base}-${++count}`;
    seen.set(base, count);
    seen.set(id, 0);
    ids.set(i, id);
  });
  return ids;
}

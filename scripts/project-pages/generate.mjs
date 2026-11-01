import path from "node:path";
import { stripTags } from "./html.mjs";
import { inlineText, parseBlocks, renderBlock, renderInline } from "./markdown.mjs";
import { LANGUAGES, linkButtons, renderPage } from "./page.mjs";
import { findSkippedLines, headingIds } from "./readme.mjs";

// Images

const IMAGE_TYPES = {
  ".png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  ".jpg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  ".jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  ".gif": (b) => /^GIF8[79]a/.test(b.subarray(0, 6).toString("latin1")),
  ".webp": (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  ".svg": (b) => /^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/.test(b.toString("utf8")),
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SAFE_SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const UNSAFE_SVG = /<script|<foreignObject|<!ENTITY|<!DOCTYPE|\son[a-z]+\s*=|javascript:|(?:xlink:)?href\s*=\s*["']?\s*(?!#)|url\(\s*["']?\s*(?!#)|@import/i;

export function checkImage(file, data) {
  const ext = path.posix.extname(file).toLowerCase();
  if (!IMAGE_TYPES[ext]) return `${file}: unsupported image type`;
  if (data.length > MAX_IMAGE_BYTES) return `${file}: larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB`;
  if (!IMAGE_TYPES[ext](data)) return `${file}: content does not match the file extension`;
  if (ext === ".svg" && UNSAFE_SVG.test(data.toString("utf8"))) return `${file}: SVG contains scripts, event handlers or external references`;
  return null;
}

// Links

function encodePath(p) {
  return p.split("/").map(encodeURIComponent).join("/");
}

function resolveRepoPath(target) {
  const clean = target.startsWith("/") ? target.slice(1) : target;
  const parts = [];
  let up = 0;
  for (const segment of clean.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (parts.length) parts.pop();
      else up++;
    } else parts.push(segment);
  }
  return { up, path: parts.join("/") };
}

function splitUrl(url) {
  const hash = url.indexOf("#");
  const beforeHash = hash >= 0 ? url.slice(0, hash) : url;
  const fragment = hash >= 0 ? url.slice(hash) : "";
  const query = beforeHash.indexOf("?");
  return {
    target: query >= 0 ? beforeHash.slice(0, query) : beforeHash,
    suffix: (query >= 0 ? beforeHash.slice(query) : "") + fragment,
  };
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function createContext({ repo, branch, tree, pageIds, idsByLine }) {
  const repoUrl = `https://github.com/${repo}`;
  const allIds = new Set(idsByLine.values());
  const errors = [];
  const warnings = [];
  const images = new Set();

  function link(raw) {
    const url = raw.trim();
    if (!url) {
      errors.push("Link with empty target");
      return null;
    }
    if (url.startsWith("#")) {
      const id = safeDecode(url.slice(1));
      if (pageIds.has(id)) return { href: `#${id}` };
      if (allIds.has(id)) return { href: `${repoUrl}/blob/${encodePath(branch)}/README.md#${encodeURIComponent(id)}`, external: true };
      errors.push(`Link to unknown heading ${url}`);
      return null;
    }
    const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(url);
    if (scheme) {
      if (/^(https?|mailto)$/i.test(scheme[1])) return { href: url, external: true };
      warnings.push(`Removed link with scheme ${scheme[1]}: ${url}`);
      return null;
    }
    if (url.startsWith("//")) {
      warnings.push(`Removed protocol-relative link ${url}`);
      return null;
    }
    const { target, suffix } = splitUrl(url);
    const resolved = resolveRepoPath(safeDecode(target));
    if (resolved.up === 2) return { href: `${repoUrl}${resolved.path ? `/${encodePath(resolved.path)}` : ""}${suffix}`, external: true };
    if (resolved.up > 0) {
      errors.push(`Link ${url} points outside the repository`);
      return null;
    }
    if (!resolved.path) return { href: `${repoUrl}/tree/${encodePath(branch)}${suffix}`, external: true };
    const type = tree.get(resolved.path);
    if (!type) {
      errors.push(`Link ${url} points to ${resolved.path}, which does not exist in ${repo}@${branch}`);
      return null;
    }
    const kind = type === "tree" ? "tree" : "blob";
    return { href: `${repoUrl}/${kind}/${encodePath(branch)}/${encodePath(resolved.path)}${suffix}`, external: true };
  }

  function image(raw) {
    const url = raw.trim();
    if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(url) || url.startsWith("//")) {
      warnings.push(`Removed external image ${url}`);
      return null;
    }
    const resolved = resolveRepoPath(safeDecode(splitUrl(url).target));
    if (resolved.up > 0 || !resolved.path) {
      errors.push(`Image ${url} points outside the repository`);
      return null;
    }
    if (!resolved.path.split("/").every((s) => SAFE_SEGMENT.test(s))) {
      errors.push(`Image path ${resolved.path} contains unsupported characters`);
      return null;
    }
    if (tree.get(resolved.path) !== "blob") {
      errors.push(`Image ${url} does not exist in ${repo}@${branch}`);
      return null;
    }
    if (!IMAGE_TYPES[path.posix.extname(resolved.path).toLowerCase()]) {
      errors.push(`Image ${url} has an unsupported file type`);
      return null;
    }
    images.add(resolved.path);
    return encodePath(resolved.path);
  }

  return {
    repoUrl,
    errors,
    warnings,
    images,
    link,
    image,
    warn: (message) => warnings.push(message),
    headingId: (line) => idsByLine.get(line) ?? null,
  };
}

// Project

function firstSentence(text) {
  const m = /^.*?[.!?](?=\s|$)/s.exec(text);
  return (m ? m[0] : text).replace(/\s+/g, " ").trim();
}

export function generateProject(project, source) {
  const readme = source.read("README.md").toString("utf8").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = readme.split("\n");
  const skipped = findSkippedLines(lines);
  const idsByLine = headingIds(lines);
  const ctx = createContext({
    repo: project.repo,
    branch: project.branch,
    tree: source.tree,
    idsByLine,
    pageIds: new Set([...idsByLine].filter(([line]) => !skipped.has(line)).map(([, id]) => id)),
  });

  const kept = lines.map((line, i) => (skipped.has(i) ? "" : line));
  const blocks = parseBlocks(
    kept,
    kept.map((_, i) => i),
  );

  const titleBlock = blocks[0];
  if (!titleBlock || titleBlock.type !== "heading" || titleBlock.level !== 1) throw new Error(`${project.repo}: README.md must start with a "# Title" heading`);
  const titleRendered = renderInline(titleBlock.text, ctx);
  const logo = /<img src="([^"]*)"/.exec(titleRendered)?.[1] ?? null;
  const titleHtml = titleRendered.replace(/<img[^>]*>/g, "").trim();
  const title = stripTags(titleHtml).trim();

  const intro = [];
  const sections = [];
  for (const block of blocks.slice(1)) {
    if (block.type === "heading" && block.level <= 2) sections.push({ heading: block, blocks: [] });
    else if (sections.length) sections.at(-1).blocks.push(block);
    else intro.push(block);
  }

  const changelog = project.changelog ? ctx.link(project.changelog)?.href : null;
  const descriptions = [];
  const nav = [];
  const rendered = sections.map(({ heading, blocks: body }) => {
    const label = inlineText(heading.text);
    const lang = LANGUAGES[label.toLowerCase()] ?? null;
    const id = ctx.headingId(heading.line);
    if (id) nav.push([id, renderInline(heading.text, ctx), lang]);
    const parts = [renderBlock({ ...heading, level: 2 }, ctx)];
    let buttonsPlaced = !lang;
    for (const block of body) {
      parts.push(renderBlock(block, ctx));
      if (!buttonsPlaced && block.type === "paragraph") {
        parts.push(linkButtons(lang, { repoUrl: ctx.repoUrl, download: project.download, changelog }));
        descriptions.push(firstSentence(inlineText(block.text)));
        buttonsPlaced = true;
      }
    }
    if (!buttonsPlaced) parts.splice(1, 0, linkButtons(lang, { repoUrl: ctx.repoUrl, download: project.download, changelog }));
    return { lang, html: parts.join("\n") };
  });

  const files = new Map();
  for (const image of ctx.images) {
    const data = source.read(image);
    const problem = checkImage(image, data);
    if (problem) ctx.errors.push(problem);
    else files.set(image, data);
  }

  if (ctx.errors.length) {
    const error = new Error(`${project.repo}: ${ctx.errors.length} problem(s) in README.md\n${ctx.errors.map((e) => `  - ${e}`).join("\n")}`);
    error.problems = ctx.errors;
    throw error;
  }

  const html = renderPage({
    repo: project.repo,
    title,
    titleHtml,
    titleId: ctx.headingId(titleBlock.line),
    logo,
    description: [title, ...descriptions].join(" · "),
    nav,
    intro: intro.map((b) => renderBlock(b, ctx)).join("\n"),
    sections: rendered,
  });
  files.set("index.html", html);
  return { title, logo, files, warnings: ctx.warnings };
}

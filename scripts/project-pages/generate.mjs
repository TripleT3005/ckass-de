import path from "node:path";
import { stripTags } from "./html.mjs";
import { inlineText, parseBlocks, renderBlock, renderInline } from "./markdown.mjs";
import { LANGUAGES, linkButtons, redirectRules, renderPage, SUPPORTED_LANGUAGES } from "./page.mjs";
import { findSkippedLines, headingIds } from "./readme.mjs";

// Images

const IMAGE_TYPES = {
  ".png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  ".jpg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  ".jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  ".gif": (b) => /^GIF8[79]a/.test(b.subarray(0, 6).toString("latin1")),
  ".webp": (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  ".svg": (b) => isSvg(b.toString("utf8")),
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SAFE_SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const UNSAFE_SVG = /<script|<foreignObject|<!ENTITY|<!DOCTYPE|\son[a-z]+\s*=|javascript:|(?:xlink:)?href\s*=\s*["']?\s*(?!#)|url\(\s*["']?\s*(?!#)|@import/i;

function isSvg(text) {
  let rest = text.trimStart();
  if (rest.startsWith("<?xml")) {
    const end = rest.indexOf("?>");
    if (end < 0) return false;
    rest = rest.slice(end + 2).trimStart();
  }
  while (rest.startsWith("<!--")) {
    const end = rest.indexOf("-->", 4);
    if (end < 0) return false;
    rest = rest.slice(end + 3).trimStart();
  }
  return /^<svg[\s>]/.test(rest);
}

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
  const page = { lang: null, prefix: "", idLang: new Map() };

  function link(raw) {
    const url = raw.trim();
    if (!url) {
      errors.push("Link with empty target");
      return null;
    }
    if (url.startsWith("#")) {
      const id = safeDecode(url.slice(1));
      if (pageIds.has(id)) {
        const owner = page.idLang.get(id);
        return { href: page.lang && owner && owner !== page.lang ? `${page.prefix}${owner}/#${id}` : `#${id}` };
      }
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
    return page.prefix + encodePath(resolved.path);
  }

  return {
    page,
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
    if (block.type === "heading" && block.level <= 2) {
      const lang = LANGUAGES[inlineText(block.text).toLowerCase()] ?? null;
      sections.push({ heading: block, lang, id: ctx.headingId(block.line), blocks: [] });
    } else if (sections.length) sections.at(-1).blocks.push(block);
    else intro.push(block);
  }
  const languages = SUPPORTED_LANGUAGES.filter((l) => sections.some((s) => s.lang === l));
  const multi = languages.length > 1;
  for (const section of sections) {
    if (!section.lang) continue;
    if (section.id) ctx.page.idLang.set(section.id, section.lang);
    for (const block of section.blocks) {
      const id = block.type === "heading" ? ctx.headingId(block.line) : null;
      if (id) ctx.page.idLang.set(id, section.lang);
    }
  }
  const changelog = project.changelog ? ctx.link(project.changelog)?.href : null;

  function render(lang, prefix, canonical) {
    Object.assign(ctx.page, { lang: multi ? lang : null, prefix });
    const descriptions = [];
    const nav = [];
    const rendered = [];
    for (const section of sections) {
      if (multi && section.lang && section.lang !== lang) continue;
      const ownLanguage = multi && section.lang;
      if (section.id && !ownLanguage) nav.push([section.id, renderInline(section.heading.text, ctx)]);
      const parts = ownLanguage ? [] : [renderBlock({ ...section.heading, level: 2 }, ctx)];
      let buttonsPlaced = !section.lang;
      const buttons = () => linkButtons(section.lang, { repoUrl: ctx.repoUrl, download: project.download, changelog });
      for (const block of section.blocks) {
        parts.push(renderBlock(block, ctx));
        if (!buttonsPlaced && block.type === "paragraph") {
          parts.push(buttons());
          descriptions.push(firstSentence(inlineText(block.text)));
          buttonsPlaced = true;
        }
      }
      if (!buttonsPlaced) parts.splice(ownLanguage ? 0 : 1, 0, buttons());
      rendered.push({ lang: section.lang, id: ownLanguage ? section.id : null, html: parts.join("\n") });
    }
    return renderPage({
      repo: project.repo,
      slug: project.slug,
      title,
      titleHtml,
      titleId: ctx.headingId(titleBlock.line),
      logo: logo ? prefix + logo : null,
      description: [title, ...descriptions].join(" · "),
      nav: multi ? nav : sections.filter((s) => s.id).map((s) => [s.id, renderInline(s.heading.text, ctx)]),
      intro: intro.map((b) => renderBlock(b, ctx)).join("\n"),
      sections: rendered,
      lang: lang ?? "en",
      languages,
      prefix,
      canonical,
    });
  }

  const pages = new Map();
  if (multi) {
    for (const lang of languages) pages.set(`${lang}/index.html`, render(lang, "../", `/${project.slug}/${lang}/`));
    pages.set("index.html", render(languages[0], "", `/${project.slug}/${languages[0]}/`));
    pages.set(".htaccess", redirectRules(`/${project.slug}/`, languages));
  } else {
    pages.set("index.html", render(languages[0] ?? null, "", `/${project.slug}/`));
  }

  const files = new Map();
  for (const image of ctx.images) {
    const data = source.read(image);
    const problem = checkImage(image, data);
    if (problem) ctx.errors.push(problem);
    else files.set(image, data);
  }

  const problems = [...new Set(ctx.errors)];
  if (problems.length) {
    const error = new Error(`${project.repo}: ${problems.length} problem(s) in README.md\n${problems.map((e) => `  - ${e}`).join("\n")}`);
    error.problems = problems;
    throw error;
  }
  for (const [file, content] of pages) files.set(file, content);
  return { title, logo, languages, files, warnings: [...new Set(ctx.warnings)] };
}

import { escapeAttr, escapeText, HTML_COMMENT, HTML_TAG, renderHtml, renderTag, stripTags } from "./html.mjs";

// Inline

const PUNCTUATION = /[!-/:-@[-`{-~]/;
const AUTOLINK = /^<((?:https?:\/\/|mailto:)[^\s<>]+)>/i;
const BARE_URL = /^https?:\/\/[^\s<]+/i;

function isSpace(c) {
  return c === undefined || /\s/.test(c);
}

function isWord(c) {
  return c !== undefined && /[\p{L}\p{N}]/u.test(c);
}

function skipCodeSpan(src, i) {
  let run = 0;
  while (src[i + run] === "`") run++;
  const fence = "`".repeat(run);
  let j = i + run;
  while (j < src.length) {
    const k = src.indexOf(fence, j);
    if (k < 0) return -1;
    let end = k + run;
    if (src[end] !== "`" && src[k - 1] !== "`") return end;
    while (src[end] === "`") end++;
    j = end;
  }
  return -1;
}

function findBracketEnd(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") i++;
    else if (c === "`") {
      const end = skipCodeSpan(src, i);
      if (end > 0) i = end - 1;
    } else if (c === "[") depth++;
    else if (c === "]" && --depth === 0) return i;
  }
  return -1;
}

function parseDestination(src, start) {
  if (src[start] !== "(") return null;
  let i = start + 1;
  while (src[i] === " ") i++;
  let url = "";
  if (src[i] === "<") {
    const end = src.indexOf(">", i);
    if (end < 0) return null;
    url = src.slice(i + 1, end);
    i = end + 1;
  } else {
    let depth = 0;
    while (i < src.length && !/\s/.test(src[i])) {
      if (src[i] === "\\" && i + 1 < src.length) {
        url += src[i + 1];
        i += 2;
        continue;
      }
      if (src[i] === "(") depth++;
      else if (src[i] === ")" && depth-- === 0) break;
      url += src[i++];
    }
  }
  while (src[i] === " ") i++;
  let title = null;
  const quote = src[i];
  if (quote === '"' || quote === "'") {
    const end = src.indexOf(quote, i + 1);
    if (end < 0) return null;
    title = src.slice(i + 1, end);
    i = end + 1;
    while (src[i] === " ") i++;
  }
  if (src[i] !== ")") return null;
  return { url, title, end: i + 1 };
}

function findCloser(src, from, delim) {
  const char = delim[0];
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "`") {
      const end = skipCodeSpan(src, i);
      if (end > 0) i = end - 1;
      continue;
    }
    if (c === char) {
      let run = 0;
      while (src[i + run] === char) run++;
      if (run === delim.length && !isSpace(src[i - 1]) && !(char === "_" && isWord(src[i + run]))) return i;
      i += run - 1;
    }
  }
  return -1;
}

function link(text, url, ctx) {
  const target = ctx.link(url);
  if (!target) return text;
  const extra = target.external ? ' target="_blank" rel="noopener noreferrer"' : "";
  return `<a href="${escapeAttr(target.href)}"${extra}>${text}</a>`;
}

export function renderInline(src, ctx, inLink = false) {
  let out = "";
  let text = "";
  const flush = () => {
    out += escapeText(text);
    text = "";
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const rest = src.slice(i);

    if (c === "\\" && i + 1 < src.length) {
      if (src[i + 1] === "\n") {
        flush();
        out += "<br>\n";
        i += 2;
        continue;
      }
      if (PUNCTUATION.test(src[i + 1])) {
        text += src[i + 1];
        i += 2;
        continue;
      }
    }

    if (c === "\n") {
      if (/ {2,}$/.test(text)) {
        text = text.replace(/ +$/, "");
        flush();
        out += "<br>\n";
      } else {
        text = text.replace(/ +$/, "") + "\n";
      }
      i++;
      while (src[i] === " ") i++;
      continue;
    }

    if (c === "`") {
      const end = skipCodeSpan(src, i);
      if (end < 0) {
        let run = 0;
        while (src[i + run] === "`") run++;
        text += src.slice(i, i + run);
        i += run;
        continue;
      }
      let run = 0;
      while (src[i + run] === "`") run++;
      let code = src.slice(i + run, end - run).replace(/\n/g, " ");
      if (code.length > 2 && code[0] === " " && code.at(-1) === " " && code.trim()) code = code.slice(1, -1);
      flush();
      out += `<code>${escapeAttr(code)}</code>`;
      i = end;
      continue;
    }

    if (c === "!" && src[i + 1] === "[") {
      const end = findBracketEnd(src, i + 1);
      const dest = end > 0 ? parseDestination(src, end + 1) : null;
      if (dest) {
        flush();
        const alt = stripTags(renderInline(src.slice(i + 2, end), ctx, true));
        const imageSrc = ctx.image(dest.url);
        if (imageSrc) out += `<img src="${escapeAttr(imageSrc)}" alt="${escapeAttr(alt)}" loading="lazy" decoding="async">`;
        i = dest.end;
        continue;
      }
    }

    if (c === "[" && !inLink) {
      const end = findBracketEnd(src, i);
      const dest = end > 0 ? parseDestination(src, end + 1) : null;
      if (dest) {
        flush();
        out += link(renderInline(src.slice(i + 1, end), ctx, true), dest.url, ctx);
        i = dest.end;
        continue;
      }
    }

    if (c === "<") {
      const auto = AUTOLINK.exec(rest);
      if (auto && !inLink) {
        flush();
        out += link(escapeText(auto[1]), auto[1], ctx);
        i += auto[0].length;
        continue;
      }
      const comment = HTML_COMMENT.exec(rest);
      if (comment) {
        i += comment[0].length;
        continue;
      }
      const tag = HTML_TAG.exec(rest);
      if (tag) {
        flush();
        out += renderTag(tag, ctx);
        i += tag[0].length;
        continue;
      }
    }

    if ((c === "h" || c === "H") && !inLink && !isWord(src[i - 1])) {
      const bare = BARE_URL.exec(rest);
      if (bare) {
        let url = bare[0];
        for (;;) {
          const trimmed = url.replace(/[.,:;!?'"*_~]+$/, "");
          const open = (trimmed.match(/\(/g) ?? []).length;
          const close = (trimmed.match(/\)/g) ?? []).length;
          const next = trimmed.endsWith(")") && close > open ? trimmed.slice(0, -1) : trimmed;
          if (next === url) break;
          url = next;
        }
        flush();
        out += link(escapeText(url), url, ctx);
        i += url.length;
        continue;
      }
    }

    if ((c === "*" || c === "_" || c === "~") && !isSpace(src[i + 1])) {
      let run = 0;
      while (src[i + run] === c) run++;
      const canOpen = c !== "_" || !isWord(src[i - 1]);
      if (canOpen && (c !== "~" || run === 2)) {
        const size = c === "~" ? 2 : Math.min(run, 2);
        const delim = c.repeat(size);
        const close = findCloser(src, i + size, delim);
        if (close > i + size) {
          flush();
          const inner = renderInline(src.slice(i + size, close), ctx, inLink);
          const tag = c === "~" ? "del" : size === 2 ? "strong" : "em";
          out += `<${tag}>${inner}</${tag}>`;
          i = close + size;
          continue;
        }
      }
      text += c.repeat(run);
      i += run;
      continue;
    }

    text += c;
    i++;
  }
  flush();
  return out;
}

export function inlineText(src, trim = true) {
  const ctx = { link: () => null, image: () => null, warn: () => {} };
  const text = stripTags(renderInline(src, ctx));
  return trim ? text.trim() : text;
}

// Blocks

const FENCE = /^( {0,3})(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}> ?/;
const LIST_ITEM = /^( {0,3})([-+*]|\d{1,9}[.)])( {1,4}(?! )|[ \t]*$)/;
const TABLE_DELIMITER = /^ {0,3}\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const BLOCK_TAGS = new Set(
  "address article aside blockquote body caption center col colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hr html iframe legend li link main menu nav ol optgroup option p param search section summary table tbody td tfoot th thead title tr track ul".split(" "),
);

function isBlank(line) {
  return line.trim() === "";
}

function htmlBlockStart(line) {
  if (/^ {0,3}<!--/.test(line)) return "comment";
  const m = /^ {0,3}<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s|\/?>|$)/.exec(line);
  if (m && BLOCK_TAGS.has(m[1].toLowerCase())) return "block";
  const tag = HTML_TAG.exec(line.trim());
  if (tag && tag[0] === line.trim()) return "tag";
  return null;
}

function interruptsParagraph(line) {
  if (FENCE.test(line) || ATX.test(line) || HR.test(line) || QUOTE.test(line)) return true;
  const item = LIST_ITEM.exec(line);
  if (item && !isBlank(line.slice(item[0].length)) && (/[-+*]/.test(item[2]) || /^1[.)]$/.test(item[2]))) return true;
  const html = htmlBlockStart(line);
  return html === "comment" || html === "block";
}

function splitRow(line) {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);
  const cells = [];
  let cell = "";
  for (let i = 0; i < row.length; i++) {
    if (row[i] === "\\" && row[i + 1] === "|") {
      cell += "|";
      i++;
    } else if (row[i] === "`") {
      const end = skipCodeSpan(row, i);
      if (end > 0) {
        cell += row.slice(i, end).replace(/\\\|/g, "|");
        i = end - 1;
      } else cell += row[i];
    } else if (row[i] === "|") {
      cells.push(cell.trim());
      cell = "";
    } else cell += row[i];
  }
  cells.push(cell.trim());
  return cells;
}

function indentOf(line) {
  return line.length - line.trimStart().length;
}

function dedent(line, amount) {
  let i = 0;
  while (i < amount && line[i] === " ") i++;
  return line.slice(i);
}

export function parseBlocks(lines, lineNumbers = null) {
  const blocks = [];
  let i = 0;
  const at = (k) => (lineNumbers ? lineNumbers[k] : null);

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const [, indent, marker, lang] = fence;
      const body = [];
      i++;
      while (i < lines.length) {
        const close = new RegExp(`^ {0,3}${marker[0] === "`" ? "`" : "~"}{${marker.length},}\\s*$`);
        if (close.test(lines[i])) {
          i++;
          break;
        }
        body.push(dedent(lines[i], indent.length));
        i++;
      }
      blocks.push({ type: "code", lang, text: body.join("\n") });
      continue;
    }

    const atx = ATX.exec(line);
    if (atx) {
      blocks.push({ type: "heading", level: atx[1].length, text: atx[2] ?? "", line: at(i) });
      i++;
      continue;
    }

    if (HR.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    if (indentOf(line) >= 4) {
      const body = [];
      while (i < lines.length && (indentOf(lines[i]) >= 4 || isBlank(lines[i]))) body.push(dedent(lines[i++], 4));
      while (body.length && isBlank(body.at(-1))) body.pop();
      blocks.push({ type: "code", lang: "", text: body.join("\n") });
      continue;
    }

    if (QUOTE.test(line)) {
      const body = [];
      while (i < lines.length && !isBlank(lines[i])) {
        if (QUOTE.test(lines[i])) body.push(lines[i].replace(QUOTE, ""));
        else if (!interruptsParagraph(lines[i])) body.push(lines[i]);
        else break;
        i++;
      }
      blocks.push({ type: "blockquote", children: parseBlocks(body) });
      continue;
    }

    const item = LIST_ITEM.exec(line);
    if (item) {
      const ordered = /\d/.test(item[2]);
      const markerKind = ordered ? item[2].at(-1) : item[2];
      const list = { type: "list", ordered, start: ordered ? parseInt(item[2], 10) : 1, tight: true, items: [] };
      let sawBlank = false;
      while (i < lines.length) {
        const m = LIST_ITEM.exec(lines[i]);
        if (!m || (ordered ? !/\d/.test(m[2]) || m[2].at(-1) !== markerKind : m[2] !== markerKind)) break;
        if (sawBlank) list.tight = false;
        const offset = m[1].length + m[2].length + (isBlank(m[3]) ? 1 : m[3].length);
        const body = [lines[i].slice(m[0].length)];
        i++;
        sawBlank = false;
        while (i < lines.length) {
          const next = lines[i];
          if (isBlank(next)) {
            body.push("");
            sawBlank = true;
            i++;
            continue;
          }
          if (indentOf(next) >= offset) {
            if (sawBlank) list.tight = false;
            body.push(dedent(next, offset));
            sawBlank = false;
            i++;
            continue;
          }
          if (!sawBlank && !interruptsParagraph(next) && !LIST_ITEM.test(next)) {
            body.push(next.trim());
            i++;
            continue;
          }
          break;
        }
        while (body.length && isBlank(body.at(-1))) body.pop();
        list.items.push(parseBlocks(body));
      }
      blocks.push(list);
      continue;
    }

    const html = htmlBlockStart(line);
    if (html) {
      const body = [];
      if (html === "comment") {
        while (i < lines.length) {
          body.push(lines[i]);
          if (lines[i++].includes("-->")) break;
        }
      } else {
        while (i < lines.length && !isBlank(lines[i])) body.push(lines[i++]);
      }
      blocks.push({ type: "html", text: body.join("\n") });
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && TABLE_DELIMITER.test(lines[i + 1])) {
      const head = splitRow(line);
      const delimiter = splitRow(lines[i + 1]);
      if (head.length === delimiter.length) {
        const align = delimiter.map((d) => (d.startsWith(":") && d.endsWith(":") ? "center" : d.endsWith(":") ? "right" : d.startsWith(":") ? "left" : null));
        const rows = [];
        i += 2;
        while (i < lines.length && !isBlank(lines[i]) && !interruptsParagraph(lines[i])) {
          const cells = splitRow(lines[i++]);
          rows.push(head.map((_, k) => cells[k] ?? ""));
        }
        blocks.push({ type: "table", align, head, rows });
        continue;
      }
    }

    const body = [line];
    i++;
    while (i < lines.length && !isBlank(lines[i]) && !interruptsParagraph(lines[i])) body.push(lines[i++]);
    blocks.push({ type: "paragraph", text: body.join("\n").trim() });
  }
  return blocks;
}

// Rendering

export function renderBlocks(blocks, ctx, tight = false) {
  return blocks.map((block) => renderBlock(block, ctx, tight)).join("\n");
}

export function renderBlock(block, ctx, tight = false) {
  switch (block.type) {
    case "heading": {
      const id = block.line !== null && block.line !== undefined ? ctx.headingId(block.line) : null;
      const attr = id ? ` id="${escapeAttr(id)}"` : "";
      return `<h${block.level}${attr}>${renderInline(block.text, ctx)}</h${block.level}>`;
    }
    case "paragraph": {
      const inner = renderInline(block.text, ctx);
      return tight ? inner : `<p>${inner}</p>`;
    }
    case "code":
      return `<pre><code>${escapeAttr(block.text)}</code></pre>`;
    case "hr":
      return "<hr>";
    case "html":
      return renderHtml(block.text, ctx);
    case "blockquote":
      return `<blockquote>\n${renderBlocks(block.children, ctx)}\n</blockquote>`;
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      const start = block.ordered && block.start !== 1 ? ` start="${block.start}"` : "";
      const items = block.items.map((item) => `<li>${renderBlocks(item, ctx, block.tight)}</li>`);
      return `<${tag}${start}>\n${items.join("\n")}\n</${tag}>`;
    }
    case "table": {
      const cell = (tag, text, k) => {
        const align = block.align[k] ? ` style="text-align:${block.align[k]}"` : "";
        return `<${tag}${align}>${renderInline(text, ctx)}</${tag}>`;
      };
      const head = `<tr>${block.head.map((t, k) => cell("th", t, k)).join("")}</tr>`;
      const rows = block.rows.map((row) => `<tr>${row.map((t, k) => cell("td", t, k)).join("")}</tr>`);
      return `<div class="table"><table>\n<thead>${head}</thead>\n<tbody>\n${rows.join("\n")}\n</tbody>\n</table></div>`;
    }
    default:
      throw new Error(`Unknown block ${block.type}`);
  }
}

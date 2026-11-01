// Escaping

const ENTITY = /^&(?:#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/;

export function escapeText(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "&") {
      const m = ENTITY.exec(text.slice(i, i + 40));
      if (m) {
        out += m[0];
        i += m[0].length - 1;
      } else {
        out += "&amp;";
      }
    } else if (c === "<") out += "&lt;";
    else if (c === ">") out += "&gt;";
    else if (c === '"') out += "&quot;";
    else out += c;
  }
  return out;
}

export function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function decodeEntities(text) {
  return text.replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|amp|lt|gt|quot|apos|nbsp);/g, (_, e) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[e];
  });
}

export function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>?/g, ""));
}

// Raw HTML

const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const ALIGN = new Set(["left", "right", "top", "middle", "bottom", "center"]);
export const HTML_TAG = /^<(\/?)([A-Za-z][A-Za-z0-9-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/;
export const HTML_COMMENT = /^<!--[\s\S]*?-->/;

function parseAttributes(source) {
  const attrs = new Map();
  for (const m of source.matchAll(ATTRIBUTE)) {
    const name = m[1].toLowerCase();
    if (!attrs.has(name)) attrs.set(name, decodeEntities(m[2] ?? m[3] ?? m[4] ?? ""));
  }
  return attrs;
}

export function renderTag(match, ctx) {
  const [source, closing, rawName, rawAttrs] = match;
  const name = rawName.toLowerCase();
  if (name === "p" || name === "br") {
    if (name === "br") return closing ? "" : "<br>";
    return closing ? "</p>" : "<p>";
  }
  if (name === "img" && !closing) {
    const attrs = parseAttributes(rawAttrs);
    const src = ctx.image(attrs.get("src") ?? "");
    if (!src) return "";
    let out = `<img src="${escapeAttr(src)}" alt="${escapeAttr(attrs.get("alt") ?? "")}"`;
    const width = attrs.get("width");
    if (width !== undefined) {
      if (/^\d{1,4}%?$/.test(width)) out += ` width="${width}"`;
      else ctx.warn(`Ignored width "${width}" on <img>`);
    }
    const align = attrs.get("align")?.toLowerCase();
    if (align !== undefined) {
      if (ALIGN.has(align)) out += ` align="${align}"`;
      else ctx.warn(`Ignored align "${align}" on <img>`);
    }
    return out + ' loading="lazy" decoding="async">';
  }
  ctx.warn(`Escaped unsupported HTML ${source}`);
  return escapeText(source);
}

export function renderHtml(source, ctx) {
  let out = "";
  let text = "";
  let i = 0;
  while (i < source.length) {
    if (source[i] === "<") {
      const rest = source.slice(i);
      const comment = HTML_COMMENT.exec(rest);
      if (comment) {
        i += comment[0].length;
        continue;
      }
      const tag = HTML_TAG.exec(rest);
      if (tag) {
        out += escapeText(text) + renderTag(tag, ctx);
        text = "";
        i += tag[0].length;
        continue;
      }
    }
    text += source[i++];
  }
  return out + escapeText(text);
}

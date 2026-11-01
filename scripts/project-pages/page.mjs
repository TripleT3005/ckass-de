import { escapeAttr, escapeText } from "./html.mjs";

// Styles

const STYLE = `:root{--bg:#F3F4F1;--ink:#1B2B23;--muted:#6B7A72;--accent:#2F6B4E;--line:#D9DDD8;--code:#E6E9E4;color-scheme:light;box-sizing:border-box}
@media (prefers-color-scheme:dark){:root{--bg:#111614;--ink:#E5EAE6;--muted:#8A9A91;--accent:#86BC9C;--line:#26302B;--code:#1B2320;color-scheme:dark}}
*,*::before,*::after{box-sizing:inherit}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI Variable","Segoe UI",Roboto,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
main{max-width:46rem;margin:0 auto;padding:3rem 1.5rem calc(3rem + env(safe-area-inset-bottom,0px))}
header{display:flex;align-items:center;gap:1rem}
header img{width:4rem;height:4rem}
h1{margin:0;font-size:clamp(1.9rem,6vw,2.6rem);line-height:1.1;letter-spacing:-.02em;font-weight:600}
h2{margin:3rem 0 .5rem;font-size:1.5rem;letter-spacing:-.01em}
h3{margin:1.75rem 0 .25rem;font-size:1.1rem}
h4,h5,h6{margin:1.25rem 0 .25rem;font-size:1rem}
p,ul,ol{margin:.5rem 0}
ul,ol{padding-left:1.25rem}
li{margin:.25rem 0}
li>ul,li>ol{margin:.25rem 0}
a{color:var(--accent)}
a:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
code{font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace;font-size:.875em;background:var(--code);padding:.1em .35em;border-radius:.3rem;overflow-wrap:anywhere}
pre{margin:.75rem 0;padding:.75rem 1rem;background:var(--code);border-radius:.5rem;overflow-x:auto;line-height:1.45}
pre code{padding:0;background:none;overflow-wrap:normal}
blockquote{margin:1rem 0;padding:0 0 0 1rem;border-left:3px solid var(--line);color:var(--muted)}
.table{margin:.75rem 0;overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:.95rem}
th,td{padding:.4rem .75rem .4rem 0;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{font-weight:600}
img{max-width:100%;height:auto}
p>img{border-radius:.5rem;vertical-align:top}
@media (max-width:40rem){p>img[width$="%"]{display:block;width:100%;margin:.75rem 0}}
.lang{margin-top:1rem;color:var(--muted)}
.links{display:flex;flex-wrap:wrap;gap:.75rem;margin:1.5rem 0}
.links a{padding:.6rem 1.4rem;border:1px solid var(--muted);border-radius:999px;color:var(--ink);text-decoration:none;transition:background .2s,color .2s,border-color .2s}
.links a:hover{background:var(--ink);color:var(--bg);border-color:var(--ink)}
section+section{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--line)}
footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--line);color:var(--muted);font-size:.9rem}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.links a{transition:none}}`;

// Labels

const LABELS = {
  en: { download: "Download", source: "Source code", support: "Support" },
  de: { download: "Download", source: "Quellcode", support: "Support" },
};

export const LANGUAGES = { english: "en", deutsch: "de" };
export const GENERATED_MARK = "by scripts/project-pages -->";

export function linkButtons(language, { repoUrl, download }) {
  const labels = LABELS[language] ?? LABELS.en;
  const links = [];
  if (download) links.push([`${repoUrl}/releases/latest`, labels.download]);
  links.push([repoUrl, labels.source], [`${repoUrl}/issues`, labels.support]);
  const anchors = links.map(([href, label]) => `  <a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeText(label)}</a>`);
  return `<div class="links">\n${anchors.join("\n")}\n</div>`;
}

// Page

export function renderPage({ repo, title, titleHtml, titleId, logo, description, nav, intro, sections }) {
  const icon = logo ? `<link rel="icon" href="${escapeAttr(logo)}"${logo.endsWith(".svg") ? ' type="image/svg+xml"' : ""}>` : '<link rel="icon" href="/favicon.svg" type="image/svg+xml">';
  const logoImg = logo ? `\n    <img src="${escapeAttr(logo)}" alt="" width="64" height="64">` : "";
  const navHtml = nav.length ? `\n  <p class="lang">${nav.map(([id, label]) => `<a href="#${escapeAttr(id)}">${label}</a>`).join(" · ")}</p>` : "";
  const introHtml = intro ? `\n\n${intro}` : "";
  const sectionHtml = sections.map(({ lang, html }) => `<section${lang ? ` lang="${lang}"` : ""}>\n${html}\n</section>`).join("\n\n");
  return `<!DOCTYPE html>
<!-- Generated from README.md of ${escapeText(repo)} by scripts/project-pages -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${escapeAttr(description)}">
<title>${escapeText(title)}</title>
${icon}
<style>
${STYLE}
</style>
</head>
<body>
<main>
  <header>${logoImg}
    <h1${titleId ? ` id="${escapeAttr(titleId)}"` : ""}>${titleHtml}</h1>
  </header>${navHtml}${introHtml}

${sectionHtml}

  <footer><a href="/">ckass.de</a> · <a href="https://github.com/${escapeAttr(repo)}" target="_blank" rel="noopener noreferrer">${escapeText(repo)}</a></footer>
</main>
</body>
</html>
`;
}

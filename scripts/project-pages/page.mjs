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
.switch{display:none;gap:.25rem;margin-left:auto;align-self:flex-start}
html[data-lang] .switch{display:flex}
.switch button{display:flex;padding:.35rem;border:1px solid transparent;border-radius:.4rem;background:none;cursor:pointer;opacity:.45;transition:opacity .2s,border-color .2s}
.switch button:hover{opacity:.8}
.switch button[aria-pressed="true"]{opacity:1;border-color:var(--line)}
.switch button:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.switch svg{display:block;width:1.75rem;height:1.15rem;border-radius:.15rem}
html[data-lang] section[data-lang]{display:none}
html:not([data-lang]) section+section,html[data-lang] section:not([data-lang]){margin-top:3rem;padding-top:1rem;border-top:1px solid var(--line)}
.links{display:flex;flex-wrap:wrap;gap:.75rem;margin:1.5rem 0}
.links a{padding:.6rem 1.4rem;border:1px solid var(--muted);border-radius:999px;color:var(--ink);text-decoration:none;transition:background .2s,color .2s,border-color .2s}
.links a:hover{background:var(--ink);color:var(--bg);border-color:var(--ink)}
footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--line);color:var(--muted);font-size:.9rem}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.links a,.switch button{transition:none}}`;

// Language switch

const FLAGS = {
  en: {
    label: "English",
    svg: '<svg viewBox="0 0 60 40" preserveAspectRatio="none" aria-hidden="true"><clipPath id="flag-en-gb"><path d="M0 0L60 40H0z"/></clipPath><clipPath id="flag-en-us"><path d="M0 0H60V40z"/></clipPath><clipPath id="flag-gb-t"><path d="M30 15h30v15zv15H0zH0V0zV0h30z"/></clipPath><g clip-path="url(#flag-en-gb)"><svg width="60" height="40" viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice"><path fill="#012169" d="M0 0h60v30H0z"/><path stroke="#fff" stroke-width="6" d="M0 0l60 30m0-30L0 30"/><path stroke="#C8102E" stroke-width="4" clip-path="url(#flag-gb-t)" d="M0 0l60 30m0-30L0 30"/><path stroke="#fff" stroke-width="10" d="M30 0v30M0 15h60"/><path stroke="#C8102E" stroke-width="6" d="M30 0v30M0 15h60"/></svg></g><g clip-path="url(#flag-en-us)"><path fill="#fff" d="M0 0h60v40H0z"/><path stroke="#B22234" stroke-width="3.08" d="M0 1.54h60M0 7.69h60M0 13.85h60M0 20h60M0 26.15h60M0 32.31h60M0 38.46h60"/><path fill="#3C3B6E" d="M0 0h24v21.5H0z"/><g fill="#fff"><circle cx="12" cy="4" r="1.2"/><circle cx="17" cy="4" r="1.2"/><circle cx="22" cy="4" r="1.2"/><circle cx="19.5" cy="8.5" r="1.2"/><circle cx="22" cy="13" r="1.2"/></g></g><path stroke="#fff" stroke-width="1.2" d="M0 0L60 40"/></svg>',
  },
  de: {
    label: "Deutsch",
    svg: '<svg viewBox="0 0 5 3" preserveAspectRatio="none" aria-hidden="true"><path fill="#000" d="M0 0h5v1H0z"/><path fill="#D00" d="M0 1h5v1H0z"/><path fill="#FFCE00" d="M0 2h5v1H0z"/></svg>',
  },
};

export function headScript(languages) {
  return `<script>(function(){var s=${JSON.stringify(languages)},r=document.documentElement,l;try{l=localStorage.getItem("lang")}catch(e){}if(s.indexOf(l)<0){l=s[0];var n=navigator.languages||[navigator.language||""];for(var i=0;i<n.length;i++){var c=String(n[i]).toLowerCase().split("-")[0];if(s.indexOf(c)>=0){l=c;break}}}r.lang=l;r.dataset.lang=l})();</script>`;
}

export const BODY_SCRIPT = `<script>(function(){var r=document.documentElement,b=document.querySelectorAll("[data-set-lang]");function set(l,save){r.lang=l;r.dataset.lang=l;if(save)try{localStorage.setItem("lang",l)}catch(e){}for(var i=0;i<b.length;i++)b[i].setAttribute("aria-pressed",String(b[i].getAttribute("data-set-lang")===l))}for(var i=0;i<b.length;i++)b[i].addEventListener("click",function(){set(this.getAttribute("data-set-lang"),true)});function follow(){var t=null;try{t=document.getElementById(decodeURIComponent(location.hash.slice(1)))}catch(e){}var s=t&&t.closest("section[data-lang]");if(s&&s.getAttribute("data-lang")!==r.dataset.lang){set(s.getAttribute("data-lang"),false);t.scrollIntoView()}}addEventListener("hashchange",follow);set(r.dataset.lang,false);follow()})();</script>`;

function languageStyle(languages) {
  return languages.map((l) => `html[data-lang="${l}"] section[data-lang="${l}"]`).join(",") + "{display:block}";
}

function languageSwitch(languages) {
  const buttons = languages.map((l) => `      <button type="button" data-set-lang="${l}" lang="${l}" aria-pressed="false" aria-label="${FLAGS[l].label}" title="${FLAGS[l].label}">${FLAGS[l].svg}</button>`);
  return `\n    <div class="switch" role="group" aria-label="Language / Sprache">\n${buttons.join("\n")}\n    </div>`;
}

// Labels

const LABELS = {
  en: { download: "Download", changelog: "Changelog", source: "Source code", support: "Support" },
  de: { download: "Download", changelog: "Changelog", source: "Quellcode", support: "Support" },
};

export const LANGUAGES = { english: "en", deutsch: "de" };
export const GENERATED_MARK = "by scripts/project-pages -->";

export function linkButtons(language, { repoUrl, download, changelog }) {
  const labels = LABELS[language] ?? LABELS.en;
  const links = [];
  if (download) links.push([`${repoUrl}/releases/latest`, labels.download]);
  if (changelog) links.push([changelog, labels.changelog]);
  links.push([repoUrl, labels.source], [`${repoUrl}/issues`, labels.support]);
  const anchors = links.map(([href, label]) => `  <a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeText(label)}</a>`);
  return `<div class="links">\n${anchors.join("\n")}\n</div>`;
}

// Page

export function renderPage({ repo, title, titleHtml, titleId, logo, description, nav, intro, sections }) {
  const icon = logo ? `<link rel="icon" href="${escapeAttr(logo)}"${logo.endsWith(".svg") ? ' type="image/svg+xml"' : ""}>` : '<link rel="icon" href="/favicon.svg" type="image/svg+xml">';
  const logoImg = logo ? `\n    <img src="${escapeAttr(logo)}" alt="" width="64" height="64">` : "";
  const languages = Object.keys(FLAGS).filter((l) => sections.some((s) => s.lang === l));
  const switchable = languages.length > 1;
  const links = switchable ? nav.filter(([, , lang]) => !lang) : nav;
  const navHtml = links.length ? `\n  <p class="lang">${links.map(([id, label]) => `<a href="#${escapeAttr(id)}">${label}</a>`).join(" · ")}</p>` : "";
  const introHtml = intro ? `\n\n${intro}` : "";
  const sectionHtml = sections
    .map(({ lang, html }) => {
      const attrs = lang ? `${switchable ? ` data-lang="${lang}"` : ""}${lang !== "en" ? ` lang="${lang}"` : ""}` : "";
      return `<section${attrs}>\n${html}\n</section>`;
    })
    .join("\n\n");
  const head = switchable ? `\n${headScript(languages)}` : "";
  const style = switchable ? `${STYLE}\n${languageStyle(languages)}` : STYLE;
  const body = switchable ? `\n${BODY_SCRIPT}` : "";
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
${style}
</style>${head}
</head>
<body>
<main>
  <header>${logoImg}
    <h1${titleId ? ` id="${escapeAttr(titleId)}"` : ""}>${titleHtml}</h1>${switchable ? languageSwitch(languages) : ""}
  </header>${navHtml}${introHtml}

${sectionHtml}

  <footer><a href="/">ckass.de</a> · <a href="https://github.com/${escapeAttr(repo)}" target="_blank" rel="noopener noreferrer">${escapeText(repo)}</a></footer>
</main>${body}
</body>
</html>
`;
}

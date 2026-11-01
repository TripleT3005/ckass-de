import { escapeAttr, escapeText } from "./html.mjs";

// Styles

export const SWITCH_STYLE = `.switch{display:flex;gap:.25rem}
.switch a{display:flex;padding:.35rem;border:1px solid transparent;border-radius:.4rem;opacity:.45;transition:opacity .2s,border-color .2s}
.switch a:hover{opacity:.8}
.switch a[aria-current="page"]{opacity:1;border-color:var(--line)}
.switch a:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.switch svg{display:block;width:1.75rem;height:1.15rem;border-radius:.15rem}
@media (prefers-reduced-motion:reduce){.switch a{transition:none}}`;

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
.switch{margin-left:auto;align-self:flex-start}
${SWITCH_STYLE}
section+section{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--line)}
.links{display:flex;flex-wrap:wrap;gap:.75rem;margin:1.5rem 0}
.links a{padding:.6rem 1.4rem;border:1px solid var(--muted);border-radius:999px;color:var(--ink);text-decoration:none;transition:background .2s,color .2s,border-color .2s}
.links a:hover{background:var(--ink);color:var(--bg);border-color:var(--ink)}
footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--line);color:var(--muted);font-size:.9rem}
img.zoomable{cursor:zoom-in}
img.zoomable:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
dialog.zoom{max-width:none;max-height:none;margin:auto;padding:0;border:0;background:none;overflow:visible}
dialog.zoom::backdrop{background:rgb(0 0 0 / .85)}
dialog.zoom[open]{animation:zoom-in .15s ease-out}
dialog.zoom img{display:block;max-width:96vw;max-height:96vh;width:auto;height:auto;border-radius:.5rem;cursor:zoom-out}
@keyframes zoom-in{from{opacity:0;transform:scale(.96)}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.links a,.switch a{transition:none}dialog.zoom[open]{animation:none}}`;

// Zoom

export const ZOOM_SCRIPT = `<script>
(function(){
  var label = document.documentElement.lang === "de" ? "Bild vergrößern" : "Enlarge image";
  var dialog = document.createElement("dialog"), large = document.createElement("img");
  dialog.className = "zoom";
  dialog.appendChild(large);
  document.body.appendChild(dialog);
  dialog.addEventListener("click", function(){ dialog.close(); });
  dialog.addEventListener("close", function(){ large.removeAttribute("src"); });
  function open(img){
    large.src = img.currentSrc || img.src;
    large.alt = img.alt;
    dialog.setAttribute("aria-label", img.alt || label);
    (large.decode ? large.decode() : Promise.resolve()).catch(function(){}).then(function(){ if (!dialog.open) dialog.showModal(); });
  }
  function prepare(img){
    if (img.naturalWidth <= img.clientWidth + 1 || img.classList.contains("zoomable")) return;
    img.classList.add("zoomable");
    img.tabIndex = 0;
    img.setAttribute("role", "button");
    img.title = label;
    img.addEventListener("click", function(){ open(img); });
    img.addEventListener("keydown", function(e){ if (e.key === "Enter" || e.key === " "){ e.preventDefault(); open(img); } });
  }
  [].forEach.call(document.querySelectorAll("section img, main > p img"), function(img){
    if (img.complete) prepare(img); else img.addEventListener("load", function(){ prepare(img); });
  });
  addEventListener("resize", function(){ [].forEach.call(document.querySelectorAll("section img, main > p img"), prepare); });
})();
</script>`;

// Language switch

function star(cx, cy, r) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 ? r * 0.382 : r;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  });
  return `M${points.join("L")}z`;
}

const US_STARS = [[3, 2.5], [8, 2.5], [13, 2.5], [18, 2.5], [5.5, 6.5], [10.5, 6.5], [15.5, 6.5], [20.5, 6.5], [13, 10.5], [18, 10.5], [20.5, 14.5], [18, 18.5]]
  .map(([x, y]) => star(x, y, 1.7))
  .join("");

const FLAGS = {
  en: {
    label: "English",
    svg: `<svg viewBox="0 0 60 40" preserveAspectRatio="none" aria-hidden="true"><clipPath id="flag-en-gb"><path d="M0 0L60 40H0z"/></clipPath><clipPath id="flag-en-us"><path d="M0 0H60V40z"/></clipPath><clipPath id="flag-gb-t"><path d="M30 15h30v15zv15H0zH0V0zV0h30z"/></clipPath><g clip-path="url(#flag-en-gb)"><svg width="60" height="40" viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice"><path fill="#012169" d="M0 0h60v30H0z"/><path stroke="#fff" stroke-width="6" d="M0 0l60 30m0-30L0 30"/><path stroke="#C8102E" stroke-width="4" clip-path="url(#flag-gb-t)" d="M0 0l60 30m0-30L0 30"/><path stroke="#fff" stroke-width="10" d="M30 0v30M0 15h60"/><path stroke="#C8102E" stroke-width="6" d="M30 0v30M0 15h60"/></svg></g><g clip-path="url(#flag-en-us)"><path fill="#fff" d="M0 0h60v40H0z"/><path stroke="#B22234" stroke-width="3.08" d="M0 1.54h60M0 7.69h60M0 13.85h60M0 20h60M0 26.15h60M0 32.31h60M0 38.46h60"/><path fill="#3C3B6E" d="M0 0h24v21.5H0z"/><path fill="#fff" d="${US_STARS}"/></g><path stroke="#fff" stroke-width="1.2" d="M0 0L60 40"/></svg>`,
  },
  de: {
    label: "Deutsch",
    svg: '<svg viewBox="0 0 5 3" preserveAspectRatio="none" aria-hidden="true"><path fill="#000" d="M0 0h5v1H0z"/><path fill="#D00" d="M0 1h5v1H0z"/><path fill="#FFCE00" d="M0 2h5v1H0z"/></svg>',
  },
};

export const SUPPORTED_LANGUAGES = Object.keys(FLAGS);

export function languageSwitch(languages, current, prefix) {
  const links = languages.map((l) => {
    const currentAttr = l === current ? ' aria-current="page"' : "";
    return `      <a href="${prefix}${l}/" hreflang="${l}" lang="${l}"${currentAttr} aria-label="${FLAGS[l].label}" title="${FLAGS[l].label}">${FLAGS[l].svg}</a>`;
  });
  return `\n    <nav class="switch" aria-label="Language / Sprache">\n${links.join("\n")}\n    </nav>`;
}

// Redirect

export function acceptLanguagePattern(language, languages) {
  return String.raw`^(?:\s*(?!(?:${languages.join("|")})\b)[^,]*,)*\s*${language}\b`;
}

export function redirectRules(base, languages) {
  const [fallback, ...rest] = languages;
  const target = String.raw`^(index\.html)?$`;
  const lines = ["<IfModule mod_rewrite.c>", "RewriteEngine On"];
  for (const l of rest) {
    lines.push(`RewriteCond %{HTTP:Accept-Language} ${acceptLanguagePattern(l, languages)} [NC]`, `RewriteRule ${target} ${base}${l}/ [R=302,L,E=LANGUAGE_REDIRECT:1]`);
  }
  lines.push(`RewriteRule ${target} ${base}${fallback}/ [R=302,L,E=LANGUAGE_REDIRECT:1]`, "</IfModule>", "<IfModule mod_headers.c>", "Header always merge Vary Accept-Language env=LANGUAGE_REDIRECT", "</IfModule>", "");
  return lines.join("\n");
}

// Labels

const LABELS = {
  en: { download: "Download", changelog: "Changelog", source: "Source code", support: "Support" },
  de: { download: "Download", changelog: "Changelog", source: "Quellcode", support: "Support" },
};

export const LANGUAGES = { english: "en", deutsch: "de" };
export const GENERATED_MARK = "by scripts/project-pages -->";
export const SITE = "https://ckass.de";

const LOCALES = { en: "en_US", de: "de_DE" };

export function openGraph({ title, description, url, lang }) {
  const tags = [
    ["og:type", "website"],
    ["og:site_name", "ckass.de"],
    ["og:title", title],
    ["og:description", description],
    ["og:url", url],
    ["og:locale", LOCALES[lang] ?? LOCALES.en],
  ];
  return tags.map(([property, content]) => `\n<meta property="${property}" content="${escapeAttr(content)}">`).join("");
}

// Structured data

export const AUTHOR = {
  "@type": "Person",
  "@id": `${SITE}/#author`,
  name: "TripleT3005",
  alternateName: "ckass",
  url: `${SITE}/`,
  sameAs: ["https://github.com/TripleT3005", "https://www.twitch.tv/TripleT3005"],
};

export function jsonLd(graph) {
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
  return `\n<script type="application/ld+json">${json}</script>`;
}

export function projectData({ repo, title, summary, url, home, lang, download }) {
  return jsonLd([
    {
      "@type": "SoftwareApplication",
      name: title,
      description: summary || title,
      url,
      inLanguage: lang,
      author: AUTHOR,
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      ...(download ? { downloadUrl: download } : {}),
      sameAs: `https://github.com/${repo}`,
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "ckass", item: SITE + home },
        { "@type": "ListItem", position: 2, name: title, item: url },
      ],
    },
  ]);
}

export function homeData({ url, lang, description }) {
  return jsonLd([{ "@type": "WebSite", "@id": `${SITE}/#website`, name: "ckass", alternateName: "ckass.de", url: `${SITE}/`, inLanguage: lang, description, publisher: { "@id": AUTHOR["@id"] } }, AUTHOR, { "@type": "ProfilePage", url, mainEntity: { "@id": AUTHOR["@id"] } }]);
}

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

export function renderPage({ repo, slug, title, titleHtml, titleId, logo, description, summary, download, nav, intro, sections, lang, languages, prefix, canonical }) {
  const switchable = languages.length > 1;
  const home = switchable ? `/${lang}/` : "/";
  const icon = logo ? `<link rel="icon" href="${escapeAttr(logo)}"${logo.endsWith(".svg") ? ' type="image/svg+xml"' : ""}>` : '<link rel="icon" href="/favicon.svg" type="image/svg+xml">';
  const logoImg = logo ? `\n    <img src="${escapeAttr(logo)}" alt="" width="64" height="64">` : "";
  const alternates = switchable ? [...languages.map((l) => [l, `/${slug}/${l}/`]), ["x-default", `/${slug}/`]].map(([l, href]) => `\n<link rel="alternate" hreflang="${l}" href="${SITE}${href}">`).join("") : "";
  const canonicalLink = `\n<link rel="canonical" href="${SITE}${escapeAttr(canonical)}">${openGraph({ title, description, url: SITE + canonical, lang })}${projectData({ repo, title, summary, url: SITE + canonical, home, lang, download })}`;
  const navHtml = nav.length ? `\n  <p class="lang">${nav.map(([id, label]) => `<a href="#${escapeAttr(id)}">${label}</a>`).join(" · ")}</p>` : "";
  const introHtml = intro ? `\n\n${intro}` : "";
  const sectionHtml = sections
    .map((s) => {
      const id = s.id ? ` id="${escapeAttr(s.id)}"` : "";
      const sectionLang = s.lang && s.lang !== lang ? ` lang="${s.lang}"` : "";
      return `<section${id}${sectionLang}>\n${s.html}\n</section>`;
    })
    .join("\n\n");
  return `<!DOCTYPE html>
<!-- Generated from README.md of ${escapeText(repo)} by scripts/project-pages -->
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${escapeAttr(description)}">
<title>${escapeText(title)}</title>
${icon}${canonicalLink}${alternates}
<style>
${STYLE}
</style>
</head>
<body>
<main>
  <header>${logoImg}
    <h1${titleId ? ` id="${escapeAttr(titleId)}"` : ""}>${titleHtml}</h1>${switchable ? languageSwitch(languages, lang, prefix) : ""}
  </header>${navHtml}${introHtml}

${sectionHtml}

  <footer><a href="${home}">ckass.de</a> · <a href="https://github.com/${escapeAttr(repo)}" target="_blank" rel="noopener noreferrer">${escapeText(repo)}</a></footer>
</main>${/<img /.test(introHtml + sectionHtml) ? `\n${ZOOM_SCRIPT}` : ""}
</body>
</html>
`;
}

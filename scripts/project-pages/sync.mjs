import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateProject } from "./generate.mjs";
import { escapeAttr, escapeText } from "./html.mjs";
import { GENERATED_MARK, languageSwitch, openGraph, redirectRules, SITE, SUPPORTED_LANGUAGES, SWITCH_STYLE } from "./page.mjs";
import { buildSitemap } from "./sitemap.mjs";
import { githubSource, localSource } from "./source.mjs";

// Configuration

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const INDEX_START = "<!-- generated:projects -->";
const INDEX_END = "<!-- /generated:projects -->";
const HOME_TEMPLATE = path.join(ROOT, "templates", "home.html");
const HTACCESS_START = "# generated:languages";
const HTACCESS_END = "# /generated:languages";

export function loadProjects(file) {
  const projects = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(projects)) throw new Error("projects.json must contain an array");
  const slugs = new Set();
  return projects.map((p, i) => {
    const where = `projects.json[${i}]`;
    if (typeof p.repo !== "string" || !/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(p.repo)) throw new Error(`${where}: "repo" must look like owner/name`);
    if (typeof p.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)) throw new Error(`${where}: "slug" must be lowercase letters, digits and hyphens`);
    if (typeof p.branch !== "string" || !/^[A-Za-z0-9._/-]+$/.test(p.branch) || p.branch.includes("..")) throw new Error(`${where}: "branch" is invalid`);
    if (p.download !== undefined && typeof p.download !== "boolean") throw new Error(`${where}: "download" must be true or false`);
    if (p.changelog !== undefined && (typeof p.changelog !== "string" || /^[A-Za-z][A-Za-z0-9+.-]*:|^\/|\.\./.test(p.changelog))) throw new Error(`${where}: "changelog" must be a path inside the repository`);
    if (SUPPORTED_LANGUAGES.includes(p.slug)) throw new Error(`${where}: slug "${p.slug}" is reserved for the home page`);
    if (slugs.has(p.slug)) throw new Error(`${where}: slug "${p.slug}" is used twice`);
    slugs.add(p.slug);
    return { repo: p.repo, slug: p.slug, branch: p.branch, download: p.download ?? false, changelog: p.changelog ?? null };
  });
}

function parseArgs(argv) {
  const args = { local: new Map(), only: null, summary: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--local") {
      const [slug, dir] = argv[++i].split(/=(.*)/s);
      args.local.set(slug, dir);
    } else if (argv[i] === "--only") {
      args.only = new Set(argv[++i].split(","));
    } else if (argv[i] === "--summary") {
      args.summary = argv[++i];
    } else {
      throw new Error(`Unknown argument ${argv[i]}`);
    }
  }
  return args;
}

// Output

function writeProject(slug, files) {
  const dir = path.join(PUBLIC, slug);
  fs.rmSync(dir, { recursive: true, force: true });
  for (const [file, data] of files) {
    const target = path.join(dir, ...file.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
}

export function updateIndex(html, results, lang) {
  const start = html.indexOf(INDEX_START);
  const end = html.indexOf(INDEX_END);
  if (start < 0 || end < start) throw new Error(`templates/home.html needs the markers ${INDEX_START} and ${INDEX_END}`);
  const indent = /([ \t]*)$/.exec(html.slice(0, start))[1];
  const items = results.map(({ project, title, logo, languages }) => {
    const icon = logo ? `<img src="/${project.slug}/${escapeAttr(logo)}" alt="" width="20" height="20">` : "";
    const href = languages?.length > 1 && languages.includes(lang) ? `/${project.slug}/${lang}/` : `/${project.slug}/`;
    return `${indent}<li><a href="${href}">${icon}${escapeText(title)}</a></li>\n`;
  });
  return `${html.slice(0, start + INDEX_START.length)}\n${items.join("")}${indent}${html.slice(end)}`;
}

const HOME_TEXTS = {
  en: { intro: "Open-source projects by TripleT3005", and: "and" },
  de: { intro: "Open-Source-Projekte von TripleT3005", and: "und" },
};

export function homeDescription(results, lang) {
  const { intro, and } = HOME_TEXTS[lang] ?? HOME_TEXTS.en;
  const titles = results.map((r) => r.title);
  const list = titles.length > 1 ? `${titles.slice(0, -1).join(", ")} ${and} ${titles.at(-1)}` : titles.join("");
  return list ? `${intro}: ${list}.` : `${intro}.`;
}

export function renderHome(template, results, lang, canonical) {
  const description = homeDescription(results, lang);
  const links = [
    `\n<link rel="canonical" href="${SITE}${canonical}">`,
    openGraph({ title: "ckass", description, url: SITE + canonical, lang }),
    ...SUPPORTED_LANGUAGES.map((l) => `\n<link rel="alternate" hreflang="${l}" href="${SITE}/${l}/">`),
    `\n<link rel="alternate" hreflang="x-default" href="${SITE}/">`,
  ];
  const html = template
    .replaceAll("{{lang}}", lang)
    .replace("{{description}}", escapeAttr(description))
    .replace("{{head}}", links.join(""))
    .replace("{{switchStyle}}", SWITCH_STYLE)
    .replace("{{switch}}", languageSwitch(SUPPORTED_LANGUAGES, lang, "/").replace(/^\n/, "").replace(/^ {4}/gm, ""));
  return updateIndex(html, results, lang);
}

export function updateHtaccess(htaccess) {
  const block = `${HTACCESS_START}\n${redirectRules("/", SUPPORTED_LANGUAGES)}${HTACCESS_END}\n`;
  const start = htaccess.indexOf(HTACCESS_START);
  const end = htaccess.indexOf(HTACCESS_END);
  if (start < 0 || end < start) return `${htaccess.replace(/\n*$/, "\n")}${block}`;
  return htaccess.slice(0, start) + block + htaccess.slice(end + HTACCESS_END.length).replace(/^\n/, "");
}

function writeHome(results) {
  const template = fs.readFileSync(HOME_TEMPLATE, "utf8");
  const [fallback] = SUPPORTED_LANGUAGES;
  fs.writeFileSync(path.join(PUBLIC, "index.html"), renderHome(template, results, fallback, `/${fallback}/`));
  for (const lang of SUPPORTED_LANGUAGES) {
    fs.mkdirSync(path.join(PUBLIC, lang), { recursive: true });
    fs.writeFileSync(path.join(PUBLIC, lang, "index.html"), renderHome(template, results, lang, `/${lang}/`));
  }
  const htaccess = path.join(PUBLIC, ".htaccess");
  fs.writeFileSync(htaccess, updateHtaccess(fs.readFileSync(htaccess, "utf8")));
}

function summary(results) {
  const list = (lang) =>
    results
      .map(({ project, title, commit }) => {
        const at = commit ? (lang === "de" ? ` auf Stand [\`${commit.slice(0, 7)}\`](https://github.com/${project.repo}/commit/${commit})` : ` at [\`${commit.slice(0, 7)}\`](https://github.com/${project.repo}/commit/${commit})`) : "";
        return `- ${title} (\`/${project.slug}/\`) ${lang === "de" ? "aus" : "from"} \`${project.repo}\`${at}`;
      })
      .join("\n");
  const warnings = results.flatMap(({ project, warnings: w }) => w.map((m) => `- \`${project.repo}\`: ${m}`));
  const warningBlock = (heading) => (warnings.length ? `\n\n### ${heading}\n${warnings.join("\n")}` : "");
  return `## English

Updates the project pages generated from the README files of these repositories:

${list("en")}

Checked by the sync workflow before this pull request was opened: unit tests of the generator, generation of all pages and the link check over \`public/\`.${warningBlock("Warnings")}

## Deutsch

Aktualisiert die Projektseiten, die aus den READMEs dieser Repositorys erzeugt werden:

${list("de")}

Vom Sync-Workflow geprüft, bevor dieser Pull Request erstellt wurde: Unit-Tests des Generators, Erzeugen aller Seiten und die Link-Prüfung über \`public/\`.${warningBlock("Warnungen")}
`;
}

// Main

function main() {
  const args = parseArgs(process.argv.slice(2));
  const projects = loadProjects(path.join(ROOT, "projects.json"));
  const results = [];
  let failed = false;
  for (const project of projects) {
    if (args.only && !args.only.has(project.slug)) continue;
    try {
      const dir = args.local.get(project.slug);
      const source = dir ? localSource(dir) : githubSource(project.repo, project.branch);
      const result = generateProject(project, source);
      for (const warning of result.warnings) console.log(`::warning title=${project.repo}::${warning}`);
      results.push({ project, commit: source.commit, ...result });
      console.log(`${project.repo} -> public/${project.slug}/ (${result.files.size} files)`);
    } catch (error) {
      failed = true;
      console.log(`::error title=${project.repo}::${String(error.message).replace(/\n/g, "%0A")}`);
    }
  }
  if (failed) process.exit(1);

  const slugs = new Set(projects.map((p) => p.slug));
  for (const entry of fs.readdirSync(PUBLIC, { withFileTypes: true })) {
    const page = path.join(PUBLIC, entry.name, "index.html");
    if (entry.isDirectory() && !slugs.has(entry.name) && fs.existsSync(page) && fs.readFileSync(page, "utf8").includes(GENERATED_MARK)) {
      fs.rmSync(path.join(PUBLIC, entry.name), { recursive: true, force: true });
    }
  }
  for (const { project, files } of results) writeProject(project.slug, files);
  writeHome(results);
  fs.writeFileSync(path.join(PUBLIC, "sitemap.xml"), buildSitemap(PUBLIC));
  if (args.summary) fs.writeFileSync(args.summary, summary(results));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

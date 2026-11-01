import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateProject } from "./generate.mjs";
import { escapeAttr, escapeText } from "./html.mjs";
import { GENERATED_MARK } from "./page.mjs";
import { githubSource, localSource } from "./source.mjs";

// Configuration

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const INDEX_START = "<!-- generated:projects -->";
const INDEX_END = "<!-- /generated:projects -->";

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
    if (slugs.has(p.slug)) throw new Error(`${where}: slug "${p.slug}" is used twice`);
    slugs.add(p.slug);
    return { repo: p.repo, slug: p.slug, branch: p.branch, download: p.download ?? false, changelog: p.changelog ?? null };
  });
}

function parseArgs(argv) {
  const args = { local: new Map(), summary: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--local") {
      const [slug, dir] = argv[++i].split(/=(.*)/s);
      args.local.set(slug, dir);
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

export function updateIndex(html, results) {
  const start = html.indexOf(INDEX_START);
  const end = html.indexOf(INDEX_END);
  if (start < 0 || end < start) throw new Error(`public/index.html needs the markers ${INDEX_START} and ${INDEX_END}`);
  const indent = /([ \t]*)$/.exec(html.slice(0, start))[1];
  const items = results.map(({ project, title, logo }) => {
    const icon = logo ? `<img src="/${project.slug}/${escapeAttr(logo)}" alt="" width="20" height="20">` : "";
    return `${indent}<li><a href="/${project.slug}/">${icon}${escapeText(title)}</a></li>\n`;
  });
  return `${html.slice(0, start + INDEX_START.length)}\n${items.join("")}${indent}${html.slice(end)}`;
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
  const indexFile = path.join(PUBLIC, "index.html");
  fs.writeFileSync(indexFile, updateIndex(fs.readFileSync(indexFile, "utf8"), results));
  if (args.summary) fs.writeFileSync(args.summary, summary(results));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

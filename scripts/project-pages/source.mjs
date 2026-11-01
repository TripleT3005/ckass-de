import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// GitHub

function gh(args) {
  return execFileSync("gh", ["api", ...args], { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

function encodePath(p) {
  return p.split("/").map(encodeURIComponent).join("/");
}

export function githubSource(repo, branch) {
  const commit = gh([`repos/${repo}/commits/${encodeURIComponent(branch)}`, "--jq", ".sha"]).toString("utf8").trim();
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`${repo}: could not resolve branch ${branch}`);
  const listing = JSON.parse(gh([`repos/${repo}/git/trees/${commit}?recursive=1`]).toString("utf8"));
  if (listing.truncated) throw new Error(`${repo}: file list is truncated`);
  const tree = new Map(listing.tree.map((entry) => [entry.path, entry.type]));
  return {
    commit,
    tree,
    read: (file) => gh(["-H", "Accept: application/vnd.github.raw", `repos/${repo}/contents/${encodePath(file)}?ref=${commit}`]),
  };
}

// Local folder

export function localSource(dir) {
  const root = path.resolve(dir);
  const tree = new Map();
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        tree.set(child, "tree");
        walk(child);
      } else if (entry.isFile()) {
        tree.set(child, "blob");
      }
    }
  };
  walk("");
  return {
    commit: null,
    tree,
    read: (file) => {
      if (tree.get(file) !== "blob") throw new Error(`${file} not found in ${root}`);
      return fs.readFileSync(path.join(root, ...file.split("/")));
    },
  };
}

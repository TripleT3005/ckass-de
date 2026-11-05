import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Constants

export const ALLOWED_LICENSES = new Set([
  "MIT",
  "ISC",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "Zlib",
  "MPL-2.0",
  "LGPL-2.1-only",
  "LGPL-2.1-or-later",
  "LGPL-3.0-only",
  "LGPL-3.0-or-later",
]);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Checks

export function isAllowed(licenses) {
  return Array.isArray(licenses) && licenses.some((license) => ALLOWED_LICENSES.has(license));
}

export function rejectedPackages(lockfile) {
  return (lockfile.packages ?? [])
    .filter((entry) => !isAllowed(entry.license))
    .map((entry) => `${entry.name} ${entry.version}: ${(entry.license ?? []).join(" OR ") || "no license"}`);
}

// Main

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lockfile = JSON.parse(fs.readFileSync(path.join(ROOT, "composer.lock"), "utf8"));
  const rejected = rejectedPackages(lockfile);
  if (rejected.length > 0) {
    console.error(`License check failed:\n${rejected.join("\n")}`);
    process.exit(1);
  }
  console.log(`License check passed: ${lockfile.packages.length} packages`);
}

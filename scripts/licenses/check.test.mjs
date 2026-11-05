import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowed, rejectedPackages } from "./check.mjs";

// Licenses

test("accepts permissive and weak copyleft licenses", () => {
  assert.equal(isAllowed(["MIT"]), true);
  assert.equal(isAllowed(["LGPL-2.1-only"]), true);
});

test("accepts a choice with one allowed license", () => {
  assert.equal(isAllowed(["GPL-3.0-only", "MIT"]), true);
});

test("rejects strong copyleft and missing licenses", () => {
  assert.equal(isAllowed(["AGPL-3.0-only"]), false);
  assert.equal(isAllowed(["GPL-2.0-or-later"]), false);
  assert.equal(isAllowed([]), false);
  assert.equal(isAllowed(undefined), false);
});

// Lockfile

test("lists rejected packages", () => {
  const lockfile = {
    packages: [
      { name: "vendor/allowed", version: "1.0.0", license: ["MIT"] },
      { name: "vendor/network", version: "2.0.0", license: ["AGPL-3.0-only"] },
      { name: "vendor/unlicensed", version: "3.0.0" },
    ],
    "packages-dev": [{ name: "vendor/tool", version: "1.0.0", license: ["GPL-3.0-only"] }],
  };
  assert.deepEqual(rejectedPackages(lockfile), [
    "vendor/network 2.0.0: AGPL-3.0-only",
    "vendor/unlicensed 3.0.0: no license",
  ]);
});

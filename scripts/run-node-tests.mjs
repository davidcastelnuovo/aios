#!/usr/bin/env node
/**
 * Runs every tracked *.test / *.spec file under `node --test`, except the ones
 * listed in node-test-skips.json. Replaces the hand-maintained file list in CI,
 * which silently left new test files unexecuted.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { skip } = JSON.parse(readFileSync(join(root, "scripts", "node-test-skips.json"), "utf8"));

const stale = Object.keys(skip).filter((file) => !existsSync(join(root, file)));
if (stale.length) {
  console.error(`node-test-skips.json lists missing files:\n  ${stale.join("\n  ")}`);
  process.exit(1);
}

const files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter((file) => /\.(test|spec)\.(m?[jt]sx?)$/.test(file))
  .filter((file) => !file.startsWith("extension/") && !(file in skip));

console.log(`Running ${files.length} test files (${Object.keys(skip).length} skipped, see node-test-skips.json)`);
const result = spawnSync(process.execPath, ["--experimental-strip-types", "--test", ...files], {
  cwd: root,
  stdio: "inherit",
});
process.exit(result.status ?? 1);

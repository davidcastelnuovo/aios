#!/usr/bin/env node
/**
 * Ratchet for ESLint and TypeScript errors.
 *
 * The repo carries thousands of pre-existing lint and type errors, so a plain
 * `eslint .` / `tsc --noEmit` step would always be red. Instead, per-file error
 * counts are recorded in quality-baseline.json and CI fails only when a file
 * gains errors. When you fix errors, run with `--update` and commit the lower
 * baseline so it can't creep back up.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = join(root, "scripts", "quality-baseline.json");
const update = process.argv.includes("--update");
const bin = (name) => join(root, "node_modules", ".bin", name);

function eslintCounts() {
  const run = spawnSync(bin("eslint"), [".", "-f", "json"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 30 });
  if (run.status === 2 || !run.stdout) {
    console.error(run.stderr);
    throw new Error("eslint crashed");
  }
  const counts = {};
  for (const file of JSON.parse(run.stdout)) {
    if (file.errorCount) counts[relative(root, file.filePath)] = file.errorCount;
  }
  return counts;
}

function tscCounts() {
  const run = spawnSync(bin("tsc"), ["--noEmit", "-p", "tsconfig.app.json", "--pretty", "false"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1 << 30,
  });
  const counts = {};
  for (const line of run.stdout.split("\n")) {
    const match = line.match(/^(.+?)\(\d+,\d+\): error TS\d+/);
    if (match) counts[match[1]] = (counts[match[1]] ?? 0) + 1;
  }
  if (run.status !== 0 && !Object.keys(counts).length) {
    console.error(run.stdout, run.stderr);
    throw new Error("tsc crashed");
  }
  return counts;
}

const sorted = (counts) => Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
const total = (counts) => Object.values(counts).reduce((sum, n) => sum + n, 0);
const current = { eslint: sorted(eslintCounts()), tsc: sorted(tscCounts()) };

if (update) {
  writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Baseline updated: eslint ${total(current.eslint)}, tsc ${total(current.tsc)} errors`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const regressions = [];
const improved = [];
for (const tool of ["eslint", "tsc"]) {
  const files = new Set([...Object.keys(baseline[tool]), ...Object.keys(current[tool])]);
  for (const file of files) {
    const before = baseline[tool][file] ?? 0;
    const after = current[tool][file] ?? 0;
    if (after > before) regressions.push(`${tool}: ${file} ${before} -> ${after}`);
    if (after < before) improved.push(`${tool}: ${file} ${before} -> ${after}`);
  }
}

console.log(`eslint ${total(current.eslint)}/${total(baseline.eslint)}, tsc ${total(current.tsc)}/${total(baseline.tsc)} errors (current/baseline)`);
if (improved.length) {
  console.log(`\n${improved.length} file(s) improved; run \`pnpm quality:update\` and commit to lock it in:\n  ${improved.join("\n  ")}`);
}
if (regressions.length) {
  console.error(`\nNew errors (run \`npx eslint <file>\` or \`npx tsc --noEmit -p tsconfig.app.json\` for details):\n  ${regressions.join("\n  ")}`);
  process.exit(1);
}

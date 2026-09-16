#!/usr/bin/env node
/**
 * Guard: every edge-function source file must parse.
 *
 * Regression history: commit 7e2280ab (2026-09-10) replaced the `import {` line of
 * run-ai-agent's dev-escalation-auth import with a different single-line import and
 * left the member list dangling. Nothing in CI parsed edge functions, so main stayed
 * green while `deploy-edge-function.yml` failed on "Expression expected" for six
 * days — Carmen's brain and every function sorted after run-ai-agent stopped
 * deploying to production.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const functionsDir = join(root, "supabase", "functions");
const failures = [];
let checked = 0;

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|mjs)$/.test(entry.name)) continue;
    checked += 1;
    const source = ts.createSourceFile(
      full,
      readFileSync(full, "utf8"),
      ts.ScriptTarget.ESNext,
      true,
      entry.name.endsWith(".mjs") ? ts.ScriptKind.JS : ts.ScriptKind.TS,
    );
    for (const diagnostic of source.parseDiagnostics ?? []) {
      const { line } = source.getLineAndCharacterOfPosition(diagnostic.start);
      const rel = full.slice(root.length + 1);
      failures.push(`${rel}:${line + 1} — ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`);
    }
  }
}

walk(functionsDir);

if (failures.length > 0) {
  console.error("Edge function syntax guard FAILED — these files cannot be bundled by Supabase:\n");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`Edge function syntax guard OK (${checked} files)`);

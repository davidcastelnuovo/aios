import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const baselinePath = path.join(root, 'scripts/typecheck-baseline.json');
const config = 'tsconfig.app.json';

// A multiset catches duplicate additions and equal-total replacements. Locations
// are only used for reporting, so inserting lines does not invalidate the debt.
export function diagnosticKey(diagnostic) {
  return JSON.stringify([diagnostic.file, diagnostic.code, diagnostic.message, diagnostic.source]);
}

export function snapshot(diagnostics) {
  const entries = new Map();
  for (const { file, code, message, source } of diagnostics) {
    const entry = { file, code, message, source };
    const key = diagnosticKey(entry);
    const previous = entries.get(key);
    entries.set(key, { ...entry, count: (previous?.count ?? 0) + 1 });
  }
  return [...entries.values()].sort((a, b) => diagnosticKey(a).localeCompare(diagnosticKey(b), 'en'));
}

export function validateBaseline(baseline) {
  if (baseline?.schemaVersion !== 1 || baseline.config !== config ||
      typeof baseline.typescriptVersion !== 'string' || !Array.isArray(baseline.diagnostics)) {
    throw new Error('Invalid TypeScript baseline metadata.');
  }
  const keys = new Set();
  for (const entry of baseline.diagnostics) {
    if (typeof entry.file !== 'string' || !entry.file.startsWith('src/') ||
        !Number.isInteger(entry.code) || typeof entry.message !== 'string' ||
        typeof entry.source !== 'string' || !Number.isSafeInteger(entry.count) || entry.count < 1 ||
        keys.has(diagnosticKey(entry))) {
      throw new Error('Invalid or duplicate TypeScript baseline diagnostic.');
    }
    keys.add(diagnosticKey(entry));
  }
  return baseline;
}

export function compareDiagnostics(current, baseline) {
  const allowed = new Map(baseline.map(entry => [diagnosticKey(entry), entry.count]));
  const added = [];
  for (const diagnostic of current) {
    const key = diagnosticKey(diagnostic);
    const remaining = allowed.get(key) ?? 0;
    if (remaining > 0) allowed.set(key, remaining - 1);
    else added.push(diagnostic);
  }
  const resolved = baseline.flatMap(entry => {
    const count = allowed.get(diagnosticKey(entry)) ?? 0;
    return count ? [{ ...entry, count }] : [];
  });
  return { added, resolved };
}

export function baselineAdditions(current, previous) {
  validateBaseline(current);
  if (!previous) return true;
  validateBaseline(previous);
  if (current.typescriptVersion !== previous.typescriptVersion) return true;
  const counts = new Map(previous.diagnostics.map(entry => [diagnosticKey(entry), entry.count]));
  return current.diagnostics.some(entry => entry.count > (counts.get(diagnosticKey(entry)) ?? 0));
}

export async function approvingMaintainer(reviews, headSha, permissionFor) {
  const latest = new Map();
  for (const review of reviews) {
    if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) {
      latest.set(review.user.login, review);
    }
  }
  for (const review of latest.values()) {
    if (review.state !== 'APPROVED' || review.commit_id !== headSha) continue;
    if (['admin', 'maintain', 'write'].includes(await permissionFor(review.user.login))) {
      return review.user.login;
    }
  }
  return null;
}

export function collectDiagnostics(projectRoot = root) {
  const configPath = path.join(projectRoot, config);
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, projectRoot, { noEmit: true }, configPath);
  if (parsed.errors.length) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
      getCanonicalFileName: file => file, getCurrentDirectory: () => projectRoot, getNewLine: () => '\n',
    }));
  }
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  return ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error).map(d => {
    // Configuration/global errors and sources outside the frontend must never
    // become allowed debt (missing files, compiler options, missing libraries).
    const file = d.file && path.relative(projectRoot, d.file.fileName).split(path.sep).join('/');
    const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    if (!file?.startsWith('src/') || d.start === undefined) {
      throw new Error(`Compiler configuration failure: ${file ?? config} TS${d.code}: ${message}`);
    }
    const location = d.file.getLineAndCharacterOfPosition(d.start);
    return {
      file, code: d.code, message,
      source: d.file.text.slice(d.start, d.start + (d.length ?? 0)).replace(/\s+/g, ' ').trim(),
      line: location.line + 1, column: location.character + 1,
    };
  });
}

export function run(args = process.argv.slice(2)) {
  if (args.length > 1 || (args.length && !['--update', '--accept-new'].includes(args[0]))) {
    throw new Error('Usage: pnpm typecheck [--update | --accept-new]');
  }
  const acceptNew = args[0] === '--accept-new';
  const baseline = fs.existsSync(baselinePath)
    ? validateBaseline(JSON.parse(fs.readFileSync(baselinePath, 'utf8'))) : null;
  if (!baseline && !acceptNew) throw new Error('Missing baseline; initial capture requires --accept-new and PR review.');
  if (baseline && baseline.typescriptVersion !== ts.version && !acceptNew) {
    throw new Error(`Compiler version changed: baseline ${baseline.typescriptVersion}, installed ${ts.version}. Review a new baseline explicitly.`);
  }
  const current = collectDiagnostics();
  const { added, resolved } = compareDiagnostics(current, baseline?.diagnostics ?? []);
  for (const d of added) console.error(`${d.file}:${d.line}:${d.column} TS${d.code}: ${d.message}`);
  if (added.length && !acceptNew) {
    console.error(`${added.length} new TypeScript diagnostic(s); baseline updates cannot accept new errors.`);
    return 1;
  }
  if (args[0]) {
    fs.writeFileSync(baselinePath, JSON.stringify({
      schemaVersion: 1, typescriptVersion: ts.version, config, diagnostics: snapshot(current),
    }, null, 2) + '\n');
    console.log(`Captured ${current.length} diagnostic(s) with TypeScript ${ts.version}.${acceptNew ? ' Baseline additions require maintainer approval in CI.' : ''}`);
    return 0;
  }
  const resolvedCount = resolved.reduce((total, entry) => total + entry.count, 0);
  if (resolvedCount) {
    for (const d of resolved) console.error(`${d.file} TS${d.code}: ${d.count} resolved: ${d.message}`);
    console.error(`Remove ${resolvedCount} resolved diagnostic(s) with pnpm typecheck:update and commit the reduced baseline.`);
    return 1;
  }
  console.log(`TypeScript ${ts.version}: ${current.length} existing diagnostic(s), no new errors.`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = run(); }
  catch (error) { console.error(`TypeScript gate failed: ${error.message}`); process.exitCode = 1; }
}

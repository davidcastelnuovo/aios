import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { compareDiagnostics, snapshot, validateBaseline } from './typecheck-policy.mjs';
export { approvingMaintainer, baselineAdditions, compareDiagnostics, diagnosticKey, snapshot, validateBaseline } from './typecheck-policy.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const baselinePath = path.join(root, 'scripts/typecheck-baseline.json');
const config = 'tsconfig.app.json';

export function normalizeDiagnosticMessage(message, projectRoot) {
  // TypeScript embeds absolute paths in some messages (notably TS7016).
  // Keep the module path meaningful while removing checkout-specific prefixes.
  const prefix = ts.normalizePath(projectRoot).replace(/\/$/, '') + '/';
  return message.replaceAll(prefix, './');
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
    const message = normalizeDiagnosticMessage(ts.flattenDiagnosticMessageText(d.messageText, '\n'), projectRoot);
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
  let projectRoot = root;
  if (args[0] === '--project' && args.length === 2) {
    projectRoot = path.resolve(args[1]);
    args = []; // External projects can only be checked, never updated.
  }
  const projectBaselinePath = path.join(projectRoot, 'scripts/typecheck-baseline.json');
  if (args.length > 1 || (args.length && !['--update', '--accept-new'].includes(args[0]))) {
    throw new Error('Usage: pnpm typecheck [--update | --accept-new | --project PATH]');
  }
  const acceptNew = args[0] === '--accept-new';
  const baseline = fs.existsSync(projectBaselinePath)
    ? validateBaseline(JSON.parse(fs.readFileSync(projectBaselinePath, 'utf8'))) : null;
  if (!baseline && !acceptNew) throw new Error('Missing baseline; initial capture requires --accept-new and PR review.');
  if (baseline && baseline.typescriptVersion !== ts.version && !acceptNew) {
    throw new Error(`Compiler version changed: baseline ${baseline.typescriptVersion}, installed ${ts.version}. Review a new baseline explicitly.`);
  }
  const current = collectDiagnostics(projectRoot);
  const { added, resolved } = compareDiagnostics(current, baseline?.diagnostics ?? []);
  for (const d of added) console.error(`${d.file}:${d.line}:${d.column} TS${d.code}: ${d.message}`);
  if (added.length && !acceptNew) {
    console.error(`${added.length} new TypeScript diagnostic(s); baseline updates cannot accept new errors.`);
    return 1;
  }
  if (args[0]) {
    fs.writeFileSync(projectBaselinePath, JSON.stringify({
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

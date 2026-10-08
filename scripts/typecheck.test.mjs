import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { approvingMaintainer, baselineAdditions, collectDiagnostics, compareDiagnostics, normalizeDiagnosticMessage, run, snapshot, validateBaseline } from './typecheck.mjs';

const error = { file: 'src/example.ts', code: 2322, message: "Type 'string' is not assignable to type 'number'.", source: 'value', line: 1, column: 7 };
const baseline = diagnostics => ({ schemaVersion: 1, config: 'tsconfig.app.json', typescriptVersion: ts.version, diagnostics: snapshot(diagnostics) });

test('unchanged diagnostics and line-only shifts preserve existing debt', () => {
  assert.deepEqual(compareDiagnostics([error], snapshot([error])), { added: [], resolved: [] });
  assert.deepEqual(compareDiagnostics([{ ...error, line: 100, column: 12 }], snapshot([error])), { added: [], resolved: [] });
});

test('new diagnostics, dependent-file errors, and equal-total replacements fail', () => {
  const replacement = { ...error, code: 2339, message: "Property 'missing' does not exist.", source: 'missing' };
  assert.deepEqual(compareDiagnostics([replacement], snapshot([error])).added, [replacement]);
  const dependent = { ...error, file: 'src/dependent.ts' };
  assert.deepEqual(compareDiagnostics([error, dependent], snapshot([error])).added, [dependent]);
});

test('diagnostic counts cannot conceal duplicate additions or resolved errors', () => {
  assert.equal(compareDiagnostics([error, error], snapshot([error])).added.length, 1);
  assert.equal(compareDiagnostics([error], snapshot([error, error])).resolved[0].count, 1);
  assert.deepEqual(compareDiagnostics([], snapshot([error])).resolved, snapshot([error]));
});

test('source changes distinguish errors with identical messages', () => {
  const replacement = { ...error, source: 'otherValue' };
  assert.deepEqual(compareDiagnostics([replacement], snapshot([error])).added, [replacement]);
});

test('embedded checkout paths match between local and CI without masking different modules', () => {
  const message = root => `Could not find a declaration file for module 'papaparse'. '${root}/node_modules/papaparse/papaparse.js' implicitly has an 'any' type.`;
  const local = normalizeDiagnosticMessage(message('/workspace/aios'), '/workspace/aios');
  const ci = normalizeDiagnosticMessage(message('/home/runner/work/aios/aios'), '/home/runner/work/aios/aios');
  assert.equal(local, ci);
  assert.equal(normalizeDiagnosticMessage(message('C:/work/aios'), 'C:\\work\\aios'), local);
  assert.equal(compareDiagnostics([{ ...error, code: 7016, message: ci }], snapshot([{ ...error, code: 7016, message: local }])).added.length, 0);
  assert.notEqual(normalizeDiagnosticMessage(message('/workspace/aios').replace('/papaparse/papaparse.js', '/other/other.js'), '/workspace/aios'), local);
  assert.equal(normalizeDiagnosticMessage("'/workspace/aios-other/file.ts'", '/workspace/aios'), "'/workspace/aios-other/file.ts'");
});

test('real missing-declaration diagnostics remain identical across different checkout directories', () => {
  const dirs = [fs.mkdtempSync(path.join(os.tmpdir(), 'aio-local-')), fs.mkdtempSync(path.join(os.tmpdir(), 'aio-ci-'))];
  try {
    for (const dir of dirs) {
      fs.mkdirSync(path.join(dir, 'src'));
      fs.writeFileSync(path.join(dir, 'tsconfig.app.json'), JSON.stringify({
        compilerOptions: { strict: true, types: [], skipLibCheck: true }, include: ['src'],
      }));
      fs.writeFileSync(path.join(dir, 'src/helpers.js'), 'exports.value = 1;\n');
      fs.writeFileSync(path.join(dir, 'src/example.ts'), 'import { value } from "./helpers";\nexport const copy = value;\n');
    }
    const local = collectDiagnostics(dirs[0]);
    const ci = collectDiagnostics(dirs[1]);
    assert.equal(local.length, 1);
    assert.equal(local[0].code, 7016);
    assert.match(local[0].message, /\.\/src\/helpers\.js/);
    assert.deepEqual(compareDiagnostics(ci, snapshot(local)), { added: [], resolved: [] });
  } finally { for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true }); }
});

test('baseline review is required for creation, increases, replacements, and compiler upgrades', () => {
  assert.equal(baselineAdditions(baseline([error]), null), true);
  assert.equal(baselineAdditions(baseline([error]), baseline([error])), false);
  assert.equal(baselineAdditions(baseline([]), baseline([error])), false);
  assert.equal(baselineAdditions(baseline([error, error]), baseline([error])), true);
  assert.equal(baselineAdditions(baseline([{ ...error, source: 'other' }]), baseline([error])), true);
  assert.equal(baselineAdditions({ ...baseline([error]), typescriptVersion: 'other' }, baseline([error])), true);
});

test('malformed and duplicate baseline entries fail closed', () => {
  assert.throws(() => validateBaseline({}));
  assert.throws(() => validateBaseline({ ...baseline([]), diagnostics: [{ ...error, count: 0 }] }));
  assert.throws(() => validateBaseline({ ...baseline([]), diagnostics: [{ ...error, count: 1 }, { ...error, count: 1 }] }));
});

test('baseline approval requires a current, undismissed maintainer review', async () => {
  const approved = { user: { login: 'reviewer' }, state: 'APPROVED', commit_id: 'head' };
  assert.equal(await approvingMaintainer([approved], 'head', async () => 'write'), 'reviewer');
  assert.equal(await approvingMaintainer([approved], 'other-head', async () => 'write'), null);
  assert.equal(await approvingMaintainer([approved], 'head', async () => 'read'), null);
  assert.equal(await approvingMaintainer([], 'head', async () => 'admin'), null);
  for (const state of ['DISMISSED', 'CHANGES_REQUESTED']) {
    assert.equal(await approvingMaintainer([approved, { ...approved, state }], 'head', async () => 'write'), null);
  }
  assert.equal(await approvingMaintainer([approved, { ...approved, state: 'COMMENTED' }], 'head', async () => 'write'), 'reviewer');
  await assert.rejects(approvingMaintainer([approved], 'head', async () => { throw new Error('API unavailable'); }));
  const outside = { ...approved, user: { login: 'outside' } };
  const permissionFor = async login => {
    if (login === 'outside') throw Object.assign(new Error('Not a collaborator'), { status: 404 });
    return 'write';
  };
  assert.equal(await approvingMaintainer([outside, approved], 'head', permissionFor), 'reviewer');
  assert.equal(await approvingMaintainer([outside], 'head', permissionFor), null);
  await assert.rejects(approvingMaintainer([outside, approved], 'head', async () => {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }));
});

test('trusted checker checks an external project without executing its checker or updating its baseline', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aio-untrusted-project-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.mkdirSync(path.join(dir, 'scripts'));
    fs.writeFileSync(path.join(dir, 'tsconfig.app.json'), JSON.stringify({
      compilerOptions: { strict: true, types: [], skipLibCheck: true }, include: ['src'],
    }));
    fs.writeFileSync(path.join(dir, 'src/example.ts'), 'export const value: number = "text";\n');
    fs.writeFileSync(path.join(dir, 'scripts/typecheck.mjs'), 'throw new Error("PR checker must not execute");\n');
    fs.writeFileSync(path.join(dir, 'scripts/typecheck-policy.mjs'), 'throw new Error("PR policy must not execute");\n');
    const file = path.join(dir, 'scripts/typecheck-baseline.json');
    const captured = JSON.stringify(baseline(collectDiagnostics(dir)));
    fs.writeFileSync(file, captured);
    assert.equal(run(['--project', dir]), 0);
    assert.equal(fs.readFileSync(file, 'utf8'), captured);
    assert.throws(() => run(['--project', dir, '--accept-new']), /Usage/);
    fs.writeFileSync(file, JSON.stringify(baseline([])));
    assert.equal(run(['--project', dir]), 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('real compiler checks the full frontend, tracks locations, and handles shifted lines', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aio-typecheck-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.symlinkSync(path.resolve('node_modules'), path.join(dir, 'node_modules'), 'dir');
    fs.writeFileSync(path.join(dir, 'tsconfig.app.json'), JSON.stringify({
      compilerOptions: { target: 'ES2020', module: 'ESNext', moduleResolution: 'bundler', types: [], skipLibCheck: true }, include: ['src'],
    }));
    fs.writeFileSync(path.join(dir, 'src/source.ts'), 'export const value = "text";\n');
    const consumer = 'import { value } from "./source";\nexport const amount: number = value;\n';
    fs.writeFileSync(path.join(dir, 'src/consumer.ts'), consumer);
    const original = collectDiagnostics(dir);
    assert.equal(original.length, 1);
    assert.equal(original[0].file, 'src/consumer.ts');
    assert.equal(original[0].line, 2);
    fs.writeFileSync(path.join(dir, 'src/consumer.ts'), '\n\n' + consumer);
    assert.equal(collectDiagnostics(dir)[0].line, 4);
    assert.equal(compareDiagnostics(collectDiagnostics(dir), snapshot(original)).added.length, 0);
    fs.writeFileSync(path.join(dir, 'src/consumer.ts'), consumer.replace(': number', ': boolean'));
    const replacement = collectDiagnostics(dir);
    assert.equal(replacement.length, original.length);
    assert.equal(compareDiagnostics(replacement, snapshot(original)).added.length, 1);
    fs.writeFileSync(path.join(dir, 'src/consumer.ts'), consumer);
    fs.writeFileSync(path.join(dir, 'src/source.ts'), 'export const value = 1;\n');
    assert.equal(compareDiagnostics(collectDiagnostics(dir), snapshot(original)).resolved.length, 1);
    fs.writeFileSync(path.join(dir, 'tsconfig.app.json'), '{broken');
    assert.throws(() => collectDiagnostics(dir));
    fs.writeFileSync(path.join(dir, 'tsconfig.app.json'), JSON.stringify({ compilerOptions: { module: 'not-a-module' }, include: ['src'] }));
    assert.throws(() => collectDiagnostics(dir));
    fs.writeFileSync(path.join(dir, 'tsconfig.app.json'), JSON.stringify({ compilerOptions: { lib: [], types: [] }, include: ['src'] }));
    assert.throws(() => collectDiagnostics(dir), /Compiler configuration failure/);
    fs.unlinkSync(path.join(dir, 'tsconfig.app.json'));
    assert.throws(() => collectDiagnostics(dir));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('strict mode catches implicit-any and null assignments without weakening overrides', () => {
  for (const configFile of ['tsconfig.json', 'tsconfig.app.json']) {
    const { compilerOptions } = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    assert.equal(compilerOptions.strict, true);
    for (const flag of ['noImplicitAny', 'strictNullChecks', 'strictFunctionTypes', 'strictBindCallApply',
      'strictPropertyInitialization', 'alwaysStrict', 'useUnknownInCatchVariables', 'strictBuiltinIteratorReturn']) {
      assert.notEqual(compilerOptions[flag], false, `${configFile} must not disable ${flag}`);
    }
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aio-strict-typecheck-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'tsconfig.app.json'), JSON.stringify({
      compilerOptions: { strict: true, types: [], skipLibCheck: true }, include: ['src'],
    }));
    fs.writeFileSync(path.join(dir, 'src/example.ts'), 'export function echo(value) { return value; }\nexport const count: number = null;\n');
    const diagnostics = collectDiagnostics(dir);
    assert.deepEqual(diagnostics.map(d => d.code).sort(), [2322, 7006]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

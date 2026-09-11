import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deployFunctions } from './deploy-edge.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'aios-deploy-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'supabase/functions/report'), { recursive: true });
  writeFileSync(join(root, 'supabase/config.toml'), '[functions.report]\nverify_jwt = false\n');
  const entry = join(root, 'supabase/functions/report/index.ts');
  const saved = join(root, 'supabase/functions/report/_aios-source.ts');
  const source = 'Deno.serve(() => new Response("report"));\n';
  writeFileSync(entry, source);
  return { root, entry, saved, source };
}

test('failed Staging deployment restores source; Production never receives wrapper', t => {
  const f = fixture(t);
  const opts = { root: f.root, names: ['report'], productionProject: 'p'.repeat(20) };
  const run = (_, args) => {
    if (args.includes('--help')) return { status: 0, stdout: '--use-api' };
    assert.ok(args.includes('--use-api'));
    assert.ok(args.includes('--no-verify-jwt'));
    if (args.includes('s'.repeat(20))) {
      assert.match(readFileSync(f.entry, 'utf8'), /installStagingOutboundGuard/);
      assert.equal(readFileSync(f.saved, 'utf8'), f.source);
      return { status: 1 };
    }
    assert.equal(readFileSync(f.entry, 'utf8'), f.source);
    return { status: 0 };
  };
  assert.throws(() => deployFunctions({ ...opts, environment: 'staging', project: 's'.repeat(20), run }), /Deployment failed/);
  assert.equal(readFileSync(f.entry, 'utf8'), f.source);
  assert.equal(existsSync(f.saved), false);
  deployFunctions({ ...opts, environment: 'production', project: 'p'.repeat(20), run });
});

test('target mix-ups and existing saved sources fail without changing files', t => {
  const f = fixture(t);
  const opts = { root: f.root, names: ['report'], environment: 'staging', project: 'p'.repeat(20), productionProject: 'p'.repeat(20) };
  assert.throws(() => deployFunctions(opts), /Invalid target/);
  writeFileSync(f.saved, 'existing backup');
  assert.throws(() => deployFunctions({ ...opts, project: 's'.repeat(20), run: () => ({ status: 0, stdout: '--use-api' }) }), /Saved source already exists/);
  assert.equal(readFileSync(f.entry, 'utf8'), f.source);
  assert.equal(readFileSync(f.saved, 'utf8'), 'existing backup');
});

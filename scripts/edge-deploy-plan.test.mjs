import test from 'node:test';
import assert from 'node:assert/strict';
import { deploymentPlan, productionChanges } from './edge-deploy-plan.mjs';
const available = ['crm-records', 'run-ai-agent', 'send-resend-email'];
test('shared-only and config changes redeploy complete bundles', () => {
  for (const path of ['supabase/functions/_shared/carmen.ts', 'supabase/config.toml',
    'scripts/staging-only-functions.json', '.github/workflows/deploy-edge-reusable.yml']) {
    assert.deepEqual(deploymentPlan([path], available), available);
  }
});
test('all changed function directories are included and deleted directories ignored', () => {
  assert.deepEqual(deploymentPlan(['supabase/functions/crm-records/index.ts', 'supabase/functions/removed/index.ts', 'src/App.tsx'], available), ['crm-records']);
});
test('manual input cannot inject flags or shell commands', () => {
  for (const name of ['--project-ref', 'crm-records;id', '../prod', 'unknown']) assert.throws(() => deploymentPlan([], available, name));
});
test('Staging infrastructure changes cannot redeploy older Production functions', () => {
  const before = '[functions.report]\nverify_jwt = true\n';
  const after = before + '\n# Staging compatibility\n[functions.collaboration-mcp]\nverify_jwt = false\n';
  const files = ['supabase/config.toml', 'supabase/functions/_shared/staging-outbound.mjs',
    'supabase/functions/collaboration-mcp/index.ts', 'scripts/deploy-edge.mjs', '.github/workflows/deploy-edge-reusable.yml'];
  assert.deepEqual(productionChanges(files, before, after, ['collaboration-mcp']), []);
  assert.deepEqual(productionChanges(['supabase/config.toml'], before, before.replace('true', 'false'), []), ['supabase/config.toml']);
  assert.deepEqual(productionChanges(['supabase/functions/_shared/auth.ts'], before, before, []), ['supabase/functions/_shared/auth.ts']);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function moduleFrom(path, globals = {}, imports = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: (name) => imports[name] ?? {}, URL, console, ...globals });
  return exports;
}

const stamp = moduleFrom('src/lib/signatureStamp.ts');
const storage = moduleFrom('supabase/functions/_shared/signature-storage.ts');
const fields = [{ id: 'company', type: 'company_name' }, { id: 'id', type: 'id_number' }];

test('stamp prefills from completed fields, with saved and entity fallbacks', () => {
  const actual = stamp.getSignatureStamp(fields, { company: ' Form Company ', id: '123', __stamp_name: 'Previous' }, { name: 'Entity', company_id: '456' });
  assert.equal(actual.name, 'Form Company');
  assert.equal(actual.companyId, '123');
  assert.equal(stamp.getSignatureStamp(fields, { __stamp_name: 'Confirmed' }, { name: 'Entity' }).name, 'Confirmed');
  assert.equal(stamp.getSignatureStamp(fields, {}, { company_id: '456' }).companyId, '456');
});

test('confirming stamp details preserves signatures on other pages and recipient fields', () => {
  const original = { page1: 'png1', page2: 'png2', otherRecipient: 'untouched' };
  const result = stamp.applySignatureStamp(fields, original, ' Edited ', ' 789 ');
  assert.equal(result.company, 'Edited');
  assert.equal(result.id, '789');
  assert.equal(result.__stamp_name, 'Edited');
  assert.equal(result.page1, 'png1');
  assert.equal(result.page2, 'png2');
  assert.equal(result.otherRecipient, 'untouched');
  assert.equal(original.company, undefined);
});

test('document storage allows the bound tenant and rejects cross-tenant paths', () => {
  assert.equal(storage.signatureStoragePath('tenant-a/contract.pdf', 'tenant-a'), 'tenant-a/contract.pdf');
  assert.equal(storage.signatureStoragePath('https://example.supabase.co/storage/v1/object/sign/signature-documents/tenant-a/contract.pdf?token=test', 'tenant-a'), 'tenant-a/contract.pdf');
  assert.throws(() => storage.signatureStoragePath('tenant-b/private.pdf', 'tenant-a'), /invalid_document_path/);
  assert.throws(() => storage.signatureStoragePath('tenant-a/../tenant-b/private.pdf', 'tenant-a'), /invalid_document_path/);
  assert.throws(() => storage.signatureStoragePath('data:application/pdf;base64,test', 'tenant-a'), /invalid_document_url/);
});

test('service helper refuses a document outside the authorized tenant before any writes', async () => {
  let writes = 0;
  const client = { from: () => {
    const filters = {};
    const query = { select: () => query, eq: (key, value) => { filters[key] = value; return query; },
      maybeSingle: async () => ({ data: filters.tenant_id === 'tenant-b' ? { id: 'doc', tenant_id: 'tenant-b', status: 'draft' } : null }),
      insert: () => { writes++; throw new Error('unexpected insert'); }, update: () => { writes++; throw new Error('unexpected update'); } };
    return query;
  }};
  const helpers = moduleFrom('supabase/functions/_shared/signature-automation.ts', { Deno: { env: { get: () => undefined } } });
  await assert.rejects(helpers.prepareSignatureDocumentForSigning(client, { documentId: 'doc', tenantId: 'tenant-a', createdBy: 'user' }));
  await assert.rejects(helpers.cloneSignatureFromTemplate(client, { templateDocumentId: 'doc', tenantId: 'tenant-a', createdBy: 'user', recipientName: 'QA', recipientEmail: 'qa@example.invalid' }));
  assert.equal(writes, 0);
});

test('submission validation failure is returned without retrying a legacy bypass', async () => {
  let handler;
  let calls = 0;
  const supabase = { rpc: async () => { calls++; return { error: { message: 'missing_required_field' } }; } };
  moduleFrom('supabase/functions/submit-signature/index.ts', {
    Deno: { env: { get: () => '' }, serve: (callback) => { handler = callback; } }, Response,
  }, { 'https://esm.sh/@supabase/supabase-js@2.75.0': { createClient: () => supabase } });
  const response = await handler(new Request('https://example.invalid', { method: 'POST', body: JSON.stringify({ token: '11111111-1111-4111-8111-111111111111', signatureData: 'png', action: 'sign' }) }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'missing_required_field');
  assert.equal(calls, 1);
});

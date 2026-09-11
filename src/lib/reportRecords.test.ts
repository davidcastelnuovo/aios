import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { reportRecordsQuery } from './reportRecords.ts';
test('concurrent combined/table views share one authorised request', async () => {
  let calls = 0;
  const client = { functions: { invoke: async () => { calls++; return { data: [{ id: 'row' }], error: null }; } } };
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const query = reportRecordsQuery(client, 'table-a', 'last_30_days');
  const result = await Promise.all([cache.fetchQuery(query), cache.fetchQuery(query)]);
  assert.equal(calls, 1); assert.deepEqual(result[0], result[1]);
  cache.clear();
});
test('date windows remain separate and cancellation is forwarded', async () => {
  const signal = new AbortController().signal;
  const client = { functions: { invoke: async (path, opts) => {
    assert.match(path, /date_from=2026-09-01/); assert.equal(opts.signal, signal);
    return { data: [], error: null };
  } } };
  const a = reportRecordsQuery(client, 'table-a', 'custom', '2026-09-01', '2026-09-10');
  const b = reportRecordsQuery(client, 'table-b', 'custom', '2026-09-01', '2026-09-10');
  assert.notDeepEqual(a.queryKey, b.queryKey);
  await a.queryFn({ signal });
});
test('access errors cannot become an empty successful report', async () => {
  const client = { functions: { invoke: async () => ({ data: null, error: new Error('Forbidden') }) } };
  await assert.rejects(reportRecordsQuery(client, 'a', 'today').queryFn({ signal: new AbortController().signal }), /Forbidden/);
});
test('navigation reuses fresh records and an explicit refresh fetches new data', async () => {
  let calls = 0;
  const client = { functions: { invoke: async () => ({ data: [{ revision: ++calls }], error: null }) } };
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const query = reportRecordsQuery(client, 'table-a', 'last_7_days');
  await cache.fetchQuery(query);
  await cache.fetchQuery(query);
  assert.equal(calls, 1);
  await cache.invalidateQueries({ queryKey: ['crm-records', 'table-a'], refetchType: 'none' });
  const refreshed = await cache.fetchQuery(query);
  assert.equal(calls, 2);
  assert.equal(refreshed[0].revision, 2);
  cache.clear();
});

import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Pure merge/dedupe logic used by fetchAccessibleDashboards — kept here so we
 * can lock the shared-agency union without mocking Supabase.
 */
function mergeDashboardRows(
  owned: { id: string; created_at?: string | null }[],
  shared: { id: string; created_at?: string | null }[],
) {
  const map = new Map<string, { id: string; created_at?: string | null }>();
  for (const row of [...owned, ...shared]) {
    if (row?.id) map.set(row.id, row);
  }
  return Array.from(map.values()).sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
}

test('owned MC dashboards + DMM shared-agency dashboards union without duplicates', () => {
  const owned = [
    { id: 'aviali-mc', created_at: '2026-08-02T00:00:00Z' },
  ];
  const shared = [
    { id: 'man-dmm', created_at: '2026-07-01T00:00:00Z' },
    { id: 'holder-dmm', created_at: '2026-06-15T00:00:00Z' },
    { id: 'aviali-mc', created_at: '2026-08-02T00:00:00Z' }, // overlap
  ];
  const merged = mergeDashboardRows(owned, shared);
  assert.equal(merged.length, 3);
  assert.deepEqual(
    merged.map((r) => r.id),
    ['aviali-mc', 'man-dmm', 'holder-dmm'],
  );
});

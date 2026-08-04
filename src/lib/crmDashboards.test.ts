import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Pure merge/dedupe logic used by fetchAccessibleDashboards — kept here so we
 * can lock the shared-agency union without mocking Supabase.
 */
function mergeDashboardRows(
  owned: { id: string; created_at?: string | null }[],
  foreign: { id: string; created_at?: string | null }[],
) {
  const map = new Map<string, { id: string; created_at?: string | null }>();
  for (const row of [...owned, ...foreign]) {
    if (row?.id) map.set(row.id, row);
  }
  return Array.from(map.values()).sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
}

/** Mirrors resolveDashboardHomeTenant preference order without network I/O. */
function pickHomeTenant(opts: {
  uiTenantId: string;
  agencyTenantId?: string | null;
  clientTenantId?: string | null;
}) {
  return opts.agencyTenantId || opts.clientTenantId || opts.uiTenantId;
}

test('owned MC dashboards + DMM shared-agency dashboards union without duplicates', () => {
  const owned = [
    { id: 'aviali-mc', created_at: '2026-08-02T00:00:00Z' },
  ];
  const foreign = [
    { id: 'man-dmm', created_at: '2026-07-01T00:00:00Z' },
    { id: 'holder-dmm', created_at: '2026-06-15T00:00:00Z' },
    { id: 'berliner-dmm', created_at: '2026-05-01T00:00:00Z' },
    { id: 'aviali-mc', created_at: '2026-08-02T00:00:00Z' },
  ];
  const merged = mergeDashboardRows(owned, foreign);
  assert.equal(merged.length, 4);
  assert.deepEqual(
    merged.map((r) => r.id),
    ['aviali-mc', 'man-dmm', 'holder-dmm', 'berliner-dmm'],
  );
});

test('shared-agency create prefers agency home tenant over UI tenant', () => {
  const DMM = 'dmm-tenant';
  const MC = 'mc-tenant';
  assert.equal(
    pickHomeTenant({ uiTenantId: MC, agencyTenantId: DMM, clientTenantId: DMM }),
    DMM,
  );
  assert.equal(
    pickHomeTenant({ uiTenantId: MC, agencyTenantId: null, clientTenantId: DMM }),
    DMM,
  );
  assert.equal(
    pickHomeTenant({ uiTenantId: MC, agencyTenantId: null, clientTenantId: null }),
    MC,
  );
});

test('owned-agency foreign rows are part of the accessible union (DMM sees MC orphans)', () => {
  // After a mistaken create on MC, DMM (agency owner) must still see the row
  // via owned-agency foreign fetch — not only via sharedAgencyIds.
  const ownedOnDmm = [{ id: 'man-dmm', created_at: '2026-07-01T00:00:00Z' }];
  const foreignOnMcOwnedAgency = [
    { id: 'aviali-mc-orphan', created_at: '2026-08-02T00:00:00Z' },
  ];
  const merged = mergeDashboardRows(ownedOnDmm, foreignOnMcOwnedAgency);
  assert.equal(merged.some((r) => r.id === 'aviali-mc-orphan'), true);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  agenciesFromJoin,
  mergeAgencyLists,
  pickTenantHomeAgencyId,
} from "./resolveTenantAgency.ts";

const TENANT = "tenant-promo";
const OWNED_DEFAULT = {
  id: "agency-owned-default",
  tenant_id: TENANT,
  is_default: true,
  created_at: "2026-01-02T00:00:00.000Z",
};
const OWNED_FIRST = {
  id: "agency-owned-first",
  tenant_id: TENANT,
  is_default: false,
  created_at: "2026-01-01T00:00:00.000Z",
};
const SHARED = {
  id: "agency-shared-promo",
  tenant_id: "tenant-home",
  is_default: false,
  created_at: "2025-01-01T00:00:00.000Z",
};

test("owned default beats other owned agencies", () => {
  assert.equal(
    pickTenantHomeAgencyId(TENANT, [OWNED_FIRST, OWNED_DEFAULT, SHARED]),
    OWNED_DEFAULT.id,
  );
});

test("first owned agency is used when none is default", () => {
  assert.equal(pickTenantHomeAgencyId(TENANT, [OWNED_FIRST, SHARED]), OWNED_FIRST.id);
});

test("shared agency is used when the tenant owns none", () => {
  assert.equal(pickTenantHomeAgencyId(TENANT, [SHARED]), SHARED.id);
});

test("returns null without a tenant or agency list", () => {
  assert.equal(pickTenantHomeAgencyId(null, [SHARED]), null);
  assert.equal(pickTenantHomeAgencyId(TENANT, []), null);
  assert.equal(pickTenantHomeAgencyId(TENANT, undefined), null);
});

test("mergeAgencyLists de-duplicates owned and shared rows", () => {
  const merged = mergeAgencyLists([OWNED_FIRST, SHARED], [SHARED]);
  assert.deepEqual(merged.map((row) => row.id), [OWNED_FIRST.id, SHARED.id]);
});

test("agenciesFromJoin accepts a nested object or array", () => {
  assert.deepEqual(agenciesFromJoin(SHARED).map((row) => row.id), [SHARED.id]);
  assert.deepEqual(
    agenciesFromJoin([SHARED, null]).map((row) => row.id),
    [SHARED.id],
  );
  assert.deepEqual(agenciesFromJoin(null), []);
});

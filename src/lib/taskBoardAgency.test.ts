import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveBoardTaskAgency,
  filterTasksBySelectedAgency,
  resolveTasksBoardScope,
  syncLocalTasksForAgencyFilter,
} from "./taskBoardAgency.ts";

test("header agency wins over the first-agency fallback", () => {
  assert.equal(resolveBoardTaskAgency("agency-dmm", "agency-first"), "agency-dmm");
});

test("all agencies falls back to the first loaded agency", () => {
  assert.equal(resolveBoardTaskAgency("all", "agency-first"), "agency-first");
});

test("empty / unset header also uses the fallback", () => {
  assert.equal(resolveBoardTaskAgency(null, "agency-first"), "agency-first");
  assert.equal(resolveBoardTaskAgency(undefined, "agency-first"), "agency-first");
});

test("returns null when neither source has an agency", () => {
  assert.equal(resolveBoardTaskAgency("all", null), null);
  assert.equal(resolveBoardTaskAgency(undefined, undefined), null);
});

const taskA = { id: "1", agency_id: "agency-A" };
const taskB = { id: "2", agency_id: "agency-B" };
const taskNull = { id: "3", agency_id: null };

test("filterTasksBySelectedAgency keeps only the header agency", () => {
  const filtered = filterTasksBySelectedAgency([taskA, taskB, taskNull], "agency-A");
  assert.deepEqual(filtered.map((t) => t.id), ["1"]);
});

test("filterTasksBySelectedAgency leaves the list alone for all", () => {
  const all = [taskA, taskB, taskNull];
  assert.equal(filterTasksBySelectedAgency(all, "all"), all);
  assert.equal(filterTasksBySelectedAgency(all, null), all);
});

test("resolveTasksBoardScope uses agency-only when header is set", () => {
  assert.deepEqual(
    resolveTasksBoardScope({
      tenantId: "t1",
      selectedAgency: "agency-A",
      crossTenantAgencyIds: ["shared-1"],
    }),
    { type: "agency", agencyId: "agency-A" },
  );
});

test("resolveTasksBoardScope uses tenant_or_shared when header is all", () => {
  assert.deepEqual(
    resolveTasksBoardScope({
      tenantId: "t1",
      selectedAgency: "all",
      crossTenantAgencyIds: ["shared-1"],
    }),
    {
      type: "tenant_or_shared",
      tenantId: "t1",
      crossTenantAgencyIds: ["shared-1"],
    },
  );
});

test("resolveTasksBoardScope uses tenant when no shared agencies", () => {
  assert.deepEqual(
    resolveTasksBoardScope({
      tenantId: "t1",
      selectedAgency: "all",
      crossTenantAgencyIds: [],
    }),
    { type: "tenant", tenantId: "t1" },
  );
});

/**
 * Reproduction of the WeeklyTaskBoard bug: localTasks kept the previous
 * (all-agencies) list while isFetching=true after the header agency changed,
 * so the backlog still showed other agencies' tasks.
 */
test("syncLocalTasksForAgencyFilter narrows during in-flight agency switch", () => {
  const previousLocal = [taskA, taskB];
  const duringFetch = syncLocalTasksForAgencyFilter({
    isFetching: true,
    fetchedTasks: [],
    previousLocal,
    selectedAgency: "agency-A",
  });
  assert.deepEqual(
    duringFetch.map((t) => t.agency_id),
    ["agency-A"],
    "must not keep agency-B tasks on screen while the filtered query loads",
  );
});

test("syncLocalTasksForAgencyFilter applies settled server rows for the agency", () => {
  const settled = syncLocalTasksForAgencyFilter({
    isFetching: false,
    fetchedTasks: [taskA, taskB], // defensive: even if server leaked, client filters
    previousLocal: [taskA, taskB],
    selectedAgency: "agency-A",
  });
  assert.deepEqual(settled.map((t) => t.id), ["1"]);
});

test("legacy isFetching early-return without agency narrow leaks other agencies", () => {
  // Documents the pre-fix behavior for regression clarity.
  const previousLocal = [taskA, taskB];
  const legacySync = (isFetching: boolean, fetchedTasks: typeof previousLocal) => {
    if (isFetching) return previousLocal; // ← old WeeklyTaskBoard effect
    return fetchedTasks ?? [];
  };
  const leaked = legacySync(true, []);
  assert.deepEqual(
    leaked.map((t) => t.agency_id),
    ["agency-A", "agency-B"],
    "legacy path reproduces the bug",
  );
});

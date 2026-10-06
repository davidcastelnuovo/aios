import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveBoardTaskAgency,
  resolveNewTaskAgency,
  resolveTaskEffectiveAgency,
  filterTasksBySelectedAgency,
  filterTasksForBoardView,
  headerAgencyAppliesToBoard,
  resolveTasksBoardAgencyFilter,
  buildTasksBoardScopeOrFilter,
  resolveTasksBoardScope,
  syncLocalTasksForAgencyFilter,
  filterTasksByBoardTenantScope,
  taskBelongsToBoardTenantScope,
} from "./taskBoardAgency.ts";
import { filterTasksByCampaignerBoardFilter } from "./taskFilters.ts";

const PROMO = "agency-promo";
const DMM = "agency-dmm";

test("header agency wins over the first-agency fallback", () => {
  assert.equal(resolveBoardTaskAgency(PROMO, "agency-first"), PROMO);
});

test("all agencies falls back to the first loaded agency", () => {
  assert.equal(resolveBoardTaskAgency("all", "agency-first"), "agency-first");
  assert.equal(resolveBoardTaskAgency(null, "agency-first"), "agency-first");
  assert.equal(resolveBoardTaskAgency(undefined, "agency-first"), "agency-first");
});

test("returns null when neither source has an agency", () => {
  assert.equal(resolveBoardTaskAgency("all", null), null);
  assert.equal(resolveBoardTaskAgency(undefined, undefined), null);
});

test("a task for a client belongs to that client's agency", () => {
  assert.equal(
    resolveNewTaskAgency({ clientAgencyId: DMM, selectedAgency: PROMO, fallbackAgencyId: PROMO }),
    DMM,
  );
});

test("a task without a client uses the header agency, then the fallback", () => {
  assert.equal(resolveNewTaskAgency({ selectedAgency: PROMO, fallbackAgencyId: "first" }), PROMO);
  assert.equal(resolveNewTaskAgency({ selectedAgency: "all", fallbackAgencyId: "first" }), "first");
});

const misstampedDmmTask = {
  id: "1",
  agency_id: PROMO,
  client_id: "client-dmm",
  clients: { agency_id: DMM },
};
const promoClientTaskStampedDmm = {
  id: "2",
  agency_id: DMM,
  client_id: "client-promo",
  clients: { agency_id: PROMO },
};
const promoTaskNoClient = { id: "3", agency_id: PROMO, client_id: null, clients: null };

test("the client's agency decides where a task belongs", () => {
  assert.equal(resolveTaskEffectiveAgency(misstampedDmmTask), DMM);
  assert.equal(resolveTaskEffectiveAgency(promoClientTaskStampedDmm), PROMO);
});

test("filtering to promo hides another agency's client and keeps its own", () => {
  const filtered = filterTasksBySelectedAgency(
    [misstampedDmmTask, promoClientTaskStampedDmm, promoTaskNoClient],
    PROMO,
  );
  assert.deepEqual(filtered.map((task) => task.id), ["2", "3"]);
});

test("filterTasksBySelectedAgency leaves the list alone for all", () => {
  const all = [misstampedDmmTask, promoClientTaskStampedDmm];
  assert.equal(filterTasksBySelectedAgency(all, "all"), all);
  assert.equal(filterTasksBySelectedAgency(all, null), all);
});

test("mine view keeps assigned tasks across agencies regardless of header", () => {
  const rows = [misstampedDmmTask, promoClientTaskStampedDmm, promoTaskNoClient];
  assert.deepEqual(
    filterTasksForBoardView(rows, "all", "mine").map((task) => task.id),
    ["1", "2", "3"],
  );
  assert.deepEqual(
    filterTasksForBoardView(rows, PROMO, "mine").map((task) => task.id),
    ["1", "2", "3"],
  );
});

test("resolveTasksBoardAgencyFilter ignores header on person queues", () => {
  assert.equal(resolveTasksBoardAgencyFilter("mine", "all"), "all");
  assert.equal(resolveTasksBoardAgencyFilter("mine", PROMO), "all");
  assert.equal(resolveTasksBoardAgencyFilter("staff-david", PROMO), "all");
  assert.equal(resolveTasksBoardAgencyFilter("all", PROMO), PROMO);
});

test("team view still honors the header agency", () => {
  const rows = [misstampedDmmTask, promoClientTaskStampedDmm, promoTaskNoClient];
  assert.deepEqual(
    filterTasksForBoardView(rows, PROMO, "all").map((task) => task.id),
    ["2", "3"],
  );
});

test("header agency applies on team board only", () => {
  assert.equal(headerAgencyAppliesToBoard("all", PROMO), true);
  assert.equal(headerAgencyAppliesToBoard("all", "all"), false);
  assert.equal(headerAgencyAppliesToBoard("mine", "all"), false);
  assert.equal(headerAgencyAppliesToBoard("mine", PROMO), false);
  assert.equal(headerAgencyAppliesToBoard("staff-david", PROMO), false);
});

test("picking a specific campaigner keeps tasks across agencies", () => {
  const rows = [misstampedDmmTask, promoClientTaskStampedDmm, promoTaskNoClient];
  assert.deepEqual(
    filterTasksForBoardView(rows, "all", "staff-david").map((task) => task.id),
    ["1", "2", "3"],
  );
  assert.deepEqual(
    filterTasksForBoardView(rows, PROMO, "staff-david").map((task) => task.id),
    ["1", "2", "3"],
  );
});

test("syncLocalTasksForAgencyFilter keeps mine rows across agencies while fetching", () => {
  const duringFetch = syncLocalTasksForAgencyFilter({
    isFetching: true,
    fetchedTasks: [],
    previousLocal: [misstampedDmmTask, promoTaskNoClient],
    selectedAgency: "all",
    campaignerFilter: "mine",
  });
  assert.deepEqual(duringFetch.map((task) => task.id), ["1", "3"]);
});

test("syncLocalTasksForAgencyFilter can narrow by campaigner while fetching", () => {
  const rows = [
    { ...misstampedDmmTask, campaigner_id: "staff-itay" },
    { ...promoTaskNoClient, campaigner_id: "staff-other" },
  ];
  const duringFetch = syncLocalTasksForAgencyFilter({
    isFetching: true,
    fetchedTasks: [],
    previousLocal: rows,
    selectedAgency: "all",
    campaignerFilter: "mine",
    applyCampaignerFilter: (tasks) =>
      filterTasksByCampaignerBoardFilter(tasks, "mine", {
        kind: "assigned",
        campaignerId: "staff-itay",
        userId: "user-itay",
        campaignerIds: ["staff-itay"],
      }),
  });
  assert.deepEqual(duringFetch.map((task) => task.id), ["1"]);
});

test("buildTasksBoardScopeOrFilter scopes tenant and shared agencies only", () => {
  const scope = resolveTasksBoardScope({
    tenantId: "tenant-dmm",
    crossTenantAgencyIds: ["agency-dmm-mc"],
  });
  assert.equal(
    buildTasksBoardScopeOrFilter(scope),
    "tenant_id.eq.tenant-dmm,agency_id.in.(agency-dmm-mc)",
  );
  assert.equal(
    buildTasksBoardScopeOrFilter(resolveTasksBoardScope({ tenantId: "tenant-promo" })),
    "tenant_id.eq.tenant-promo",
  );
});

test("resolveTasksBoardScope ignores own-tenant agency ids (not cross-tenant shares)", () => {
  assert.deepEqual(
    resolveTasksBoardScope({
      tenantId: "tenant-promo",
      crossTenantAgencyIds: [],
    }),
    { type: "tenant", tenantId: "tenant-promo" },
  );
  assert.deepEqual(
    resolveTasksBoardScope({
      tenantId: "tenant-promo",
      crossTenantAgencyIds: ["agency-dmm-mc"],
    }),
    { type: "tenant_or_shared", tenantId: "tenant-promo", crossTenantAgencyIds: ["agency-dmm-mc"] },
  );
});

test("filterTasksByBoardTenantScope keeps own tenant and shared-agency client rows", () => {
  const promoTenant = "tenant-promo";
  const sharedDmmAgency = DMM;
  const ownTenantTask = { ...promoTaskNoClient, tenant_id: promoTenant };
  const foreignSharedClientTask = {
    ...misstampedDmmTask,
    tenant_id: "tenant-dmm",
  };
  const foreignUnsharedTask = {
    id: "4",
    tenant_id: "tenant-other",
    agency_id: "agency-other",
    client_id: "client-other",
    clients: { agency_id: "agency-other" },
  };
  const rows = [ownTenantTask, foreignSharedClientTask, foreignUnsharedTask];
  assert.deepEqual(
    filterTasksByBoardTenantScope(rows, promoTenant, [sharedDmmAgency]).map((task) => task.id),
    ["3", "1"],
  );
});

test("taskBelongsToBoardTenantScope rejects cross-tenant rows without a shared client", () => {
  assert.equal(
    taskBelongsToBoardTenantScope(
      {
        tenant_id: "tenant-dmm",
        agency_id: DMM,
        client_id: null,
        clients: null,
      },
      "tenant-promo",
      [DMM],
    ),
    false,
  );
});

test("syncLocalTasksForAgencyFilter narrows during an in-flight agency switch", () => {
  const duringFetch = syncLocalTasksForAgencyFilter({
    isFetching: true,
    fetchedTasks: [],
    previousLocal: [misstampedDmmTask, promoTaskNoClient],
    selectedAgency: PROMO,
  });
  assert.deepEqual(duringFetch.map((task) => task.id), ["3"]);
});

test("syncLocalTasksForAgencyFilter applies settled server rows for the agency", () => {
  const settled = syncLocalTasksForAgencyFilter({
    isFetching: false,
    fetchedTasks: [misstampedDmmTask, promoClientTaskStampedDmm],
    previousLocal: [],
    selectedAgency: PROMO,
  });
  assert.deepEqual(settled.map((task) => task.id), ["2"]);
});

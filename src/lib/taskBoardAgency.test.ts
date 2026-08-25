import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveBoardTaskAgency,
  resolveNewTaskAgency,
  resolveTaskEffectiveAgency,
  filterTasksBySelectedAgency,
  resolveTasksBoardScope,
  syncLocalTasksForAgencyFilter,
} from "./taskBoardAgency.ts";

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

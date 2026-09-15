import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultTaskFilters,
  filterTasksByCampaignerBoardFilter,
  resolveMineTaskAssignee,
} from "./taskFilters.ts";

test("the tasks board opens on my own tasks", () => {
  assert.equal(defaultTaskFilters.campaignerId, "mine");
});

test("mine follows the campaigner linked on the user, including owners", () => {
  const mine = resolveMineTaskAssignee({
    campaignerId: "staff-david",
    userId: "user-david",
  });
  assert.deepEqual(mine, { kind: "assigned", campaignerId: "staff-david", salesPersonId: undefined });
});

test("mine uses sales-person when that is the linked staff row", () => {
  const mine = resolveMineTaskAssignee({ salesPersonId: "sales-1", userId: "user-1" });
  assert.deepEqual(mine, { kind: "assigned", campaignerId: undefined, salesPersonId: "sales-1" });
});

test("without a staff link, mine falls back to tasks the user created", () => {
  assert.deepEqual(resolveMineTaskAssignee({ userId: "user-1" }), {
    kind: "created_by",
    userId: "user-1",
  });
});

test("no other filter narrows the board on entry", () => {
  assert.equal(defaultTaskFilters.taskType, "all");
  assert.equal(defaultTaskFilters.association, "all");
  assert.equal(defaultTaskFilters.startDate, undefined);
  assert.equal(defaultTaskFilters.endDate, undefined);
});

test("filterTasksByCampaignerBoardFilter keeps only mine assignments", () => {
  const rows = [
    { id: "1", campaigner_id: "staff-itay", sales_person_id: null, created_by: null },
    { id: "2", campaigner_id: "staff-other", sales_person_id: null, created_by: null },
  ];
  const mine = {
    kind: "assigned" as const,
    campaignerId: "staff-itay",
    campaignerIds: ["staff-itay"],
  };
  assert.deepEqual(
    filterTasksByCampaignerBoardFilter(rows, "mine", mine).map((task) => task.id),
    ["1"],
  );
  assert.deepEqual(
    filterTasksByCampaignerBoardFilter(rows, "staff-other", mine).map((task) => task.id),
    ["2"],
  );
});

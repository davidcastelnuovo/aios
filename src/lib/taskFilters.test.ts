import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultTaskFilters,
  filterTasksByCampaignerBoardFilter,
  filterTasksByRelatedEntity,
  filterTasksForBoardUserPreview,
  parseTasksFilterPreset,
  resolveMineTaskAssignee,
  resolveTaskPeriodStart,
  serializeTasksFilterPreset,
  buildMineQueueOrFilter,
  isMineQueueFilter,
  taskMatchesActivityPeriod,
} from "./taskFilters.ts";

test("the tasks board opens on my tasks and tasks I assigned", () => {
  assert.equal(defaultTaskFilters.campaignerId, "mine_assigned");
  assert.equal(defaultTaskFilters.openClosed, "open");
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
  assert.equal(defaultTaskFilters.period, "all");
  assert.equal(defaultTaskFilters.relatedKind, "all");
});

test("isMineQueueFilter covers mine and mine_assigned", () => {
  assert.equal(isMineQueueFilter("mine"), true);
  assert.equal(isMineQueueFilter("mine_assigned"), true);
  assert.equal(isMineQueueFilter("all"), false);
});

test("filterTasksByCampaignerBoardFilter keeps only mine assignments", () => {
  const rows = [
    { id: "1", campaigner_id: "staff-itay", sales_person_id: null, created_by: null },
    { id: "2", campaigner_id: "staff-other", sales_person_id: null, created_by: null },
  ];
  const mine = {
    kind: "assigned" as const,
    campaignerId: "staff-itay",
    userId: "user-itay",
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

test("mine_assigned keeps tasks I assigned to someone else", () => {
  const rows = [
    { id: "assigned-to-me", campaigner_id: "staff-itay", sales_person_id: null, created_by: "user-other" },
    { id: "i-assigned", campaigner_id: "staff-other", sales_person_id: null, created_by: "user-itay" },
    { id: "unrelated", campaigner_id: "staff-other", sales_person_id: null, created_by: "user-other" },
  ];
  const mine = {
    kind: "assigned" as const,
    campaignerId: "staff-itay",
    userId: "user-itay",
    campaignerIds: ["staff-itay"],
  };
  assert.deepEqual(
    filterTasksByCampaignerBoardFilter(rows, "mine", mine).map((task) => task.id),
    ["assigned-to-me"],
  );
  assert.deepEqual(
    filterTasksByCampaignerBoardFilter(rows, "mine_assigned", mine).map((task) => task.id),
    ["assigned-to-me", "i-assigned"],
  );
});

test("buildMineQueueOrFilter adds created_by for mine_assigned", () => {
  const identity = {
    kind: "assigned" as const,
    campaignerId: "c1",
    userId: "user-1",
    campaignerIds: ["c1"],
  };
  assert.equal(buildMineQueueOrFilter(identity, "mine"), "campaigner_id.eq.c1");
  assert.equal(
    buildMineQueueOrFilter(identity, "mine_assigned"),
    "campaigner_id.eq.c1,created_by.eq.user-1",
  );
});

test("filter preset round-trips campaigner, period, and related entity", () => {
  const stored = serializeTasksFilterPreset({
    campaignerId: "mine",
    taskType: "campaign",
    association: "clients",
    period: "month",
    relatedKind: "lead",
    relatedId: "lead-1",
    relatedLabel: "דלתא",
    openClosed: "done",
  });
  const parsed = parseTasksFilterPreset(stored);
  assert.equal(parsed.campaignerId, "mine");
  assert.equal(parsed.taskType, "campaign");
  assert.equal(parsed.period, "month");
  assert.equal(parsed.relatedKind, "lead");
  assert.equal(parsed.relatedId, "lead-1");
  assert.equal(parsed.relatedLabel, "דלתא");
  assert.equal(parsed.openClosed, "done");
});

test("period window uses week/month starts and rolling 3 months / year", () => {
  const now = new Date(2026, 8, 17);
  const week = resolveTaskPeriodStart("week", now);
  const month = resolveTaskPeriodStart("month", now);
  assert.equal(week?.getDate(), 13);
  assert.equal(month?.getDate(), 1);
  assert.equal(month?.getMonth(), 8);
  assert.equal(resolveTaskPeriodStart("all", now), undefined);
  const three = resolveTaskPeriodStart("quarter", now);
  assert.equal(three?.getMonth(), 5);
  assert.equal(taskMatchesActivityPeriod({ status: "open", created_at: "2026-09-10T10:00:00" }, month), true);
  assert.equal(taskMatchesActivityPeriod({ status: "open", created_at: "2026-07-01T10:00:00" }, month), false);
  assert.equal(
    taskMatchesActivityPeriod(
      { status: "done", updated_at: "2026-09-16T10:00:00", created_at: "2026-01-01T10:00:00" },
      month,
    ),
    false,
  );
  assert.equal(
    taskMatchesActivityPeriod(
      { status: "done", updated_at: "2026-09-16T10:00:00", created_at: "2026-09-02T10:00:00" },
      month,
    ),
    true,
  );
});

test("old clientId presets map onto the related-entity filter", () => {
  const fromClient = parseTasksFilterPreset({ clientId: "client-9" });
  assert.equal(fromClient.relatedKind, "client");
  assert.equal(fromClient.relatedId, "client-9");
  const fromNone = parseTasksFilterPreset({ clientId: "none" });
  assert.equal(fromNone.relatedKind, "none");
});

test("filterTasksByRelatedEntity matches client, lead, or unassigned", () => {
  const rows = [
    { id: "1", client_id: "c1", lead_id: null },
    { id: "2", client_id: null, lead_id: "l1" },
    { id: "3", client_id: null, lead_id: null },
  ];
  assert.deepEqual(filterTasksByRelatedEntity(rows, "client", "c1").map((task) => task.id), ["1"]);
  assert.deepEqual(filterTasksByRelatedEntity(rows, "lead", "l1").map((task) => task.id), ["2"]);
  assert.deepEqual(filterTasksByRelatedEntity(rows, "none").map((task) => task.id), ["3"]);
  assert.equal(filterTasksByRelatedEntity(rows, "all").length, 3);
});

test("filterTasksForBoardUserPreview hides other users' tasks in view-as mode", () => {
  const rows = [
    { id: "1", campaigner_id: "staff-felix", sales_person_id: null, created_by: "user-felix" },
    { id: "2", campaigner_id: "staff-david", sales_person_id: null, created_by: "user-david" },
    { id: "3", campaigner_id: null, sales_person_id: null, created_by: "user-david" },
  ];
  const felix = {
    kind: "assigned" as const,
    campaignerId: "staff-felix",
    userId: "user-felix",
    campaignerIds: ["staff-felix"],
  };
  assert.deepEqual(
    filterTasksForBoardUserPreview(rows, "user-felix", felix).map((task) => task.id),
    ["1"],
  );
});

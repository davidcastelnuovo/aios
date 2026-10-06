import assert from "node:assert/strict";
import test from "node:test";
import {
  groupLeadsBySurfaceUsers,
  isSalesPersonOnSurface,
  parseLeadTableLayout,
  sortLeadsByDate,
  UNASSIGNED_LEAD_GROUP_ID,
} from "./leadTableLayout.ts";

const dana = { id: "dana", full_name: "דנה", agency_id: "agency-a", agencyIds: ["agency-a"] };
const noam = { id: "noam", full_name: "נועם", agency_id: "agency-b", agencyIds: ["agency-b", "agency-a"] };
const otherAgency = { id: "other", full_name: "מיכל", agency_id: "agency-c", agencyIds: ["agency-c"] };

test("parseLeadTableLayout defaults to by_user", () => {
  assert.equal(parseLeadTableLayout(null), "by_user");
  assert.equal(parseLeadTableLayout("kanban"), "by_user");
  assert.equal(parseLeadTableLayout("by_date"), "by_date");
});

test("isSalesPersonOnSurface keeps everyone when agency is all", () => {
  assert.equal(isSalesPersonOnSurface(dana, "all"), true);
  assert.equal(isSalesPersonOnSurface(otherAgency, null), true);
});

test("isSalesPersonOnSurface uses primary agency or extra memberships", () => {
  assert.equal(isSalesPersonOnSurface(dana, "agency-a"), true);
  assert.equal(isSalesPersonOnSurface(noam, "agency-a"), true);
  assert.equal(isSalesPersonOnSurface(otherAgency, "agency-a"), false);
});

test("sortLeadsByDate newest first", () => {
  const sorted = sortLeadsByDate([
    { id: "old", created_at: "2026-01-01T00:00:00.000Z" },
    { id: "new", created_at: "2026-09-01T00:00:00.000Z" },
    { id: "mid", created_at: "2026-06-01T00:00:00.000Z" },
  ]);
  assert.deepEqual(sorted.map((lead) => lead.id), ["new", "mid", "old"]);
});

test("groupLeadsBySurfaceUsers lists surface users even when empty", () => {
  const groups = groupLeadsBySurfaceUsers(
    [{ id: "l1", sales_person_id: "dana", created_at: "2026-09-02T00:00:00.000Z" }],
    [dana, noam, otherAgency],
    "agency-a",
  );

  assert.deepEqual(groups.map((group) => group.id), ["dana", "noam"]);
  assert.equal(groups[0].leads[0].id, "l1");
  assert.equal(groups[1].leads.length, 0);
});

test("groupLeadsBySurfaceUsers keeps off-surface assignees and sorts dates", () => {
  const groups = groupLeadsBySurfaceUsers(
    [
      { id: "older", sales_person_id: "other", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "newer", sales_person_id: "other", created_at: "2026-08-01T00:00:00.000Z" },
      { id: "free", sales_person_id: null, created_at: "2026-07-01T00:00:00.000Z" },
    ],
    [dana, otherAgency],
    "agency-a",
  );

  assert.deepEqual(groups.map((group) => [group.id, group.leads.map((lead) => lead.id)]), [
    ["dana", []],
    ["other", ["newer", "older"]],
    [UNASSIGNED_LEAD_GROUP_ID, ["free"]],
  ]);
  assert.equal(groups[1].label, "מיכל");
});

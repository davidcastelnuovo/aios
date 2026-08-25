import assert from "node:assert/strict";
import test from "node:test";
import { applyLeadClientFilters, endOfDayIso } from "./leadFilters.ts";

const leads = [
  { id: "1", status: "new", sales_person_id: "sp-a", response_status: "hot" },
  { id: "2", status: "won", sales_person_id: null, response_status: null },
  { id: "3", status: "new", sales_person_id: "sp-b", response_status: "cold" },
];

const tagsMap = {
  "1": ["tag-red"],
  "2": [],
  "3": ["tag-blue"],
};

const emptyFilters = {
  stageId: "all",
  salesPersonIds: [] as string[],
  responseStatus: [] as string[],
  tagIds: [] as string[],
};

test("chat/kanban stage filter keeps only the selected pipeline stage", () => {
  const result = applyLeadClientFilters(leads, { ...emptyFilters, stageId: "won" });
  assert.deepEqual(result.map((l) => l.id), ["2"]);
});

test("none-only sales person filter keeps unassigned leads", () => {
  const result = applyLeadClientFilters(leads, {
    ...emptyFilters,
    salesPersonIds: ["none"],
  });
  assert.deepEqual(result.map((l) => l.id), ["2"]);
});

test("none + named sales people unions unassigned with the named set", () => {
  const result = applyLeadClientFilters(leads, {
    ...emptyFilters,
    salesPersonIds: ["none", "sp-b"],
  });
  assert.deepEqual(result.map((l) => l.id), ["2", "3"]);
});

test("none-only response status keeps leads with no status", () => {
  const result = applyLeadClientFilters(leads, {
    ...emptyFilters,
    responseStatus: ["none"],
  });
  assert.deepEqual(result.map((l) => l.id), ["2"]);
});

test("none-only tag filter keeps untagged leads", () => {
  const result = applyLeadClientFilters(
    leads,
    { ...emptyFilters, tagIds: ["none"] },
    tagsMap,
  );
  assert.deepEqual(result.map((l) => l.id), ["2"]);
});

test("none + tag unions untagged with tagged matches", () => {
  const result = applyLeadClientFilters(
    leads,
    { ...emptyFilters, tagIds: ["none", "tag-red"] },
    tagsMap,
  );
  assert.deepEqual(result.map((l) => l.id), ["1", "2"]);
});

test("endOfDayIso does not mutate the original date", () => {
  const original = new Date("2026-08-25T10:00:00.000Z");
  const before = original.getTime();
  const iso = endOfDayIso(original);
  assert.equal(original.getTime(), before);
  assert.ok(new Date(iso).getTime() > before);
});

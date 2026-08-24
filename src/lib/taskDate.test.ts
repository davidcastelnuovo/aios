import assert from "node:assert/strict";
import test from "node:test";
import { format, parseISO, startOfDay } from "date-fns";
import {
  formatTaskDate,
  isTaskDateBefore,
  isTaskDateInRange,
  isTaskOnDay,
  parseTaskDate,
} from "./taskDate.ts";

test("formatTaskDate uses the local calendar day, not UTC", () => {
  const localMidnight = new Date(2026, 7, 24, 0, 0, 0, 0);
  assert.equal(formatTaskDate(localMidnight), "2026-08-24");
  // The bug Felix hit: toISOString() rolls a UTC+ midnight back a day.
  if (localMidnight.getTimezoneOffset() < 0) {
    assert.notEqual(localMidnight.toISOString().split("T")[0], "2026-08-24");
  }
});

test("parseTaskDate treats YYYY-MM-DD as a local day", () => {
  const parsed = parseTaskDate("2026-08-24");
  assert.ok(parsed);
  assert.equal(format(parsed!, "yyyy-MM-dd"), "2026-08-24");
  assert.equal(parsed!.getHours(), 0);
});

test("isTaskOnDay matches the local calendar day", () => {
  const monday = startOfDay(parseISO("2026-08-24"));
  assert.equal(isTaskOnDay("2026-08-24", monday), true);
  assert.equal(isTaskOnDay("2026-08-23", monday), false);
  assert.equal(isTaskOnDay(null, monday), false);
});

test("isTaskDateBefore compares date-only strings without UTC drift", () => {
  const today = startOfDay(parseISO("2026-08-24"));
  assert.equal(isTaskDateBefore("2026-08-23", today), true);
  assert.equal(isTaskDateBefore("2026-08-24", today), false);
  assert.equal(isTaskDateBefore("2026-08-25", today), false);
});

test("isTaskDateInRange is inclusive on both ends", () => {
  const start = startOfDay(parseISO("2026-08-24"));
  const end = startOfDay(parseISO("2026-08-30"));
  assert.equal(isTaskDateInRange("2026-08-24", start, end), true);
  assert.equal(isTaskDateInRange("2026-08-30", start, end), true);
  assert.equal(isTaskDateInRange("2026-08-23", start, end), false);
  assert.equal(isTaskDateInRange("2026-08-31", start, end), false);
});

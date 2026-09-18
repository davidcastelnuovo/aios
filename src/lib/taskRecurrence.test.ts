import assert from "node:assert/strict";
import test from "node:test";
import {
  computeFirstOccurrenceDate,
  computeNextRecurrenceDate,
  describeRecurrence,
  formatLocalDate,
} from "./taskRecurrence.ts";

test("weekly recurrence lands on the chosen weekday", () => {
  const next = computeNextRecurrenceDate({
    frequency: "weekly",
    weekday: 1, // Monday
    fromDate: new Date(2026, 8, 13), // Sunday
    asOf: new Date(2026, 8, 13),
  });
  assert.equal(next.getDay(), 1);
  assert.equal(formatLocalDate(next), "2026-09-21");
});

test("monthly recurrence clamps short months", () => {
  const next = computeNextRecurrenceDate({
    frequency: "monthly",
    monthday: 31,
    fromDate: new Date(2026, 0, 31),
    asOf: new Date(2026, 0, 31),
  });
  assert.equal(formatLocalDate(next), "2026-02-28");
});

test("describeRecurrence includes day and time", () => {
  assert.equal(
    describeRecurrence({
      frequency: "weekly",
      weekday: 2,
      time: "09:00:00",
    }),
    "כל שבוע · יום שלישי · ב־09:00",
  );
});

test("first weekly occurrence can be today when weekday matches", () => {
  const monday = new Date(2026, 8, 14); // Monday
  assert.equal(monday.getDay(), 1);
  const first = computeFirstOccurrenceDate({
    frequency: "weekly",
    weekday: 1,
    asOf: monday,
  });
  assert.equal(formatLocalDate(first), "2026-09-14");
});

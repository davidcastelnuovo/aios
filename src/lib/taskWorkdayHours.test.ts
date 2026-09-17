import assert from "node:assert/strict";
import test from "node:test";
import {
  generateWorkdayTimeSlots,
  workdaySlotIndex,
} from "./taskWorkdayHours.ts";

test("workday slots run from 07:00 through 19:00", () => {
  const slots = generateWorkdayTimeSlots();
  assert.equal(slots[0], "07:00");
  assert.equal(slots[1], "07:30");
  assert.equal(slots[slots.length - 1], "19:00");
  assert.equal(slots.includes("00:00"), false);
  assert.equal(slots.includes("23:30"), false);
  assert.equal(slots.includes("06:30"), false);
  assert.equal(slots.includes("19:30"), false);
});

test("workdaySlotIndex is relative to 07:00", () => {
  assert.equal(workdaySlotIndex("07:00"), 0);
  assert.equal(workdaySlotIndex("07:30"), 1);
  assert.equal(workdaySlotIndex("10:00"), 6);
});

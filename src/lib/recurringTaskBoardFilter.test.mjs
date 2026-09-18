import assert from "node:assert/strict";
import test from "node:test";
import { startOfDay } from "date-fns";
import {
  recurringTaskBelongsInBacklog,
  shouldShowRecurringTaskNow,
} from "./recurringTaskBoardFilter.ts";

const monday = startOfDay(new Date(2026, 8, 14));
const wednesday = startOfDay(new Date(2026, 8, 16));

test("recurring task hidden before due day", () => {
  const task = {
    recurrence_frequency: "weekly",
    due_date: "2026-09-16",
    due_time: "09:00:00",
    status: "open",
  };
  assert.equal(shouldShowRecurringTaskNow(task, monday), false);
  assert.equal(shouldShowRecurringTaskNow(task, wednesday), true);
});

test("recurring overdue still visible", () => {
  const task = {
    recurrence_frequency: "weekly",
    due_date: "2026-09-10",
    status: "open",
  };
  assert.equal(shouldShowRecurringTaskNow(task, wednesday), true);
  assert.equal(recurringTaskBelongsInBacklog(task, wednesday), true);
});

test("recurring untimed shows in backlog only on due day", () => {
  const task = {
    recurrence_frequency: "weekly",
    due_date: "2026-09-16",
    due_time: null,
    status: "open",
  };
  assert.equal(recurringTaskBelongsInBacklog(task, monday), false);
  assert.equal(recurringTaskBelongsInBacklog(task, wednesday), true);
});

test("non-recurring tasks are not filtered", () => {
  const task = { due_date: "2026-09-20", status: "open" };
  assert.equal(shouldShowRecurringTaskNow(task, monday), true);
});

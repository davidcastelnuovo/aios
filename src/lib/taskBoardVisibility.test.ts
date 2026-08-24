import assert from "node:assert/strict";
import test from "node:test";
import { parseISO, startOfDay } from "date-fns";
import { formatTaskDate } from "./taskDate.ts";
import {
  buildTasksBoardDateFilter,
  shouldJumpBoardToDueDate,
  splitBoardTasks,
  taskBoardRowFingerprint,
} from "./taskBoardVisibility.ts";

const range = {
  start: startOfDay(parseISO("2026-08-24")),
  end: startOfDay(parseISO("2026-08-30")),
};
const today = startOfDay(parseISO("2026-08-24"));

test("board date filter keeps untimed open tasks, not only the current week", () => {
  const filter = buildTasksBoardDateFilter({
    rangeStart: "2026-08-24",
    rangeEnd: "2026-08-30",
    today: "2026-08-24",
  });
  assert.match(filter, /due_date\.is\.null/);
  assert.match(filter, /due_time\.is\.null/);
  assert.match(filter, /due_date\.gte\.2026-08-24/);
});

test("setting a date this week without a time puts the task on the calendar, not the backlog", () => {
  const { backlog, calendar } = splitBoardTasks(
    [{ id: "1", due_date: "2026-08-26", due_time: null, status: "open" }],
    range,
    today,
  );
  assert.equal(calendar.length, 1);
  assert.equal(backlog.length, 0);
});

test("a future date-only task outside this week stays in the backlog instead of vanishing", () => {
  const { backlog, calendar } = splitBoardTasks(
    [{ id: "1", due_date: "2026-09-10", due_time: null, status: "open" }],
    range,
    today,
  );
  assert.equal(calendar.length, 0);
  assert.equal(backlog.length, 1);
});

test("overdue tasks stay in the backlog even when they have a time", () => {
  const { backlog, calendar } = splitBoardTasks(
    [{ id: "1", due_date: "2026-08-20", due_time: "10:00:00", status: "open" }],
    range,
    today,
  );
  assert.equal(backlog.length, 1);
  assert.equal(calendar.length, 0);
});

test("timed tasks in range go to the calendar", () => {
  const { backlog, calendar } = splitBoardTasks(
    [{ id: "1", due_date: "2026-08-24", due_time: "09:00:00", status: "open" }],
    range,
    today,
  );
  assert.equal(calendar.length, 1);
  assert.equal(backlog.length, 0);
});

test("shouldJumpBoardToDueDate moves the board when the date is outside the visible week", () => {
  assert.equal(shouldJumpBoardToDueDate("2026-08-26", range), null);
  const jumped = shouldJumpBoardToDueDate("2026-09-10", range);
  assert.ok(jumped);
  assert.equal(formatTaskDate(jumped!), "2026-09-10");
});

test("fingerprint includes due_date and due_time so local state refreshes after a date edit", () => {
  const before = taskBoardRowFingerprint({
    id: "t1",
    due_date: null,
    due_time: null,
    status: "open",
  });
  const after = taskBoardRowFingerprint({
    id: "t1",
    due_date: "2026-08-26",
    due_time: null,
    status: "open",
  });
  assert.notEqual(before, after);
});

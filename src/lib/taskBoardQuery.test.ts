import assert from "node:assert/strict";
import test from "node:test";
import { startOfDay } from "date-fns";
import {
  buildTaskDueDateOrFilter,
  taskAppearsOnTimeGrid,
} from "./taskBoardQuery.ts";

test("buildTaskDueDateOrFilter uses due_date only (no target_date — column may be missing)", () => {
  const filter = buildTaskDueDateOrFilter({
    rangeStart: "2026-08-24",
    rangeEnd: "2026-08-30",
    today: "2026-08-24",
  });
  assert.equal(filter.includes("target_date"), false);
  assert.match(filter, /due_date\.lt\.2026-08-24/);
  assert.match(filter, /due_date\.gte\.2026-08-24/);
  assert.match(filter, /due_date\.lte\.2026-08-30/);
});

test("buildTaskDueDateOrFilter does not pull all historical untimed or done-undated rows", () => {
  const filter = buildTaskDueDateOrFilter({
    rangeStart: "2026-08-24",
    rangeEnd: "2026-08-30",
    today: "2026-08-28",
  });
  assert.equal(filter.includes("due_time.is.null"), false);
  assert.match(filter, /due_date\.is\.null/);
  assert.match(filter, /and\(due_date\.is\.null,status\.neq\.done\)/);
  assert.equal(
    filter,
    "and(due_date.gte.2026-08-24,due_date.lte.2026-08-30)," +
      "and(due_date.lt.2026-08-28,status.neq.done)," +
      "and(due_date.is.null,status.neq.done)",
  );
});

test("custom range still excludes unbounded untimed and done-undated", () => {
  const filter = buildTaskDueDateOrFilter({
    rangeStart: "2026-08-24",
    rangeEnd: "2026-08-30",
    today: "2026-08-28",
    customStart: "2026-08-01",
    customEnd: "2026-08-31",
  });
  assert.match(filter, /due_date\.gte\.2026-08-01/);
  assert.match(filter, /due_date\.lte\.2026-08-31/);
  assert.equal(filter.includes("due_time.is.null"), false);
});

test("taskAppearsOnTimeGrid requires date, time, in-range, and not overdue", () => {
  const range = {
    start: startOfDay(new Date("2026-08-24")),
    end: startOfDay(new Date("2026-08-30")),
  };
  const today = startOfDay(new Date("2026-08-24"));

  assert.equal(
    taskAppearsOnTimeGrid(
      { due_date: "2026-08-25", due_time: "10:00:00", status: "open" },
      range,
      today,
    ),
    true,
  );
  assert.equal(
    taskAppearsOnTimeGrid(
      { due_date: "2026-08-25", due_time: null, status: "open" },
      range,
      today,
    ),
    false,
  );
  assert.equal(
    taskAppearsOnTimeGrid(
      { due_date: "2026-09-01", due_time: "10:00:00", status: "open" },
      range,
      today,
    ),
    false,
  );
});

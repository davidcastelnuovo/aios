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
  assert.match(filter, /due_time\.is\.null/);
  assert.match(filter, /due_date\.not\.is\.null/);
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

import assert from "node:assert/strict";
import test from "node:test";
import { startOfDay } from "date-fns";
import {
  buildTaskDueDateOrFilter,
  taskAppearsOnTimeGrid,
} from "./taskBoardQuery.ts";

test("buildTaskDueDateOrFilter includes target_date overdue and dated untimed branches", () => {
  const filter = buildTaskDueDateOrFilter({
    rangeStart: "2026-08-24",
    rangeEnd: "2026-08-30",
    today: "2026-08-24",
  });
  assert.match(filter, /target_date\.lt/);
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

import assert from "node:assert/strict";
import test from "node:test";
import { getTaskDeadlineDate, isTaskOverdue } from "./taskDeadline.ts";

test("deadline prefers target_date over due_date", () => {
  assert.equal(
    getTaskDeadlineDate({ target_date: "2026-08-30", due_date: "2026-08-24" }),
    "2026-08-30",
  );
  assert.equal(getTaskDeadlineDate({ due_date: "2026-08-24" }), "2026-08-24");
});

test("overdue uses target_date when set", () => {
  const today = new Date("2026-08-25T12:00:00");
  assert.equal(
    isTaskOverdue(
      { target_date: "2026-08-24", due_date: "2026-08-30", status: "open" },
      today,
    ),
    true,
  );
  assert.equal(
    isTaskOverdue(
      { target_date: "2026-08-30", due_date: "2026-08-24", status: "open" },
      today,
    ),
    false,
  );
});

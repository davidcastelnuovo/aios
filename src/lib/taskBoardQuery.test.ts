import assert from "node:assert/strict";
import test from "node:test";
import { startOfDay } from "date-fns";
import {
  buildChatTaskOrFilter,
  buildTaskDueDateOrFilter,
  filterTasksForChatSearch,
  sortTasksForChatList,
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

test("buildChatTaskOrFilter pulls all open work plus recently done", () => {
  const filter = buildChatTaskOrFilter({
    today: "2026-09-17",
    doneSince: "2026-09-03",
  });
  assert.equal(filter, "status.neq.done,and(status.eq.done,updated_at.gte.2026-09-03)");
  assert.equal(filter.includes("due_date.gte"), false);
});

test("buildChatTaskOrFilter custom range still keeps unscheduled open tasks", () => {
  const filter = buildChatTaskOrFilter({
    today: "2026-09-17",
    doneSince: "2026-09-03",
    customStart: "2026-09-01",
    customEnd: "2026-09-30",
  });
  assert.equal(
    filter,
    "and(due_date.gte.2026-09-01,due_date.lte.2026-09-30)," +
      "and(due_date.is.null,status.neq.done)",
  );
});

test("filterTasksForChatSearch matches title, client, and campaigner", () => {
  const tasks = [
    { title: "לסגור קמפיין", notes: null, clients: { name: "דלתא" }, campaigners: { full_name: "נועה" } },
    { title: "שיחה", notes: "לקוח ויזה", clients: { name: "אחר" }, campaigners: { full_name: "דוד" } },
  ];
  assert.equal(filterTasksForChatSearch(tasks, "קמפיין").length, 1);
  assert.equal(filterTasksForChatSearch(tasks, "דלתא")[0].title, "לסגור קמפיין");
  assert.equal(filterTasksForChatSearch(tasks, "דוד")[0].title, "שיחה");
  assert.equal(filterTasksForChatSearch(tasks, "   ").length, 2);
});

test("sortTasksForChatList puts overdue and high priority first", () => {
  const today = startOfDay(new Date("2026-09-17"));
  const sorted = sortTasksForChatList(
    [
      { id: "done", status: "done", priority: 10, due_date: "2026-09-16", created_at: "2026-09-01" },
      { id: "open-low", status: "open", priority: 2, due_date: "2026-09-20", created_at: "2026-09-01" },
      { id: "overdue", status: "open", priority: 3, due_date: "2026-09-10", created_at: "2026-09-01" },
      { id: "progress", status: "in_progress", priority: 5, due_date: "2026-09-18", created_at: "2026-09-01" },
      { id: "open-high", status: "open", priority: 9, due_date: "2026-09-21", created_at: "2026-09-01" },
    ],
    today,
  ).map((task) => task.id);
  assert.deepEqual(sorted, ["overdue", "progress", "open-high", "open-low", "done"]);
});

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractHumanTaskId, isCursorAssignee } from "./cursor-task-queue.ts";

Deno.test("isCursorAssignee matches Cursor variants", () => {
  assertEquals(isCursorAssignee("Cursor"), true);
  assertEquals(isCursorAssignee("cursor cloud"), true);
  assertEquals(isCursorAssignee("כרמן"), false);
});

Deno.test("extractHumanTaskId parses context line", () => {
  assertEquals(
    extractHumanTaskId("human_task_id: 05576b93-0e1b-4db6-b6de-705097875eec\nnotes"),
    "05576b93-0e1b-4db6-b6de-705097875eec",
  );
});

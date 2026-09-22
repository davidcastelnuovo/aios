import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractDevTaskId,
  extractPrUrlFromAgentReply,
  matchDispatchRowToDevTask,
  matchSessionRowToDevTask,
} from "./dev-tasks.ts";

Deno.test("extractDevTaskId parses context line", () => {
  assertEquals(
    extractDevTaskId("dev_task_id: 1371fdd5-93ef-42b3-80af-99307e48096f\nBase branch: develop"),
    "1371fdd5-93ef-42b3-80af-99307e48096f",
  );
});

Deno.test("matchDispatchRowToDevTask prefers dev_task_id in context", () => {
  const taskId = "1371fdd5-93ef-42b3-80af-99307e48096f";
  assertEquals(
    matchDispatchRowToDevTask(
      {
        cursor_agent_id: "bc-abc",
        context: `dev_task_id: ${taskId}`,
        request_text: "Other title",
      },
      taskId,
      "Fix dispatch error",
    ),
    true,
  );
  assertEquals(
    matchDispatchRowToDevTask(
      {
        cursor_agent_id: "bc-abc",
        context: "dev_task_id: 00000000-0000-0000-0000-000000000001",
        request_text: "Fix dispatch error",
      },
      taskId,
      "Fix dispatch error",
    ),
    false,
  );
});

Deno.test("matchDispatchRowToDevTask falls back to request_text title", () => {
  const taskId = "1371fdd5-93ef-42b3-80af-99307e48096f";
  assertEquals(
    matchDispatchRowToDevTask(
      { cursor_agent_id: "bc-xyz", context: "", request_text: "Fix dispatch error" },
      taskId,
      "Fix dispatch error",
    ),
    true,
  );
});

Deno.test("extractPrUrlFromAgentReply finds GitHub PR link", () => {
  assertEquals(
    extractPrUrlFromAgentReply("PR: https://github.com/davidcastelnuovo/aios/pull/709"),
    "https://github.com/davidcastelnuovo/aios/pull/709",
  );
});

Deno.test("matchSessionRowToDevTask matches display name and linked dev_task", () => {
  const taskId = "1371fdd5-93ef-42b3-80af-99307e48096f";
  assertEquals(
    matchSessionRowToDevTask(
      {
        cursor_agent_id: "bc-s1",
        display_name: "AIOS · Fix dispatch error",
        dev_task_id: null,
      },
      taskId,
      "Fix dispatch error",
    ),
    true,
  );
  assertEquals(
    matchSessionRowToDevTask(
      { cursor_agent_id: "bc-s2", dev_task_id: taskId },
      taskId,
      "Any title",
    ),
    true,
  );
  assertEquals(
    matchSessionRowToDevTask(
      { cursor_agent_id: "bc-s3", dev_task_id: "00000000-0000-0000-0000-000000000002" },
      taskId,
      "Fix dispatch error",
    ),
    false,
  );
});

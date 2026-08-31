import assert from "node:assert/strict";
import test from "node:test";
import {
  cursorSessionDisplayName,
  formatCursorSessionsForAgent,
  type CursorTaskSessionRow,
} from "./cursor-session-tracker.ts";

test("cursorSessionDisplayName prefers task title", () => {
  assert.equal(
    cursorSessionDisplayName({ taskTitle: "Fix pulse bug", sourceTool: "request_dev_task" }),
    "AIOS · Fix pulse bug",
  );
  assert.equal(
    cursorSessionDisplayName({ requestText: "Research WA triggers", sourceTool: "ask_cursor" }),
    "AIOS · Research WA triggers",
  );
});

test("formatCursorSessionsForAgent lists sessions for Carmen", () => {
  const rows: CursorTaskSessionRow[] = [{
    id: "1",
    tenant_id: "t1",
    cursor_agent_id: "bc-abc",
    session_url: "https://cursor.com/agents/bc-abc",
    display_name: "AIOS · Fix pulse",
    human_task_id: "task-1",
    task_title: "Fix pulse",
    source_tool: "request_dev_task",
    app_env: "staging",
    status: "running",
    created_at: "2026-08-30T00:00:00Z",
    updated_at: "2026-08-30T00:00:00Z",
    last_seen_at: "2026-08-30T00:00:00Z",
  }];
  const text = formatCursorSessionsForAgent(rows);
  assert.match(text, /bc-abc/);
  assert.match(text, /Fix pulse/);
  assert.match(text, /task=task-1/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyDirectTool, directToolPool } from "./carmen-direct-tools.mjs";

test("agent spawning, dev escalation and self-approval are blocked", () => {
  for (const n of ["delegate_to_subagent", "dispatch_dev_task", "mcp_Claude__ask_claude", "mcp_Cursor__request_dev_task", "execute_pending_approval", ""]) {
    assert.equal(classifyDirectTool(n), "blocked", n);
  }
});

test("external sends and deletions need approval; reads and tasks run directly", () => {
  assert.equal(classifyDirectTool("send_message"), "approval");
  assert.equal(classifyDirectTool("delete_task"), "approval");
  assert.equal(classifyDirectTool("create_task"), "direct");
  assert.equal(classifyDirectTool("list_clients"), "direct");
  // Already queued inside Carmen — no second gate.
  assert.equal(classifyDirectTool("fb_pause"), "direct");
});

test("pool honours allow/deny lists and hides the system graph from non-managers", () => {
  const all = ["list_clients", "query_system_graph", "delegate_to_subagent", "delete_lead"].map((name) => ({ name }));
  assert.deepEqual(directToolPool(all).map((t) => t.name), ["list_clients", "delete_lead"]);
  assert.deepEqual(directToolPool(all, { isManager: true, disabledTools: ["delete_lead"] }).map((t) => t.name), ["list_clients", "query_system_graph"]);
  assert.deepEqual(directToolPool(all, { allowedTools: ["delete_lead"] }).map((t) => t.name), ["delete_lead"]);
});

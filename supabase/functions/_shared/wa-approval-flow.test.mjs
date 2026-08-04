import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApprovalFlowAcceptanceCases,
  buildNoPendingRecovery,
  formatApprovalExecutionReply,
  isExplicitApprovalPhrase,
  isExplicitRejectionPhrase,
  isMetaApprovalTool,
  pickLatestPendingApproval,
} from "./wa-approval-flow.mjs";

const cases = buildApprovalFlowAcceptanceCases();

test("WhatsApp approval phrases are detected", () => {
  for (const p of cases.approve) {
    assert.equal(isExplicitApprovalPhrase(p), true, `should approve: ${p}`);
  }
  // Voice-marker prefix + trailing punctuation
  assert.equal(isExplicitApprovalPhrase("🎤 כן"), true);
  assert.equal(isExplicitApprovalPhrase("כן מאשר!"), true);
  assert.equal(isExplicitApprovalPhrase("כן, תעשי את זה"), true);
});

test("non-approval and reject phrases", () => {
  for (const p of cases.reject) {
    assert.equal(isExplicitRejectionPhrase(p), true, `should reject: ${p}`);
    assert.equal(isExplicitApprovalPhrase(p), false, `reject is not approve: ${p}`);
  }
  for (const p of cases.notApproval) {
    assert.equal(isExplicitApprovalPhrase(p), false, `should not approve: ${p}`);
  }
});

test("repeated confirmations still count as approval", () => {
  assert.equal(isExplicitApprovalPhrase("כן"), true);
  assert.equal(isExplicitApprovalPhrase("כן מאשר"), true);
  assert.equal(isExplicitApprovalPhrase("מאשר"), true);
  assert.equal(isExplicitApprovalPhrase("כן מאשר"), true);
});

test("pickLatestPendingApproval prefers Meta tools", () => {
  const rows = [
    { id: "1", tool_name: "create_broadcast", created_at: "2026-08-04T06:00:00Z" },
    { id: "2", tool_name: "fb_duplicate_ad_variants", created_at: "2026-08-04T05:59:00Z" },
  ];
  // Newest-first list: broadcast is newer, but Meta should win when preferMeta.
  assert.equal(pickLatestPendingApproval(rows)?.id, "2");
  assert.equal(pickLatestPendingApproval(rows, { preferMeta: false })?.id, "1");
});

test("buildNoPendingRecovery returns recreate_once for last Meta row", () => {
  const recent = [
    {
      id: "a",
      status: "rejected",
      tool_name: "fb_duplicate_ad_variants",
      title: "שכפול ×4",
      tool_input: { client_id: "c1", source_ad_id: "ad1", variants: [{ primary_text: "x" }] },
    },
  ];
  const { recovery, instruction_for_carmen } = buildNoPendingRecovery(recent);
  assert.equal(recovery.mode, "recreate_once");
  assert.equal(recovery.tool_name, "fb_duplicate_ad_variants");
  assert.equal(recovery.tool_input.source_ad_id, "ad1");
  assert.match(instruction_for_carmen, /אישור סופי אחד/);
});

test("formatApprovalExecutionReply never claims success on failure", () => {
  const pending = { title: "שכפול מודעה" };
  assert.match(formatApprovalExecutionReply({ success: true }, pending), /בוצע/);
  assert.match(formatApprovalExecutionReply({ success: false, error: "no_pending_approval" }, pending), /לא הצלחתי/);
  assert.match(formatApprovalExecutionReply({ success: false, error: "no_pending_approval" }, pending), /לא בוצע/);
});

test("isMetaApprovalTool covers duplicate variants", () => {
  assert.equal(isMetaApprovalTool("fb_duplicate_ad_variants"), true);
  assert.equal(isMetaApprovalTool("list_clients"), false);
});

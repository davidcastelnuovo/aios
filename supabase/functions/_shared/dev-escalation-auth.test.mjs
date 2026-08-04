import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORIZED_DEV_REQUESTERS,
  DEV_ESCALATION_REFUSAL_HE,
  buildDevEscalationPromptRule,
  isAuthorizedDevRequester,
  isDevEscalationSkill,
  isDevEscalationTool,
  normalizePhoneSuffix,
} from "./dev-escalation-auth.mjs";

const DAVID_CAMPAIGNER = AUTHORIZED_DEV_REQUESTERS.campaigner_ids[0];
const DAVID_USER = AUTHORIZED_DEV_REQUESTERS.user_ids[0];

test("normalizePhoneSuffix handles IL formats", () => {
  assert.equal(normalizePhoneSuffix("0507677613"), "507677613");
  assert.equal(normalizePhoneSuffix("972507677613"), "507677613");
  assert.equal(normalizePhoneSuffix("+972-50-767-7613"), "507677613");
  assert.equal(normalizePhoneSuffix("123"), null);
});

test("only David identity is authorized", () => {
  assert.equal(isAuthorizedDevRequester({ campaignerId: DAVID_CAMPAIGNER }), true);
  assert.equal(isAuthorizedDevRequester({ userId: DAVID_USER }), true);
  assert.equal(isAuthorizedDevRequester({ phone: "972507677613" }), true);
  assert.equal(isAuthorizedDevRequester({ phone: "0507677613" }), true);

  assert.equal(isAuthorizedDevRequester({}), false);
  assert.equal(isAuthorizedDevRequester({ campaignerId: "00000000-0000-0000-0000-000000000001" }), false);
  assert.equal(isAuthorizedDevRequester({ userId: "00000000-0000-0000-0000-000000000001" }), false);
  assert.equal(isAuthorizedDevRequester({ phone: "0501111111" }), false);
  // Role alone is not enough — must match allowlisted identity.
  assert.equal(isAuthorizedDevRequester({ role: "super_admin" }), false);
});

test("isDevEscalationTool covers MCP + github agent", () => {
  assert.equal(isDevEscalationTool("mcp_Cursor__request_dev_task"), true);
  assert.equal(isDevEscalationTool("mcp_Claude__ask_claude"), true);
  assert.equal(isDevEscalationTool("mcp_Manus__request_dev_task"), true);
  assert.equal(isDevEscalationTool("delegate_to_github_agent"), true);
  assert.equal(isDevEscalationTool("request_dev_task"), true);

  assert.equal(isDevEscalationTool("list_clients"), false);
  assert.equal(isDevEscalationTool("toggle_facebook_campaign"), false);
  assert.equal(isDevEscalationTool("delegate_to_manus"), false);
  assert.equal(isDevEscalationTool("delegate_to_subagent"), false);
});

test("isDevEscalationSkill matches escalation skins", () => {
  assert.equal(isDevEscalationSkill("cursor_escalation"), true);
  assert.equal(isDevEscalationSkill("claude_escalation"), true);
  assert.equal(isDevEscalationSkill("facebook-campaign-analysis"), false);
});

test("refusal copy mentions David only", () => {
  assert.match(DEV_ESCALATION_REFUSAL_HE, /דיוויד/);
  assert.match(buildDevEscalationPromptRule(false), /חסום/);
  assert.match(buildDevEscalationPromptRule(true), /מורשה/);
});

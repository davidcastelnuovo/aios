import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORIZED_DEV_REQUESTERS,
  BUGFIX_DEV_REQUESTERS,
  DEV_ESCALATION_BUGFIX_ONLY_REFUSAL_HE,
  DEV_ESCALATION_REFUSAL_HE,
  buildDevEscalationPromptRule,
  getDevEscalationTier,
  isAuthorizedDevRequester,
  isBugfixEscalationSkill,
  isDevEscalationSkill,
  isDevEscalationTool,
  isDevEscalationToolAllowed,
  normalizePhoneSuffix,
} from "./dev-escalation-auth.mjs";

const DAVID_CAMPAIGNER = AUTHORIZED_DEV_REQUESTERS.campaigner_ids[0];
const DAVID_USER = AUTHORIZED_DEV_REQUESTERS.user_ids[0];
const ANA_CAMPAIGNER = BUGFIX_DEV_REQUESTERS.campaigner_ids[0];
const ANA_USER = BUGFIX_DEV_REQUESTERS.user_ids[0];

test("normalizePhoneSuffix handles IL formats", () => {
  assert.equal(normalizePhoneSuffix("0507677613"), "507677613");
  assert.equal(normalizePhoneSuffix("972507677613"), "507677613");
  assert.equal(normalizePhoneSuffix("+972-50-767-7613"), "507677613");
  assert.equal(normalizePhoneSuffix("972545612156"), "545612156");
  assert.equal(normalizePhoneSuffix("123"), null);
});

test("David gets full tier; Ana gets bugfix tier", () => {
  assert.equal(getDevEscalationTier({ campaignerId: DAVID_CAMPAIGNER }), "full");
  assert.equal(getDevEscalationTier({ userId: DAVID_USER }), "full");
  assert.equal(getDevEscalationTier({ phone: "972507677613" }), "full");

  assert.equal(getDevEscalationTier({ campaignerId: ANA_CAMPAIGNER }), "bugfix");
  assert.equal(getDevEscalationTier({ userId: ANA_USER }), "bugfix");
  assert.equal(getDevEscalationTier({ phone: "972545612156" }), "bugfix");

  assert.equal(getDevEscalationTier({}), null);
  assert.equal(getDevEscalationTier({ campaignerId: "00000000-0000-0000-0000-000000000001" }), null);
  assert.equal(getDevEscalationTier({ phone: "0501111111" }), null);
  assert.equal(getDevEscalationTier({ role: "super_admin" }), null);
});

test("isAuthorizedDevRequester true for David and Ana only", () => {
  assert.equal(isAuthorizedDevRequester({ campaignerId: DAVID_CAMPAIGNER }), true);
  assert.equal(isAuthorizedDevRequester({ campaignerId: ANA_CAMPAIGNER }), true);
  assert.equal(isAuthorizedDevRequester({ phone: "0501111111" }), false);
});

test("tool allowlist by tier", () => {
  assert.equal(isDevEscalationToolAllowed("mcp_Cursor__request_dev_task", "full"), true);
  assert.equal(isDevEscalationToolAllowed("mcp_Claude__ask_claude", "full"), true);
  assert.equal(isDevEscalationToolAllowed("delegate_to_github_agent", "full"), true);

  assert.equal(isDevEscalationToolAllowed("mcp_Cursor__request_dev_task", "bugfix"), true);
  assert.equal(isDevEscalationToolAllowed("mcp_Cursor__ask_cursor", "bugfix"), false);
  assert.equal(isDevEscalationToolAllowed("mcp_Claude__ask_claude", "bugfix"), false);
  assert.equal(isDevEscalationToolAllowed("delegate_to_github_agent", "bugfix"), false);
  assert.equal(isDevEscalationToolAllowed("list_clients", "bugfix"), false);
  assert.equal(isDevEscalationToolAllowed("mcp_Cursor__request_dev_task", null), false);
});

test("isDevEscalationTool covers MCP + github agent", () => {
  assert.equal(isDevEscalationTool("mcp_Cursor__request_dev_task"), true);
  assert.equal(isDevEscalationTool("mcp_Claude__ask_claude"), true);
  assert.equal(isDevEscalationTool("mcp_Manus__request_dev_task"), true);
  assert.equal(isDevEscalationTool("delegate_to_github_agent"), true);
  assert.equal(isDevEscalationTool("request_dev_task"), true);

  assert.equal(isDevEscalationTool("list_clients"), false);
  assert.equal(isDevEscalationTool("toggle_facebook_campaign"), false);
});

test("isDevEscalationSkill matches escalation skins", () => {
  assert.equal(isDevEscalationSkill("cursor_escalation"), true);
  assert.equal(isDevEscalationSkill("claude_escalation"), true);
  assert.equal(isDevEscalationSkill("facebook-campaign-analysis"), false);
  assert.equal(isBugfixEscalationSkill("bugfix_escalation_to_cursor"), true);
});

test("prompt rules differ by tier", () => {
  assert.match(buildDevEscalationPromptRule("full"), /דיוויד/);
  assert.match(buildDevEscalationPromptRule("bugfix"), /אנה/);
  assert.match(buildDevEscalationPromptRule("bugfix"), /request_dev_task/);
  assert.match(buildDevEscalationPromptRule(null), /חסום/);
  assert.match(DEV_ESCALATION_REFUSAL_HE, /דיוויד/);
  assert.match(DEV_ESCALATION_BUGFIX_ONLY_REFUSAL_HE, /באג/);
});

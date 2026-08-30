import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCloudAgentError,
  grokUsesExistingWebhook,
  isCursorSpendLimitError,
} from "./cloud-errors.ts";

test("Grok uses the existing webhook when both secrets exist", () => {
  assert.equal(grokUsesExistingWebhook("", "k"), false);
  assert.equal(grokUsesExistingWebhook("https://example", ""), false);
  assert.equal(grokUsesExistingWebhook("https://example", "k"), true);
});

test("spend-limit 400 becomes Hebrew, not a raw Cursor dump", () => {
  const msg = formatCloudAgentError(
    400,
    "Usage-based pricing required. Background Agent requires at least $2 remaining until your hard limit.",
  );
  assert.match(msg, /תקציב/);
  assert.match(msg, /cursor\.com\/dashboard/);
  assert.match(msg, /כרמן ישיר/);
  assert.equal(isCursorSpendLimitError(msg), true);
});

test("401 stays a key error", () => {
  assert.match(formatCloudAgentError(401, "Invalid User API Key"), /מפתח/);
});

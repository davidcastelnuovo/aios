import assert from "node:assert/strict";
import test from "node:test";
import { collectCarmenUiContext, formatUiContextForPrompt, moduleLabel } from "./carmenPageContext.ts";

test("collectCarmenUiContext extracts route params and module", () => {
  const ctx = collectCarmenUiContext({
    pathname: "/t/marketingcaptain/clients/abc-123",
    search: "?tab=overview",
    params: { tenantSlug: "marketingcaptain", clientId: "abc-123" },
    commandCenterView: "dashboard",
  });
  assert.equal(ctx.module, "clients");
  assert.equal(ctx.route_params.clientId, "abc-123");
  assert.equal(ctx.command_center_view, "dashboard");
});

test("formatUiContextForPrompt includes path and ids", () => {
  const text = formatUiContextForPrompt(
    collectCarmenUiContext({
      pathname: "/t/foo/tasks/task-1",
      params: { tenantSlug: "foo", taskId: "task-1" },
    }),
  );
  assert.match(text, /tasks\/task-1/);
  assert.match(text, /taskId=task-1/);
});

test("moduleLabel falls back to raw slug", () => {
  assert.equal(moduleLabel("clients"), "לקוחות");
  assert.equal(moduleLabel("custom-page"), "custom-page");
});

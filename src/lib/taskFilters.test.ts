import assert from "node:assert/strict";
import test from "node:test";
import { defaultTaskFilters, resolveDefaultCampaignerFilter } from "./taskFilters.ts";

test("the stored default stays on my own tasks for campaigners", () => {
  assert.equal(defaultTaskFilters.campaignerId, "mine");
});

test("owners and super admins open the team board", () => {
  assert.equal(resolveDefaultCampaignerFilter({ isOwner: true, hasPersonalQueue: true }), "all");
  assert.equal(resolveDefaultCampaignerFilter({ isSuperAdmin: true }), "all");
});

test("campaigners and sales people open their personal queue", () => {
  assert.equal(resolveDefaultCampaignerFilter({ hasPersonalQueue: true }), "mine");
});

test("users without a personal queue open the team board", () => {
  assert.equal(resolveDefaultCampaignerFilter({}), "all");
});

test("no other filter narrows the board on entry", () => {
  assert.equal(defaultTaskFilters.taskType, "all");
  assert.equal(defaultTaskFilters.association, "all");
  assert.equal(defaultTaskFilters.startDate, undefined);
  assert.equal(defaultTaskFilters.endDate, undefined);
});

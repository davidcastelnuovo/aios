import assert from "node:assert/strict";
import test from "node:test";
import { describeTaskAssignment } from "./taskAssignment.ts";

test("describes assignee, client, and who gave the task", () => {
  const labels = describeTaskAssignment({
    campaigners: { full_name: "נועה" },
    clients: { name: "דלתא" },
    creator_name: "דוד",
  });
  assert.equal(labels.assignedTo, "נועה");
  assert.equal(labels.client, "דלתא");
  assert.equal(labels.givenBy, "דוד");
});

test("uses the page client name when the task row has no nested client", () => {
  const labels = describeTaskAssignment(
    { campaigners: { full_name: "נועה" }, creator_name: "אנה" },
    "מרקטינג קפטן",
  );
  assert.equal(labels.client, "מרקטינג קפטן");
  assert.equal(labels.assignedTo, "נועה");
  assert.equal(labels.givenBy, "אנה");
});

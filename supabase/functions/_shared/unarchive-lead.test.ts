import assert from "node:assert/strict";
import test from "node:test";
import { unarchiveExistingLead } from "./unarchive-lead.ts";

test("unarchiveExistingLead restores archived rows and is a no-op otherwise", () => {
  const archived: Record<string, unknown> = { notes: "x" };
  assert.equal(unarchiveExistingLead({ archived_at: "2026-08-25T00:00:00Z" }, archived), true);
  assert.equal(archived.archived_at, null);
  assert.equal(archived.archived_by, null);

  const live: Record<string, unknown> = {};
  assert.equal(unarchiveExistingLead({ archived_at: null }, live), false);
  assert.equal(unarchiveExistingLead(null, live), false);
});

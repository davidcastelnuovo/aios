import assert from "node:assert/strict";
import test from "node:test";
import { buildMineAssignmentOrFilter, buildMineQueueOrFilter } from "./taskFilters.ts";

test("buildMineAssignmentOrFilter ORs every campaigner id and sales person", () => {
  const filter = buildMineAssignmentOrFilter({
    kind: "assigned",
    campaignerId: "c1",
    salesPersonId: "s1",
    userId: "user-1",
    campaignerIds: ["c1", "c2"],
  });
  assert.equal(filter, "campaigner_id.eq.c1,campaigner_id.eq.c2,sales_person_id.eq.s1");
});

test("buildMineAssignmentOrFilter returns null when no assignment keys", () => {
  assert.equal(
    buildMineAssignmentOrFilter({ kind: "none", userId: "user-1", campaignerIds: [] }),
    null,
  );
});

test("buildMineQueueOrFilter falls back to created_by when there is no staff row", () => {
  assert.equal(
    buildMineQueueOrFilter({ kind: "created_by", userId: "user-1", campaignerIds: [] }, "mine"),
    "created_by.eq.user-1",
  );
});

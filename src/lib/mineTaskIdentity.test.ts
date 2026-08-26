import assert from "node:assert/strict";
import test from "node:test";
import { buildMineAssignmentOrFilter } from "./taskFilters.ts";

test("buildMineAssignmentOrFilter ORs every campaigner id and sales person", () => {
  const filter = buildMineAssignmentOrFilter({
    kind: "assigned",
    campaignerId: "c1",
    salesPersonId: "s1",
    campaignerIds: ["c1", "c2"],
  });
  assert.equal(filter, "campaigner_id.eq.c1,campaigner_id.eq.c2,sales_person_id.eq.s1");
});

test("buildMineAssignmentOrFilter returns null when no assignment keys", () => {
  assert.equal(
    buildMineAssignmentOrFilter({ kind: "none", campaignerIds: [] }),
    null,
  );
});

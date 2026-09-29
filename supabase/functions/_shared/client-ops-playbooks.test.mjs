import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildProblemSummary, renderTemplate } from "./client-ops-playbooks.ts";

describe("client-ops-playbooks", () => {
  it("renderTemplate substitutes vars", () => {
    assert.equal(
      renderTemplate("{{client_name}}: {{problem_summary}}", {
        client_name: "Binat",
        problem_summary: "שאלה בקבוצה",
      }),
      "Binat: שאלה בקבוצה",
    );
  });

  it("buildProblemSummary is generic per signal kind", () => {
    const s = buildProblemSummary("comms.group_client_unanswered", { waiting_hours: 9 });
    assert.match(s, /9/);
    assert.doesNotMatch(s, /Binat/);
  });
});

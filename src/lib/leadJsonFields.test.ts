import assert from "node:assert/strict";
import test from "node:test";
import { getLeadJsonIntakeFields } from "./leadJsonFields.ts";

test("JSON intake fields include campaign_name and stay aligned with webhook keys", () => {
  const fields = getLeadJsonIntakeFields("promo");
  const keys = fields.map((f) => f.key);

  assert.ok(keys.includes("campaign_name"));
  assert.ok(keys.includes("tenant_slug"));
  assert.ok(keys.includes("company_name"));
  assert.ok(keys.includes("source"));
  assert.equal(fields.find((f) => f.key === "campaign_name")?.label, "קמפיין");
  assert.equal(fields.find((f) => f.key === "tenant_slug")?.exampleValue, "promo");
  assert.equal(fields.find((f) => f.key === "campaign_name")?.required, undefined);
  assert.equal(fields.find((f) => f.key === "agency_id")?.required, undefined);
  assert.equal(fields.find((f) => f.key === "tenant_slug")?.required, true);
});

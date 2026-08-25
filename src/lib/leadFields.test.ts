import assert from "node:assert/strict";
import test from "node:test";
import {
  autoDetectLeadImportField,
  inferLeadSource,
  leadSourceDisplay,
  looksLikeResponseStatusLabel,
  resolveResponseStatusKey,
  responseStatusSelectValue,
  unmatchedResponseStatusValue,
} from "./leadFields.ts";

const defaultStatuses = [
  { status_key: "no_answer_1", label: "אין מענה 1", color: "#fbbf24" },
  { status_key: "no_answer_2", label: "אין מענה 2", color: "#f97316" },
  { status_key: "in_progress", label: "בעבודה", color: "#3b82f6" },
  { status_key: "not_relevant", label: "לא רלוונטי", color: "#6b7280" },
];

test("inferLeadSource keeps known enums and maps Hebrew sources", () => {
  assert.equal(inferLeadSource("website"), "website");
  assert.equal(inferLeadSource("פייסבוק"), "paid_ads");
  assert.equal(inferLeadSource("הפניה של לקוח"), "referral");
  assert.equal(inferLeadSource("רימרקטינג קיץ 2026"), "other");
});

test("leadSourceDisplay prefers campaign_name over the source enum", () => {
  assert.equal(
    leadSourceDisplay({ campaign_name: "Promo Q3", source: "other" }),
    "Promo Q3",
  );
  assert.equal(leadSourceDisplay({ campaign_name: "  ", source: "website" }), "אתר");
  assert.equal(leadSourceDisplay({ source: "other" }), "אחר");
});

test("ללא מענה and אין מענה resolve to no_answer_1", () => {
  assert.equal(resolveResponseStatusKey("ללא מענה", defaultStatuses), "no_answer_1");
  assert.equal(resolveResponseStatusKey("לא ענה", defaultStatuses), "no_answer_1");
  assert.equal(resolveResponseStatusKey("אין מענה", defaultStatuses), "no_answer_1");
  assert.equal(resolveResponseStatusKey("אין מענה 2", defaultStatuses), "no_answer_2");
  assert.equal(resolveResponseStatusKey("no_answer_1", defaultStatuses), "no_answer_1");
  assert.equal(resolveResponseStatusKey("אין מענה 1", defaultStatuses), "no_answer_1");
});

test("response status select keeps unmatched raw values visible", () => {
  assert.equal(responseStatusSelectValue("ללא מענה", defaultStatuses), "no_answer_1");
  assert.equal(responseStatusSelectValue("custom_hot", defaultStatuses), "custom_hot");
  assert.equal(responseStatusSelectValue(null, defaultStatuses), "none");
});

test("status column named סטטוס remaps to response_status when values are secondary", () => {
  assert.equal(autoDetectLeadImportField("שם הקמפיין"), "campaign_name");
  assert.equal(autoDetectLeadImportField("סטטוס משני"), "response_status");
  assert.equal(
    autoDetectLeadImportField("סטטוס", ["ללא מענה", "ללא מענה", "אין מענה 2"]),
    "response_status",
  );
  assert.equal(
    autoDetectLeadImportField("סטטוס", ["חדש", "נסגר", "הצעה"]),
    "status",
  );
});

test("looksLikeResponseStatusLabel covers common Hebrew secondary statuses", () => {
  assert.equal(looksLikeResponseStatusLabel("ללא מענה"), true);
  assert.equal(looksLikeResponseStatusLabel("חדש"), false);
});

test("unmatchedResponseStatusValue only returns values that are not in the status list", () => {
  assert.equal(unmatchedResponseStatusValue("ללא מענה", defaultStatuses), null);
  assert.equal(unmatchedResponseStatusValue("custom_hot", defaultStatuses), "custom_hot");
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  autoDetectLeadImportField,
  classifyLeadImportStatus,
  inferLeadSource,
  leadOriginTagNames,
  leadSourceDisplay,
  looksLikePipelineStatusLabel,
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
  assert.equal(inferLeadSource("FB"), "paid_ads");
  assert.equal(inferLeadSource("הפניה של לקוח"), "referral");
  assert.equal(inferLeadSource("רימרקטינג קיץ 2026"), "other");
});

test("leadSourceDisplay shows the channel, not the campaign name", () => {
  assert.equal(
    leadSourceDisplay({ campaign_name: "שיווק", source: "paid_ads" }),
    "FB",
  );
  assert.equal(leadSourceDisplay({ campaign_name: "Promo Q3", source: "website" }), "אתר");
  assert.equal(leadSourceDisplay({ source: "other" }), "אחר");
  assert.equal(leadSourceDisplay({ source: "facebook" }), "FB");
});

test("leadOriginTagNames creates campaign and source tags without duplicating אחר", () => {
  assert.deepEqual(leadOriginTagNames({ campaign_name: "שיווק", source: "paid_ads" }), [
    "שיווק",
    "FB",
  ]);
  assert.deepEqual(leadOriginTagNames({ campaign_name: "  מכירות  ", source: "website" }), [
    "מכירות",
    "אתר",
  ]);
  assert.deepEqual(leadOriginTagNames({ campaign_name: "FB", source: "paid_ads" }), ["FB"]);
  assert.deepEqual(leadOriginTagNames({ campaign_name: "סושיאל", source: "other" }), ["סושיאל"]);
  assert.deepEqual(leadOriginTagNames({ campaign_name: "   ", source: "other" }), []);
  assert.deepEqual(leadOriginTagNames({ source: "referral" }), ["הפניה"]);
  assert.deepEqual(leadOriginTagNames(null), []);
});

test("ללא מענה and אין מענה resolve to no_answer_1", () => {
  assert.equal(resolveResponseStatusKey("ללא מענה", defaultStatuses), "no_answer_1");
  assert.equal(resolveResponseStatusKey("לא ענה", defaultStatuses), "no_answer_1");
  assert.equal(resolveResponseStatusKey("אין מענה", defaultStatuses), "no_answer_1");
  assert.equal(resolveResponseStatusKey("אין עמנה", defaultStatuses), "no_answer_1");
  assert.equal(resolveResponseStatusKey("אין מענה 2", defaultStatuses), "no_answer_2");
  assert.equal(resolveResponseStatusKey("no_answer_1", defaultStatuses), "no_answer_1");
  assert.equal(resolveResponseStatusKey("אין מענה 1", defaultStatuses), "no_answer_1");
});

test("typos of לא רלוונטי resolve to not_relevant", () => {
  assert.equal(resolveResponseStatusKey("לא רלוונטי", defaultStatuses), "not_relevant");
  assert.equal(resolveResponseStatusKey("לא לרוונטי", defaultStatuses), "not_relevant");
  assert.equal(resolveResponseStatusKey("לא רלווטני", defaultStatuses), "not_relevant");
});

test("response status select keeps unmatched raw values visible", () => {
  assert.equal(responseStatusSelectValue("ללא מענה", defaultStatuses), "no_answer_1");
  assert.equal(responseStatusSelectValue("custom_hot", defaultStatuses), "custom_hot");
  assert.equal(responseStatusSelectValue(null, defaultStatuses), "none");
});

test("status column named סטטוס remaps to response_status only when purely secondary", () => {
  assert.equal(autoDetectLeadImportField("שם הקמפיין"), "campaign_name");
  assert.equal(autoDetectLeadImportField("קמפיין"), "campaign_name");
  assert.equal(autoDetectLeadImportField("סטטוס משני"), "response_status");
  assert.equal(
    autoDetectLeadImportField("סטטוס", ["ללא מענה", "ללא מענה", "אין מענה 2"]),
    "response_status",
  );
  assert.equal(
    autoDetectLeadImportField("סטטוס", ["חדש", "נסגר", "הצעה"]),
    "status",
  );
  assert.equal(
    autoDetectLeadImportField("סטטוס", ["אין מענה", "נקבעה פגישה", "הצעת מחיר"]),
    "status",
  );
});

test("looksLikeResponseStatusLabel covers common Hebrew secondary statuses", () => {
  assert.equal(looksLikeResponseStatusLabel("ללא מענה"), true);
  assert.equal(looksLikeResponseStatusLabel("תפוס"), true);
  assert.equal(looksLikeResponseStatusLabel("חדש"), false);
  assert.equal(looksLikePipelineStatusLabel("נקבעה פגישה"), true);
  assert.equal(looksLikePipelineStatusLabel("אין מענה"), false);
});

test("classifyLeadImportStatus splits pipeline stages from secondary statuses", () => {
  assert.deepEqual(classifyLeadImportStatus("אין מענה", defaultStatuses), {
    pipelineStatus: null,
    responseStatus: "no_answer_1",
  });
  assert.deepEqual(classifyLeadImportStatus("נקבעה פגישה", defaultStatuses), {
    pipelineStatus: "meeting_scheduled",
    responseStatus: null,
  });
  assert.deepEqual(classifyLeadImportStatus("הצעת מחיר", defaultStatuses), {
    pipelineStatus: "proposal_sent",
    responseStatus: null,
  });
  assert.deepEqual(classifyLeadImportStatus("לא רלוונטי", defaultStatuses), {
    pipelineStatus: null,
    responseStatus: "not_relevant",
  });
  assert.deepEqual(classifyLeadImportStatus("ממתין להחלטה", defaultStatuses), {
    pipelineStatus: "negotiation",
    responseStatus: null,
  });
});

test("unmatchedResponseStatusValue only returns values that are not in the status list", () => {
  assert.equal(unmatchedResponseStatusValue("ללא מענה", defaultStatuses), null);
  assert.equal(unmatchedResponseStatusValue("custom_hot", defaultStatuses), "custom_hot");
});

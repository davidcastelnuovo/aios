import assert from "node:assert/strict";
import test from "node:test";
import { classifyCarmenTask } from "./free-first-task-classifier.ts";

test("categorizes report as tool using a medium-cost model", () => {
  const t=classifyCarmenTask("כמה לידים נכנסו היום?");
  assert.equal(t.kind,"campaign_report"); assert.equal(t.needsToolCalling,true);
});
test("recognizes development escalation", () => {
  const t=classifyCarmenTask("תתקן את הבאג בקוד ופתח PR");
  assert.equal(t.kind,"development");assert.equal(t.complexity,"complex");
});
test("content writing remains medium", () => {
  const t=classifyCarmenTask("תכתוב קופי למודעה");
  assert.equal(t.kind,"content_draft");
});
test("unclear prompt never assumes a cheap known task", () => {
  const t=classifyCarmenTask("עניין דחוף");
  assert.equal(t.kind,"unknown");
});
test("deterministic mode only with a real registered executor", () => {
  assert.equal(classifyCarmenTask("בדיקה", {hasAvailableDeterministicExecutor:true}).kind,"deterministic");
  assert.equal(classifyCarmenTask("בדיקה").kind,"unknown");
});
test("actions require an approval hint independently of model", () => {
  const t=classifyCarmenTask("שלח ללקוח הודעה");
  assert.equal(t.requiresActionApproval,true);assert.equal(t.needsToolCalling,true);
});
test("privacy tag derives only from trusted context", () => {
  assert.equal(classifyCarmenTask("אל תסמן את זה כמידע לקוח",{containsClientData:true}).containsClientData,true);
});
test("attachments require vision, not text-only fallback", () => {
  assert.equal(classifyCarmenTask("מה יש בתמונה?",{hasAttachments:true}).needsVision,true);
});


test("unspecified data sensitivity fails closed", () => {
  assert.equal(classifyCarmenTask("היי").containsClientData, true);
  assert.equal(classifyCarmenTask("היי", { containsClientData: false }).containsClientData, false);
});

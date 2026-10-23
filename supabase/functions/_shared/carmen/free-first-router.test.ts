import assert from "node:assert/strict";
import test from "node:test";
import { routeCarmenTask } from "./free-first-router.ts";
import type { ModelCandidate, RouterSettings } from "./free-first-types.ts";

const settings: RouterSettings = { mode: "free_first", allowAutomaticPremium: false, remainingPremiumBudgetUsd: 5 };
const models: ModelCandidate[] = [
  { id: "groq-free", provider: "groq", tier: "free", enabled: true, healthy: true, quotaAvailable: true, supportsTools: true, priority: 1 },
  { id: "backup-free", provider: "nvidia", tier: "free", enabled: true, healthy: true, quotaAvailable: true, supportsTools: true, priority: 2 },
  { id: "premium", provider: "openai", tier: "premium", enabled: true, healthy: true, quotaAvailable: true, supportsTools: true, supportsVision: true, approvedForClientData: true, estimatedCostUsd: 0.1 },
];
test("deterministic path uses no model", () => {
  assert.equal(routeCarmenTask({kind:"deterministic",deterministicAvailable:true},settings,models).status,"no_model_needed");
  assert.equal(routeCarmenTask({kind:"deterministic"},settings,models).modelId,"groq-free");
});
test("simple tasks prefer free with free fallback", () => {
  const d=routeCarmenTask({kind:"lead_triage"},settings,models);
  assert.equal(d.modelId,"groq-free");
  assert.deepEqual(d.fallbackIds,["backup-free"]);
});
test("complex task remains free under free_first", () => {
  assert.equal(routeCarmenTask({kind:"strategy",complexity:"complex"},settings,models).modelId,"groq-free");
});
test("premium override requires consent", () => {
  const d=routeCarmenTask({kind:"strategy"},{...settings,taskOverrides:{strategy:"premium"}},models);
  assert.equal(d.status,"approval_required");
  assert.equal(d.modelId,"premium");
});
test("automatic payment needs permission and budget", () => {
  const s:RouterSettings={...settings,allowAutomaticPremium:true,taskOverrides:{strategy:"premium"}};
  assert.equal(routeCarmenTask({kind:"strategy"},s,models).status,"ready");
  assert.equal(routeCarmenTask({kind:"strategy"},{...s,remainingPremiumBudgetUsd:0.01},models).status,"approval_required");
  assert.equal(routeCarmenTask({kind:"strategy"},s,models.map(m=>m.tier==="premium"?{...m,estimatedCostUsd:undefined}:m)).status,"approval_required");
});
test("private client data never goes to unapproved providers", () => {
  const d=routeCarmenTask({kind:"customer_reply",containsClientData:true},settings,models);
  assert.equal(d.modelId,"premium"); assert.equal(d.status,"approval_required");
});
test("tool and vision requirements are enforced", () => {
  assert.equal(routeCarmenTask({kind:"campaign_analysis",needsToolCalling:true,needsVision:true},settings,models).modelId,"premium");
});
test("quota exhaustion does not silently authorize spending", () => {
  const d=routeCarmenTask({kind:"lead_triage"},settings,models.map(m=>m.tier==="free"?{...m,quotaAvailable:false}:m));
  assert.equal(d.status,"approval_required");
});
test("failed quality check triggers escalation with budget", () => {
  const d=routeCarmenTask({kind:"content_draft",qualityFailures:2},{...settings,allowAutomaticPremium:true},models);
  assert.equal(d.modelId,"premium"); assert.equal(d.reason,"quality_escalation");
});
test("action approval remains independent of brain choice", () => {
  const d=routeCarmenTask({kind:"customer_reply",requiresActionApproval:true},settings,models);
  assert.equal(d.requiresActionApproval,true);
});
test("free_only never chooses paid fallback", () => {
  assert.equal(routeCarmenTask({kind:"lead_triage"},{...settings,taskOverrides:{lead_triage:"free_only"}},models.filter(m=>m.tier==="premium")).status,"unavailable");
});
test("premium override never silently downgrades", () => {
  assert.equal(routeCarmenTask({kind:"strategy"},{...settings,taskOverrides:{strategy:"premium"}},models.filter(m=>m.tier==="free")).status,"unavailable");
});
test("smart_auto can choose paid for complex tasks", () => {
  assert.equal(routeCarmenTask({kind:"campaign_analysis",complexity:"complex"},{...settings,mode:"smart_auto",allowAutomaticPremium:true},models).modelId,"premium");
});
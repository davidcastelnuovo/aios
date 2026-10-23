import assert from "node:assert/strict";
import test from "node:test";
import { planSafeFailover } from "./free-first-failover.ts";
import type { RoutingDecision } from "./free-first-types.ts";

const decision: RoutingDecision={
  status:"ready",reason:"free_first",modelId:"groq",
  tier:"free",fallbackIds:["nvidia","gemini"],requiresActionApproval:false,
};
test("quota error uses alternate model for pure LLM calls",()=>{
  assert.deepEqual(planSafeFailover(decision,"quota",{completedToolCalls:0,inferenceOnly:true,attemptedModelIds:["groq"]}),
    {kind:"retry_model",modelId:"nvidia",reason:"quota"});
});
test("an attempted fallback is skipped",()=>{
  assert.equal(planSafeFailover(decision,"rate_limit",{completedToolCalls:0,inferenceOnly:true,attemptedModelIds:["groq","nvidia"]}).kind,"retry_model");
});
test("no tool calls are replayed after side effects",()=>{
  assert.equal(planSafeFailover(decision,"timeout",{completedToolCalls:1,inferenceOnly:true,attemptedModelIds:["groq"]}).kind,"resume_from_checkpoint");
});
test("a tool error does not retry model",()=>{
  assert.equal(planSafeFailover(decision,"tool_execution",{completedToolCalls:0,inferenceOnly:true,attemptedModelIds:["groq"]}).kind,"stop");
});
test("authentication and invalid request never cascade",()=>{
  assert.equal(planSafeFailover(decision,"authentication",{completedToolCalls:0,inferenceOnly:true,attemptedModelIds:["groq"]}).kind,"stop");
  assert.equal(planSafeFailover(decision,"invalid_request",{completedToolCalls:0,inferenceOnly:true,attemptedModelIds:["groq"]}).kind,"stop");
});
test("approval-required decision cannot be bypassed via failover",()=>{
  assert.equal(planSafeFailover({...decision,status:"approval_required"},"quota",{completedToolCalls:0,inferenceOnly:true,attemptedModelIds:["groq"]}).kind,"stop");
});
test("retry budget caps repeated attempts",()=>{
  assert.equal(planSafeFailover(decision,"timeout",{completedToolCalls:0,inferenceOnly:true,attemptedModelIds:["groq","nvidia"],maxRetries:1}).kind,"stop");
});

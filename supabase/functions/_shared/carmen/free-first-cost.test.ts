import assert from "node:assert/strict";
import test from "node:test";
import { checkPremiumBudget, safeUsageEvent } from "./free-first-cost.ts";

const budget={approved:true,hardLimitUsd:10,committedUsd:2,spentUsd:7,estimatedNextCallUsd:0.5};
test("valid premium preflight accounts for committed money",()=>{
  assert.deepEqual(checkPremiumBudget(budget),{allowed:true,reason:"allowed",remainingUsd:1});
});
test("unapproved premium never runs even with funds",()=>{
  assert.equal(checkPremiumBudget({...budget,approved:false}).reason,"not_approved");
});
test("unknown price cannot be auto-authorized",()=>{
  assert.equal(checkPremiumBudget({...budget,estimatedNextCallUsd:null}).reason,"unknown_cost");
});
test("budget refuses NaN, negative amounts and overspending",()=>{
  assert.equal(checkPremiumBudget({...budget,spentUsd:NaN}).reason,"invalid_budget");
  assert.equal(checkPremiumBudget({...budget,estimatedNextCallUsd:-1}).reason,"unknown_cost");
  assert.equal(checkPremiumBudget({...budget,estimatedNextCallUsd:1.01}).reason,"budget_exceeded");
});
test("log schema only keeps safe token/cost metrics",()=>{
  const event=safeUsageEvent({tenantId:"tenant",requestId:"req",taskKind:"report",modelId:"free",provider:"groq",status:"success",reason:"free_first",inputTokens:100,outputTokens:-1,actualCostUsd:0});
  assert.equal(event.inputTokens,100);assert.equal(event.outputTokens,undefined);assert.equal(event.actualCostUsd,0);
});

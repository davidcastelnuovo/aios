import assert from "node:assert/strict";
import test from "node:test";
import {
  claimFacebookLeadAutomationRun,
  facebookFlowEventSource,
} from "./facebook-lead-dedup.ts";

test("facebookFlowEventSource is unique per automation", () => {
  assert.equal(
    facebookFlowEventSource("82858e4b-3daa-41ed-9b50-5045769b2115"),
    "fb-flow:82858e4b-3daa-41ed-9b50-5045769b2115",
  );
  assert.notEqual(
    facebookFlowEventSource("82858e4b-3daa-41ed-9b50-5045769b2115"),
    facebookFlowEventSource("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
  );
});

test("claimFacebookLeadAutomationRun treats unique violations as duplicates", async () => {
  const supabase = {
    from: () => ({
      insert: async () => ({ error: { code: "23505", message: "duplicate" } }),
    }),
  };
  const result = await claimFacebookLeadAutomationRun(supabase, {
    tenantId: "2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019",
    automationId: "82858e4b-3daa-41ed-9b50-5045769b2115",
    leadgenId: "874979795580881",
  });
  assert.equal(result.duplicate, true);
});

test("claimFacebookLeadAutomationRun skips empty leadgen ids", async () => {
  let called = false;
  const supabase = {
    from: () => {
      called = true;
      return { insert: async () => ({ error: null }) };
    },
  };
  const result = await claimFacebookLeadAutomationRun(supabase, {
    tenantId: "2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019",
    automationId: "82858e4b-3daa-41ed-9b50-5045769b2115",
    leadgenId: "  ",
  });
  assert.equal(result.duplicate, false);
  assert.equal(called, false);
});

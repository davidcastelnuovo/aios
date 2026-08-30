import assert from "node:assert/strict";
import test from "node:test";
import {
  claimFacebookLeadAutomationRun,
  claimFacebookLeadIntake,
  claimFacebookLeadWhatsAppSend,
  facebookFlowEventSource,
  facebookIntakeEventSource,
  facebookTriggerAutomationSucceeded,
  facebookWhatsAppSendSource,
  releaseFacebookLeadAutomationRun,
  releaseFacebookLeadWhatsAppSend,
} from "./facebook-lead-dedup.ts";

test("facebookIntakeEventSource is a single shared webhook/poll lock", () => {
  assert.equal(facebookIntakeEventSource(), "fb-intake");
});

test("claimFacebookLeadIntake treats unique violations as duplicates", async () => {
  const result = await claimFacebookLeadIntake({
    from: () => ({ insert: async () => ({ error: { code: "23505" } }) }),
  }, {
    tenantId: "2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019",
    leadgenId: "1614307953752490",
    formId: "2804363709904461",
  });
  assert.equal(result.duplicate, true);
  assert.equal(result.inserted, false);
});

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
  assert.equal(result.inserted, false);
});

test("claimFacebookLeadAutomationRun reports inserted on success", async () => {
  const supabase = {
    from: () => ({
      insert: async () => ({ error: null }),
    }),
  };
  const result = await claimFacebookLeadAutomationRun(supabase, {
    tenantId: "2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019",
    automationId: "82858e4b-3daa-41ed-9b50-5045769b2115",
    leadgenId: "874979795580881",
  });
  assert.equal(result.duplicate, false);
  assert.equal(result.inserted, true);
});

test("claimFacebookLeadAutomationRun treats 409 and unique-constraint text as duplicates", async () => {
  const byCode = await claimFacebookLeadAutomationRun({
    from: () => ({ insert: async () => ({ error: { code: "409", message: "Conflict" } }) }),
  }, {
    tenantId: "2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019",
    automationId: "82858e4b-3daa-41ed-9b50-5045769b2115",
    leadgenId: "874979795580881",
  });
  assert.equal(byCode.duplicate, true);

  const byText = await claimFacebookLeadAutomationRun({
    from: () => ({ insert: async () => ({ error: { message: "duplicate key value violates unique constraint" } }) }),
  }, {
    tenantId: "2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019",
    automationId: "82858e4b-3daa-41ed-9b50-5045769b2115",
    leadgenId: "874979795580881",
  });
  assert.equal(byText.duplicate, true);
});

test("facebookWhatsAppSendSource normalizes Israeli phone variants", () => {
  assert.equal(
    facebookWhatsAppSendSource("972546684466@c.us"),
    "fb-wa:972546684466@c.us",
  );
  assert.equal(
    facebookWhatsAppSendSource("972546684466"),
    facebookWhatsAppSendSource("0546684466"),
  );
  assert.equal(
    facebookWhatsAppSendSource("0546684466"),
    "fb-wa:972546684466@c.us",
  );
  assert.equal(
    facebookWhatsAppSendSource("120363123456789012@g.us"),
    "fb-wa:120363123456789012@g.us",
  );
});

test("claimFacebookLeadWhatsAppSend treats unique violations as duplicates", async () => {
  const result = await claimFacebookLeadWhatsAppSend({
    from: () => ({ insert: async () => ({ error: { code: "23505" } }) }),
  }, {
    tenantId: "2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019",
    chatId: "972546684466@c.us",
    leadgenId: "1756054335601891",
  });
  assert.equal(result.duplicate, true);
  assert.equal(result.inserted, false);
});

test("claimFacebookLeadWhatsAppSend reports inserted on success", async () => {
  const result = await claimFacebookLeadWhatsAppSend({
    from: () => ({ insert: async () => ({ error: null }) }),
  }, {
    tenantId: "2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019",
    chatId: "0546684466",
    leadgenId: "1756054335601891",
  });
  assert.equal(result.duplicate, false);
  assert.equal(result.inserted, true);
});

test("releaseFacebookLeadWhatsAppSend deletes the owned send receipt", async () => {
  const eqs: Array<[string, string]> = [];
  const supabase = {
    from: (table: string) => {
      assert.equal(table, "lead_notification_events");
      return {
        delete: () => ({
          eq: (column: string, value: string) => {
            eqs.push([column, value]);
            return {
              eq: (column2: string, value2: string) => {
                eqs.push([column2, value2]);
                return {
                  eq: async (column3: string, value3: string) => {
                    eqs.push([column3, value3]);
                    return { error: null };
                  },
                };
              },
            };
          },
        }),
      };
    },
  };
  await releaseFacebookLeadWhatsAppSend(supabase, {
    tenantId: "2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019",
    chatId: "0546684466",
    leadgenId: "1756054335601891",
  });
  assert.deepEqual(eqs, [
    ["tenant_id", "2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019"],
    ["source", "fb-wa:972546684466@c.us"],
    ["external_id", "1756054335601891"],
  ]);
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
  assert.equal(result.inserted, false);
  assert.equal(called, false);
});

test("releaseFacebookLeadAutomationRun deletes the owned claim row", async () => {
  const eqs: Array<[string, string]> = [];
  const supabase = {
    from: (table: string) => {
      assert.equal(table, "lead_notification_events");
      const chain = {
        delete: () => chain,
        eq: (column: string, value: string) => {
          eqs.push([column, value]);
          return chain;
        },
        then: undefined as undefined,
      };
      return {
        delete: () => ({
          eq: (column: string, value: string) => {
            eqs.push([column, value]);
            return {
              eq: (column2: string, value2: string) => {
                eqs.push([column2, value2]);
                return {
                  eq: async (column3: string, value3: string) => {
                    eqs.push([column3, value3]);
                    return { error: null };
                  },
                };
              },
            };
          },
        }),
      };
    },
  };
  await releaseFacebookLeadAutomationRun(supabase, {
    tenantId: "2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019",
    automationId: "82858e4b-3daa-41ed-9b50-5045769b2115",
    leadgenId: "874979795580881",
  });
  assert.deepEqual(eqs, [
    ["tenant_id", "2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019"],
    ["source", "fb-flow:82858e4b-3daa-41ed-9b50-5045769b2115"],
    ["external_id", "874979795580881"],
  ]);
});

test("facebookTriggerAutomationSucceeded requires a successful inner result", () => {
  assert.equal(facebookTriggerAutomationSucceeded(null), false);
  assert.equal(
    facebookTriggerAutomationSucceeded({
      success: true,
      results: [{ skipped: true, reason: "duplicate_facebook_leadgen" }],
    }),
    false,
  );
  assert.equal(
    facebookTriggerAutomationSucceeded({
      success: true,
      results: [{ success: false, error: "Green API timeout" }],
    }),
    false,
  );
  assert.equal(
    facebookTriggerAutomationSucceeded({
      success: true,
      results: [{ success: true, automation_id: "82858e4b-3daa-41ed-9b50-5045769b2115" }],
    }),
    true,
  );
});

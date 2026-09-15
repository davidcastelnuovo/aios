import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { processAutomationOnlyLeadWebhook } from "../_shared/automation-only-lead-webhook.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) return reply({ error: "server_not_configured" }, 503);

    const url = new URL(request.url);
    const automationId = url.searchParams.get("automation_id")?.trim() ?? "";
    const suppliedSecret = request.headers.get("x-webhook-secret")?.trim() ?? "";
    if (!automationId || !suppliedSecret) {
      return reply({ error: "automation_id_and_secret_required" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: automation } = await admin
      .from("automations")
      .select("id,tenant_id,active,is_flow")
      .eq("id", automationId)
      .eq("active", true)
      .eq("is_flow", true)
      .maybeSingle();
    if (!automation) return reply({ error: "automation_not_found" }, 404);

    const { data: triggerStep } = await admin
      .from("automation_flow_steps")
      .select("action_type,configuration")
      .eq("automation_id", automation.id)
      .eq("step_type", "trigger")
      .maybeSingle();
    const configuration = asRecord(triggerStep?.configuration);
    if (triggerStep?.action_type !== "inbound_webhook_lead") {
      return reply({ error: "invalid_webhook_secret" }, 403);
    }

    const body = asRecord(await request.json().catch(() => ({})));
    const payload = Object.keys(asRecord(body.data)).length ? asRecord(body.data) : body;

    const result = await processAutomationOnlyLeadWebhook(admin, supabaseUrl, serviceKey, {
      tenantId: automation.tenant_id,
      automationId: automation.id,
      triggerConfiguration: configuration,
      body,
      payload,
      source: "webhook",
      requireWebhookSecret: true,
      suppliedSecret,
    });

    return reply(result.body, result.status);
  } catch (error) {
    console.error("automation-lead-webhook error", error);
    return reply({ error: error instanceof Error ? error.message : "unknown_error" }, 500);
  }
});

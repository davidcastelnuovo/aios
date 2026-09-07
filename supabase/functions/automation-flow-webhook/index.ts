import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

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

const stringRecord = (value: unknown): Record<string, string> =>
  Object.fromEntries(
    Object.entries(asRecord(value))
      .filter(([, item]) => item != null && ["string", "number", "boolean"].includes(typeof item))
      .map(([key, item]) => [key, String(item)]),
  );

const digest = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

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
    const expectedSecret = String(configuration.webhook_secret ?? "");
    if (
      triggerStep?.action_type !== "inbound_webhook_task" ||
      !expectedSecret ||
      await digest(expectedSecret) !== await digest(suppliedSecret)
    ) {
      return reply({ error: "invalid_webhook_secret" }, 403);
    }

    const body = asRecord(await request.json().catch(() => ({})));
    const nested = asRecord(body.data);
    const payload = Object.keys(nested).length ? nested : body;
    const normalized = {
      ...stringRecord(payload),
      raw_payload: body,
    };

    const triggerResponse = await fetch(`${supabaseUrl}/functions/v1/trigger-automation`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        automationId: automation.id,
        tenant_id: automation.tenant_id,
        source: "flow_webhook",
        data: normalized,
      }),
    });

    const triggerResult = await triggerResponse.json().catch(() => ({}));
    if (!triggerResponse.ok || triggerResult?.error) {
      console.error("automation-flow-webhook trigger failed", triggerResult);
      return reply({ error: triggerResult?.error || "automation_trigger_failed" }, 502);
    }

    return reply({
      success: true,
      automation_id: automation.id,
      crm_record_created: false,
      trigger: triggerResult,
    });
  } catch (error) {
    console.error("automation-flow-webhook error", error);
    return reply({ error: error instanceof Error ? error.message : "unknown_error" }, 500);
  }
});

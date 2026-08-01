import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  buildLeadRoutingPayload,
  resolveLeadClient,
} from "../_shared/lead-routing.ts";

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

const fieldDataRecord = (body: Record<string, unknown>, payload: Record<string, unknown>) => {
  const explicit =
    body.form_data ??
    body.answers ??
    body.questions_and_answers ??
    payload.form_data ??
    payload.answers ??
    payload.questions_and_answers;
  const direct = stringRecord(explicit);
  if (Object.keys(direct).length) return direct;

  const fieldData = body.field_data ?? payload.field_data;
  if (Array.isArray(fieldData)) {
    return Object.fromEntries(
      fieldData
        .map((field) => asRecord(field))
        .map((field) => {
          const values = Array.isArray(field.values) ? field.values : [];
          return [String(field.name ?? ""), String(values[0] ?? field.value ?? "")] as const;
        })
        .filter(([key, value]) => key && value),
    );
  }

  // Generic webhook: every primitive payload key remains available to the
  // flow, and custom keys also become the Q&A block.
  return stringRecord(payload);
};

const firstString = (payload: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = payload[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
};

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
      triggerStep?.action_type !== "inbound_webhook_lead" ||
      !expectedSecret ||
      await digest(expectedSecret) !== await digest(suppliedSecret)
    ) {
      return reply({ error: "invalid_webhook_secret" }, 403);
    }

    const body = asRecord(await request.json().catch(() => ({})));
    const payload = Object.keys(asRecord(body.data)).length ? asRecord(body.data) : body;
    const formData = fieldDataRecord(body, payload);
    // A flow may lock to one client, or a trusted sender may route dynamically
    // by client_id using the same webhook/automation across the whole portfolio.
    const routedClient = await resolveLeadClient(
      admin,
      automation.tenant_id,
      configuration.client_id || payload.client_id,
    );
    const routing = buildLeadRoutingPayload(routedClient, formData);
    if (!routedClient) {
      // Make/Zapier scenarios often already know the destination client.
      // The per-flow secret makes these trusted fields safe to accept while
      // avoiding a UUID lookup table in every existing scenario.
      routing.client_name = firstString(payload, ["client_name", "recipient_name"]);
      routing.client_phone = firstString(payload, ["client_phone", "recipient_phone"]);
      routing.client_email = firstString(payload, ["client_email", "recipient_email"]);
    }
    const externalId = firstString(payload, ["external_id", "leadgen_id", "lead_id", "id"]);
    if (externalId) {
      const { error: receiptError } = await admin
        .from("lead_notification_events")
        .insert({
          tenant_id: automation.tenant_id,
          source: "webhook",
          external_id: externalId,
          client_id: routedClient?.client_id ?? null,
          form_id: firstString(payload, ["form_id", "facebook_form_id"]) || null,
        });
      if (receiptError?.code === "23505") {
        return reply({
          success: true,
          duplicate: true,
          skipped: "already_processed",
          crm_lead_created: false,
        });
      }
      if (receiptError) throw receiptError;
    }

    const normalized = {
      ...payload,
      contact_name: firstString(payload, ["lead_name", "contact_name", "full_name", "name"]),
      company_name: firstString(payload, ["lead_company", "company_name", "company"]),
      phone: firstString(payload, ["lead_phone", "phone", "phone_number", "mobile"]),
      email: firstString(payload, ["lead_email", "email", "email_address"]),
      source: firstString(payload, ["source"]) || "webhook",
      ...routing,
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
      console.error("automation-lead-webhook trigger failed", triggerResult);
      return reply({ error: triggerResult?.error || "automation_trigger_failed" }, 502);
    }

    return reply({
      success: true,
      automation_id: automation.id,
      client_id: routedClient?.client_id ?? null,
      crm_lead_created: false,
      trigger: triggerResult,
    });
  } catch (error) {
    console.error("automation-lead-webhook error", error);
    return reply({ error: error instanceof Error ? error.message : "unknown_error" }, 500);
  }
});

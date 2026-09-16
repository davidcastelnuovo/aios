import {
  buildLeadRoutingPayload,
  filterScreeningAnswers,
  firstLeadPayloadString,
  parseQaText,
  resolveLeadClient,
} from "./lead-routing.ts";

export type AutomationOnlyLeadResult = {
  status: number;
  body: Record<string, unknown>;
};

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

const coerceScreeningRecord = (value: unknown): Record<string, string> => {
  if (typeof value === "string" && value.trim()) return parseQaText(value);
  return filterScreeningAnswers(stringRecord(value));
};

export function fieldDataFromLeadWebhookBody(
  body: Record<string, unknown>,
  payload: Record<string, unknown>,
): Record<string, string> {
  for (const candidate of [
    body.form_data,
    body.answers,
    body.questions_and_answers,
    payload.form_data,
    payload.answers,
    payload.questions_and_answers,
  ]) {
    const parsed = coerceScreeningRecord(candidate);
    if (Object.keys(parsed).length) return parsed;
  }

  const fieldData = body.field_data ?? payload.field_data;
  if (Array.isArray(fieldData)) {
    return filterScreeningAnswers(Object.fromEntries(
      fieldData
        .map((field) => asRecord(field))
        .map((field) => {
          const values = Array.isArray(field.values) ? field.values : [];
          return [String(field.name ?? ""), String(values[0] ?? field.value ?? "")] as const;
        })
        .filter(([key, value]) => key && value),
    ));
  }

  return filterScreeningAnswers(stringRecord(payload));
}

const digest = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const phoneLast9 = (value: string | null | undefined): string =>
  String(value ?? "").replace(/\D/g, "").slice(-9);

const leadAlertContentKey = (parts: {
  clientPhone: string;
  leadName: string;
  leadPhone: string;
  leadEmail: string;
}) =>
  [
    phoneLast9(parts.clientPhone),
    String(parts.leadName ?? "").trim().toLowerCase(),
    phoneLast9(parts.leadPhone),
    String(parts.leadEmail ?? "").trim().toLowerCase(),
  ].join("|");

export async function resolveLeadAlertAutomation(
  supabase: any,
  tenantId: string,
  explicitAutomationId?: string | null,
  payloadClientId?: unknown,
): Promise<{ automationId: string; configuration: Record<string, unknown> } | null> {
  if (explicitAutomationId) {
    const { data: automation } = await supabase
      .from("automations")
      .select("id, active, is_flow, tenant_id")
      .eq("id", explicitAutomationId)
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .eq("is_flow", true)
      .maybeSingle();
    if (!automation) return null;

    const { data: triggerStep } = await supabase
      .from("automation_flow_steps")
      .select("action_type, configuration")
      .eq("automation_id", automation.id)
      .eq("step_type", "trigger")
      .maybeSingle();
    if (triggerStep?.action_type !== "inbound_webhook_lead") return null;

    return {
      automationId: automation.id,
      configuration: asRecord(triggerStep.configuration),
    };
  }

  const { data: triggerSteps } = await supabase
    .from("automation_flow_steps")
    .select("automation_id, configuration, automations!inner(id, active, is_flow, tenant_id)")
    .eq("step_type", "trigger")
    .eq("action_type", "inbound_webhook_lead")
    .eq("automations.tenant_id", tenantId)
    .eq("automations.active", true)
    .eq("automations.is_flow", true);

  const steps = triggerSteps ?? [];
  if (!steps.length) return null;

  const payloadClient = typeof payloadClientId === "string" ? payloadClientId : "";
  if (payloadClient) {
    const matched = steps.find((step: any) => asRecord(step.configuration).client_id === payloadClient);
    if (matched) {
      return {
        automationId: matched.automation_id,
        configuration: asRecord(matched.configuration),
      };
    }
  }

  const generic = steps.find((step: any) => !asRecord(step.configuration).client_id);
  if (generic) {
    return {
      automationId: generic.automation_id,
      configuration: asRecord(generic.configuration),
    };
  }

  if (steps.length === 1) {
    return {
      automationId: steps[0].automation_id,
      configuration: asRecord(steps[0].configuration),
    };
  }

  return null;
}

export async function processAutomationOnlyLeadWebhook(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  options: {
    tenantId: string;
    automationId: string;
    triggerConfiguration: Record<string, unknown>;
    body: Record<string, unknown>;
    payload: Record<string, unknown>;
    source?: string;
    requireWebhookSecret?: boolean;
    suppliedSecret?: string | null;
  },
): Promise<AutomationOnlyLeadResult> {
  const {
    tenantId,
    automationId,
    triggerConfiguration,
    body,
    payload,
    source = "webhook",
    requireWebhookSecret = false,
    suppliedSecret = null,
  } = options;

  const expectedSecret = String(triggerConfiguration.webhook_secret ?? "");
  if (requireWebhookSecret) {
    if (!expectedSecret || !suppliedSecret) {
      return { status: 403, body: { error: "invalid_webhook_secret" } };
    }
    if (await digest(expectedSecret) !== await digest(suppliedSecret)) {
      return { status: 403, body: { error: "invalid_webhook_secret" } };
    }
  }

  const formData = fieldDataFromLeadWebhookBody(body, payload);
  const routedClient = await resolveLeadClient(
    supabase,
    tenantId,
    triggerConfiguration.client_id || payload.client_id,
  );
  const routing = buildLeadRoutingPayload(routedClient, formData);
  const payloadClientPhone = firstLeadPayloadString(payload, ["client_phone", "recipient_phone"]);
  if (payloadClientPhone) routing.client_phone = payloadClientPhone;
  if (!routedClient) {
    routing.client_name = firstLeadPayloadString(payload, ["client_name", "recipient_name"]);
    routing.client_email = firstLeadPayloadString(payload, ["client_email", "recipient_email"]);
  }

  const normalizedLeadName = firstLeadPayloadString(payload, ["lead_name", "contact_name", "full_name", "name"]);
  const normalizedLeadPhone = firstLeadPayloadString(payload, ["lead_phone", "phone", "phone_number", "mobile"]);
  const normalizedLeadEmail = firstLeadPayloadString(payload, ["lead_email", "email", "email_address"]);
  const contentKey = leadAlertContentKey({
    clientPhone: payloadClientPhone || routing.client_phone || "",
    leadName: normalizedLeadName,
    leadPhone: normalizedLeadPhone,
    leadEmail: normalizedLeadEmail,
  });
  const contentLockKey = `leadalert:${tenantId}:${contentKey}`;

  const externalId = firstLeadPayloadString(payload, ["external_id", "leadgen_id", "lead_id", "id"]);
  const dedupeExternalId = externalId || `fp:${(await digest(contentKey)).slice(0, 40)}`;

  const { data: contentLockAcquired, error: contentLockError } = await supabase.rpc(
    "try_acquire_manychat_destination_lock",
    { p_destination_key: contentLockKey, p_ttl_seconds: 90 },
  );
  if (!contentLockError && contentLockAcquired === false) {
    return {
      status: 200,
      body: {
        success: true,
        duplicate: true,
        skipped: "recent_identical_lead",
        crm_lead_created: false,
      },
    };
  }

  const recentCutoff = new Date(Date.now() - 90_000).toISOString();
  const { data: recentRuns } = await supabase
    .from("automation_logs")
    .select("payload")
    .eq("automation_id", automationId)
    .eq("success", true)
    .gte("triggered_at", recentCutoff)
    .order("triggered_at", { ascending: false })
    .limit(15);
  const recentIdenticalRun = (recentRuns || []).some((row: any) => {
    const p = asRecord(row.payload);
    return leadAlertContentKey({
      clientPhone: String(p.client_phone ?? p.recipient_phone ?? ""),
      leadName: String(p.lead_name ?? p.contact_name ?? ""),
      leadPhone: String(p.lead_phone ?? p.phone ?? ""),
      leadEmail: String(p.lead_email ?? p.email ?? ""),
    }) === contentKey;
  });
  if (recentIdenticalRun) {
    return {
      status: 200,
      body: {
        success: true,
        duplicate: true,
        skipped: "recent_identical_lead",
        crm_lead_created: false,
      },
    };
  }

  {
    const { error: receiptError } = await supabase
      .from("lead_notification_events")
      .insert({
        tenant_id: tenantId,
        source,
        external_id: dedupeExternalId,
        client_id: routedClient?.client_id ?? null,
        form_id: firstLeadPayloadString(payload, ["form_id", "facebook_form_id"]) || null,
      });
    if (receiptError?.code === "23505") {
      return {
        status: 200,
        body: {
          success: true,
          duplicate: true,
          skipped: "already_processed",
          crm_lead_created: false,
        },
      };
    }
    if (receiptError) throw receiptError;
  }

  const normalized = {
    ...payload,
    contact_name: normalizedLeadName,
    company_name: firstLeadPayloadString(payload, ["lead_company", "company_name", "company"]),
    phone: normalizedLeadPhone,
    email: normalizedLeadEmail,
    lead_name: normalizedLeadName,
    lead_phone: normalizedLeadPhone,
    lead_email: normalizedLeadEmail,
    source: firstLeadPayloadString(payload, ["source"]) || source,
    crm_lead_created: false,
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
      automationId,
      tenant_id: tenantId,
      source: requireWebhookSecret ? "flow_webhook" : "lead_intake_redirect",
      data: normalized,
    }),
  });
  const triggerResult = await triggerResponse.json().catch(() => ({}));
  if (!triggerResponse.ok || triggerResult?.error) {
    console.error("automation-only lead webhook trigger failed", triggerResult);
    return {
      status: 502,
      body: { error: triggerResult?.error || "automation_trigger_failed", crm_lead_created: false },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      automation_id: automationId,
      client_id: routedClient?.client_id ?? null,
      crm_lead_created: false,
      trigger: triggerResult,
    },
  };
}

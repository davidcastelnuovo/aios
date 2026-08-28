// manus-notify — lets Manus (running autonomously) push a guaranteed
// WhatsApp update when it finishes a task, independent of Carmen's
// live session.
//
// Mirrors claude-notify — same recipient resolution (never cross-tenant
// owner fallback, never a group chat whose session row stores the
// recipient's phone as last speaker). Pulse/notify is always 1:1.
//
// Auth: Authorization: Bearer == MANUS_MCP_BEARER (same shared secret as manus-mcp).
//
// Body: { tenant_id, message, chat_id? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  normalizeNotifyPhone,
  pickNotifyDelivery,
  resolveCarmenNotifyTarget,
} from "../_shared/carmen-notify-target.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bearerFrom(req: Request): string | undefined {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  const m = h?.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : undefined;
}

async function sendViaActionStep(sb: any, args: {
  automationId: string;
  tenantId: string;
  connectionUserId: string;
  chatId: string;
  phoneNumber: string;
  isGroup: boolean;
  message: string;
}): Promise<boolean> {
  const { automationId, tenantId, connectionUserId, chatId, phoneNumber, isGroup, message } = args;

  const { data: steps } = await sb
    .from("automation_flow_steps")
    .select("action_type, configuration, created_at")
    .eq("automation_id", automationId)
    .eq("step_type", "action")
    .in("action_type", ["send_manus_message", "send_greenapi_message", "send_green_api_message"])
    .order("created_at", { ascending: true })
    .limit(1);

  const step = steps?.[0];
  if (!step) return false;

  const cfg = step.configuration || {};
  const integrationId = cfg.green_api_integration_id || cfg.integration_id || null;

  let groupId: string | null = null;
  if (isGroup && chatId) {
    const { data: g } = await sb
      .from("whatsapp_groups")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("group_chat_id", chatId)
      .maybeSingle();
    groupId = g?.id || null;
    if (!groupId) return false;
  }

  const fnName = step.action_type === "send_manus_message"
    ? "send-manus-wa-message"
    : "send-green-api-message";

  const body: any = { tenantId, senderUserId: connectionUserId, message };
  if (integrationId) body.integrationId = integrationId;
  if (groupId) body.groupId = groupId;
  else body.phoneNumber = phoneNumber;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("[manus-notify] send failed", res.status, (await res.text().catch(() => "")).slice(0, 300));
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const required = Deno.env.get("MANUS_MCP_BEARER");
  if (required && bearerFrom(req) !== required) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const tenantId = String(body?.tenant_id ?? "").trim();
  const message = String(body?.message ?? "").trim();
  const explicitChatId = body?.chat_id ? String(body.chat_id).trim() : null;

  if (!tenantId || !message) return json({ error: "tenant_id and message are required" }, 400);

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const [{ data: heartbeat }, { data: sessions }, { data: campaigners }] = await Promise.all([
    sb.from("tenant_heartbeat_settings")
      .select("campaign_pulse_phone")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    sb.from("carmen_whatsapp_sessions")
      .select("chat_id, phone, sender_name, connection_user_id, automation_id, last_message_at")
      .eq("tenant_id", tenantId)
      .neq("phone", "")
      .order("last_message_at", { ascending: false })
      .limit(40),
    sb.from("campaigners")
      .select("full_name, phone, role, active")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .limit(200),
  ]);

  const staff = (campaigners || [])
    .filter((c: any) => !!normalizeNotifyPhone(c.phone))
    .map((c: any) => ({
      phone: c.phone as string,
      full_name: c.full_name as string | null,
      role: Array.isArray(c.role) ? (c.role[0] ?? null) : (c.role ?? null),
    }));

  const target = resolveCarmenNotifyTarget({
    preferredPhone: explicitChatId,
    campaignPulsePhone: heartbeat?.campaign_pulse_phone ?? null,
    sessions: (sessions || []).map((s: any) => ({
      chat_id: s.chat_id,
      phone: s.phone,
      sender_name: s.sender_name,
      updated_at: s.last_message_at,
    })),
    staff,
  });

  if (target.source === "none" || !target.phone) {
    return json({
      ok: false,
      sent: false,
      reason: target.reason || "no resolvable Carmen WhatsApp recipient for this tenant",
      source: target.source,
    });
  }

  const delivery = pickNotifyDelivery(sessions || [], target);
  const bridgeSession = delivery.bridgeSession;

  if (!bridgeSession?.automation_id) {
    return json({
      ok: false,
      sent: false,
      reason: "no Carmen WhatsApp automation/session bridge for this tenant",
      source: target.source,
      chat_id: delivery.chatId,
    });
  }

  const sent = await sendViaActionStep(sb, {
    automationId: bridgeSession.automation_id,
    tenantId,
    connectionUserId: bridgeSession.connection_user_id || "",
    chatId: delivery.chatId,
    phoneNumber: delivery.phoneNumber,
    isGroup: false,
    message,
  });

  return json({
    ok: sent,
    sent,
    chat_id: delivery.chatId,
    phone: delivery.phoneNumber,
    contact_name: target.contactName,
    source: target.source,
  });
});

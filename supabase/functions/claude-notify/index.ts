// claude-notify — lets Claude (running in a routine session) push a guaranteed
// WhatsApp update to the human, independent of Carmen's live session.
//
// Carmen's normal reply path is async and loses the original chat context, so a
// "Claude finished your task" update could otherwise go undelivered. This
// endpoint resolves the correct recipient for the tenant (explicit chat_id /
// campaign_pulse_phone / tenant campaigner — never a cross-tenant owner who
// merely has the newest session) and sends through the same automation action
// step Carmen uses (send-manus-wa-message / send-green-api-message).
//
// Auth: Authorization: Bearer == CLAUDE_MCP_BEARER (same shared secret as
// claude-mcp). Typically called from Postgres via the claude_notify_david()
// SECURITY DEFINER function, so Claude never has to handle the secret directly.
//
// Body: { tenant_id, message, chat_id? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  normalizeNotifyPhone,
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

// Send a message through the automation's configured action step — the same
// mechanism Carmen uses for her own replies (kept in sync with
// _shared/carmen.ts → sendCarmenReplyViaActionStep).
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

  const fnName = step.action_type === "send_manus_message" ? "send-manus-wa-message" : "send-green-api-message";
  const body: any = { tenantId, senderUserId: connectionUserId, message };
  if (integrationId) body.integrationId = integrationId;
  if (groupId) body.groupId = groupId;
  else body.phoneNumber = phoneNumber;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("[claude-notify] send failed", res.status, (await res.text().catch(() => "")).slice(0, 300));
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const required = Deno.env.get("CLAUDE_MCP_BEARER");
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

  // Prefer the session matching the resolved phone (for automation + chat_id);
  // otherwise reuse any tenant session's automation wiring and send to the
  // resolved phone number.
  const matchedSession = (sessions || []).find((s: any) =>
    normalizeNotifyPhone(s.chat_id) === target.phone ||
    normalizeNotifyPhone(s.phone) === target.phone
  ) || null;
  const bridgeSession = matchedSession || (sessions || []).find((s: any) => s.automation_id) || null;

  if (!bridgeSession?.automation_id) {
    return json({
      ok: false,
      sent: false,
      reason: "no Carmen WhatsApp automation/session bridge for this tenant",
      source: target.source,
      chat_id: target.chatId,
    });
  }

  const chatId = matchedSession?.chat_id || target.chatId;
  const phoneNumber = normalizeNotifyPhone(matchedSession?.phone) || target.phone;
  const isGroup = String(chatId).endsWith("@g.us");
  const sent = await sendViaActionStep(sb, {
    automationId: bridgeSession.automation_id,
    tenantId,
    connectionUserId: bridgeSession.connection_user_id || "",
    chatId,
    phoneNumber,
    isGroup,
    message,
  });

  return json({
    ok: sent,
    sent,
    chat_id: chatId,
    phone: phoneNumber,
    contact_name: target.contactName,
    source: target.source,
  });
});

/**
 * Read-only monitoring of client WhatsApp groups on Green API (operator CRM).
 * Does NOT send messages and does NOT grant Carmen Manus group membership.
 * Source: clients.whatsapp_group_id → chat_messages (provider=green_api).
 */

import { phonesMatch } from "./carmen-group-sender.mjs";

export const GREEN_GROUP_REPLY_SLA_MS = 8 * 60 * 60 * 1000;
export const GREEN_GROUP_MIN_AGE_MS = 45 * 60 * 1000;

export type GroupMessageRow = {
  created_at: string;
  direction: string;
  message_text: string | null;
  sender_name?: string | null;
  sender_phone?: string | null;
  client_id?: string | null;
};

export type UnansweredItem = {
  message_at: string;
  sender_phone: string | null;
  sender_name: string | null;
  excerpt: string;
  waiting_hours: number;
  reason: string;
};

const QUESTION_RE =
  /[?؟]|(^|\s)(מה|מי|איך|מתי|למה|האם|אפשר|מישהו|אפשר ל|יש ל|לקבל|עדכון)/i;

export function isLikelyQuestion(text: string): boolean {
  const t = String(text || "").trim();
  if (!t || t.length < 4) return false;
  return QUESTION_RE.test(t);
}

export function isInboundDirection(direction: string): boolean {
  const d = String(direction || "").toLowerCase();
  return d === "inbound" || d === "incoming";
}

export function isOutboundDirection(direction: string): boolean {
  const d = String(direction || "").toLowerCase();
  return d === "outbound" || d === "outgoing";
}

export function isStaffSender(
  senderPhone: string | null | undefined,
  staffPhones: string[],
): boolean {
  const p = String(senderPhone || "").replace(/\D/g, "");
  if (!p) return false;
  return staffPhones.some((s) => phonesMatch(p, s));
}

/** Client-side inbound that looks like an unanswered question. */
export function findUnansweredClientQuestions(args: {
  messages: GroupMessageRow[];
  clientPhone: string | null;
  staffPhones: string[];
  nowMs?: number;
  slaMs?: number;
  minAgeMs?: number;
}): UnansweredItem[] {
  const now = args.nowMs ?? Date.now();
  const sla = args.slaMs ?? GREEN_GROUP_REPLY_SLA_MS;
  const minAge = args.minAgeMs ?? GREEN_GROUP_MIN_AGE_MS;
  const sorted = [...args.messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const unanswered: UnansweredItem[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    if (!isInboundDirection(m.direction)) continue;
    if (isStaffSender(m.sender_phone, args.staffPhones)) continue;

    const fromClient =
      (m.client_id && args.clientPhone) ||
      phonesMatch(m.sender_phone, args.clientPhone) ||
      (!args.clientPhone && !isStaffSender(m.sender_phone, args.staffPhones));

    if (!fromClient) continue;

    const text = String(m.message_text || "").trim();
    if (!isLikelyQuestion(text)) continue;

    const at = new Date(m.created_at).getTime();
    if (Number.isNaN(at)) continue;
    if (now - at < minAge) continue;

    let replied = false;
    for (let j = i + 1; j < sorted.length; j++) {
      const later = sorted[j];
      const lat = new Date(later.created_at).getTime();
      if (lat - at > sla) break;
      if (isOutboundDirection(later.direction)) {
        replied = true;
        break;
      }
    }

    if (!replied && now - at >= minAge) {
      unanswered.push({
        message_at: m.created_at,
        sender_phone: m.sender_phone ?? null,
        sender_name: m.sender_name ?? null,
        excerpt: text.slice(0, 280),
        waiting_hours: Math.round((now - at) / (60 * 60 * 1000) * 10) / 10,
        reason: "inbound_question_without_outbound_reply_in_sla",
      });
    }
  }

  return unanswered.slice(-5);
}

export async function loadStaffPhonesForClient(
  supabase: { from: (t: string) => any },
  args: { tenantId: string; clientId: string },
): Promise<string[]> {
  const phones: string[] = [];

  const { data: client } = await supabase
    .from("clients")
    .select("phone, contact_phone")
    .eq("id", args.clientId)
    .eq("tenant_id", args.tenantId)
    .maybeSingle();

  const { data: team } = await supabase
    .from("client_team")
    .select("campaigners(phone)")
    .eq("client_id", args.clientId);

  for (const row of team || []) {
    const c = (row as any).campaigners;
    if (c?.phone) phones.push(String(c.phone));
  }

  const { data: agents } = await supabase
    .from("ai_agents")
    .select("carmen_allowed_phones")
    .eq("tenant_id", args.tenantId)
    .limit(1);

  const allowed = agents?.[0]?.carmen_allowed_phones;
  if (Array.isArray(allowed)) {
    for (const p of allowed) phones.push(String(p));
  }

  return [...new Set(phones.map((p) => String(p).replace(/\D/g, "")).filter((p) => p.length >= 9))];
}

export async function fetchClientGreenApiGroupCommunications(
  supabase: { from: (t: string) => any },
  args: {
    tenantId: string;
    clientId: string;
    daysBack?: number;
    messageLimit?: number;
  },
): Promise<{
  linked: boolean;
  group_id: string | null;
  group_name: string | null;
  provider: "green_api";
  read_only: true;
  messages: Array<{
    when_israel: string;
    direction: string;
    from: string;
    text: string;
  }>;
  unanswered_client_questions: UnansweredItem[];
  staff_phones_loaded: number;
  note: string;
}> {
  const days = Math.min(args.daysBack ?? 7, 30);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const limit = Math.min(args.messageLimit ?? 40, 80);

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, phone, whatsapp_group_id")
    .eq("id", args.clientId)
    .eq("tenant_id", args.tenantId)
    .maybeSingle();

  if (!client?.whatsapp_group_id) {
    return {
      linked: false,
      group_id: null,
      group_name: null,
      provider: "green_api",
      read_only: true,
      messages: [],
      unanswered_client_questions: [],
      staff_phones_loaded: 0,
      note: "ללקוח אין whatsapp_group_id — אין קבוצת Green API משויכת ב-CRM.",
    };
  }

  const { data: group } = await supabase
    .from("whatsapp_groups")
    .select("id, group_name, group_chat_id")
    .eq("id", client.whatsapp_group_id)
    .eq("tenant_id", args.tenantId)
    .maybeSingle();

  if (!group) {
    return {
      linked: false,
      group_id: client.whatsapp_group_id,
      group_name: null,
      provider: "green_api",
      read_only: true,
      messages: [],
      unanswered_client_questions: [],
      staff_phones_loaded: 0,
      note: "whatsapp_group_id לא נמצא בטבלת הקבוצות.",
    };
  }

  const { data: rawMessages, error } = await supabase
    .from("chat_messages")
    .select("created_at, direction, message_text, sender_name, sender_phone, client_id, provider")
    .eq("tenant_id", args.tenantId)
    .eq("group_id", group.id)
    .eq("provider", "green_api")
    .gte("created_at", since)
    .not("message_text", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const staffPhones = await loadStaffPhonesForClient(supabase, {
    tenantId: args.tenantId,
    clientId: args.clientId,
  });

  const rows: GroupMessageRow[] = (rawMessages || []).map((m: any) => ({
    created_at: m.created_at,
    direction: m.direction,
    message_text: m.message_text,
    sender_name: m.sender_name,
    sender_phone: m.sender_phone,
    client_id: m.client_id,
  }));

  const unanswered = findUnansweredClientQuestions({
    messages: rows,
    clientPhone: client.phone,
    staffPhones,
  });

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" });

  return {
    linked: true,
    group_id: group.id,
    group_name: group.group_name,
    provider: "green_api",
    read_only: true,
    messages: rows.reverse().map((m) => ({
      when_israel: fmt(m.created_at),
      direction: m.direction,
      from: m.sender_name || m.sender_phone || "",
      text: String(m.message_text || "").slice(0, 500),
    })),
    unanswered_client_questions: unanswered,
    staff_phones_loaded: staffPhones.length,
    note:
      "קריאה בלבד מ-Green API (CRM). אסור לשלוח הודעות לקבוצה דרך כלי זה — רק לדווח לדוד/צוות. לא משנה הרשאות Manus.",
  };
}

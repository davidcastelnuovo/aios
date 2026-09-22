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

export type UnfulfilledCommitment = {
  message_at: string;
  sender_name: string | null;
  excerpt: string;
  suggested_task_title: string;
  reason: string;
};

export type MissingCardWeeklyUpdate = {
  message_at: string;
  sender_name: string | null;
  excerpt: string;
  group_message_length: number;
  reason: string;
};

export const COMMITMENT_FOLLOWUP_MS = 24 * 60 * 60 * 1000;
export const COMMITMENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const WEEKLY_CARD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const COMMITMENT_RE =
  /(אעדכן|נעדכן|אטפל|נטפל|אחזור|נחזור|אשלח|נשלח|נבצע|נעשה|אסגור|נסגור|עד מחר|עד יום|בימים הקרובים|היום א)/i;

const COMMITMENT_DONE_RE =
  /(בוצע|עודכן|טופל|הועבר|הושלם|השלמתי|שלחתי|עדכנתי|סגרתי|טיפלתי)/i;

const WEEKLY_UPDATE_RE =
  /(עדכון שבועי|סיכום שבוע|דוח שבוע|weekly update|מצב קמפיין|סיכום ביצועים)/i;

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

export function isLikelyWeeklyGroupUpdate(text: string, minLength = 100): boolean {
  const t = String(text || "").trim();
  if (t.length < minLength && !WEEKLY_UPDATE_RE.test(t)) return false;
  return WEEKLY_UPDATE_RE.test(t) || t.length >= Math.max(minLength, 180);
}

export function cardHasRecentWeeklyUpdate(
  cardUpdates: Array<{ update_type?: string | null; content?: string | null; created_at: string }>,
  sinceMs: number,
): boolean {
  for (const u of cardUpdates) {
    const at = new Date(u.created_at).getTime();
    if (Number.isNaN(at) || at < sinceMs) continue;
    if (u.update_type === "weekly_update") return true;
    const c = String(u.content || "").trim();
    if (c.length >= 80 && WEEKLY_UPDATE_RE.test(c)) return true;
  }
  return false;
}

export function findMissingCardWeeklyUpdates(args: {
  messages: GroupMessageRow[];
  staffPhones: string[];
  cardUpdates: Array<{ update_type?: string | null; content?: string | null; created_at: string }>;
  windowMs?: number;
  nowMs?: number;
}): MissingCardWeeklyUpdate[] {
  const now = args.nowMs ?? Date.now();
  const windowMs = args.windowMs ?? WEEKLY_CARD_WINDOW_MS;
  const sinceMs = now - windowMs;
  if (cardHasRecentWeeklyUpdate(args.cardUpdates, sinceMs)) return [];

  const missing: MissingCardWeeklyUpdate[] = [];
  for (const m of args.messages) {
    if (!isOutboundDirection(m.direction)) continue;
    if (!isStaffSender(m.sender_phone, args.staffPhones)) continue;
    const text = String(m.message_text || "").trim();
    if (!isLikelyWeeklyGroupUpdate(text)) continue;
    const at = new Date(m.created_at).getTime();
    if (Number.isNaN(at) || at < sinceMs) continue;
    missing.push({
      message_at: m.created_at,
      sender_name: m.sender_name ?? null,
      excerpt: text.slice(0, 320),
      group_message_length: text.length,
      reason: "weekly_like_outbound_in_group_without_matching_client_card_update",
    });
  }
  return missing.slice(-3);
}

export function findUnfulfilledStaffCommitments(args: {
  messages: GroupMessageRow[];
  staffPhones: string[];
  nowMs?: number;
  minAgeMs?: number;
  windowMs?: number;
}): UnfulfilledCommitment[] {
  const now = args.nowMs ?? Date.now();
  const minAge = args.minAgeMs ?? COMMITMENT_FOLLOWUP_MS;
  const windowMs = args.windowMs ?? COMMITMENT_WINDOW_MS;
  const sorted = [...args.messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const out: UnfulfilledCommitment[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    if (!isOutboundDirection(m.direction)) continue;
    if (!isStaffSender(m.sender_phone, args.staffPhones)) continue;
    const text = String(m.message_text || "").trim();
    if (!COMMITMENT_RE.test(text)) continue;

    const at = new Date(m.created_at).getTime();
    if (Number.isNaN(at) || now - at < minAge) continue;

    let fulfilled = false;
    for (let j = i + 1; j < sorted.length; j++) {
      const later = sorted[j];
      const lat = new Date(later.created_at).getTime();
      if (lat - at > windowMs) break;
      if (!isOutboundDirection(later.direction)) continue;
      if (!isStaffSender(later.sender_phone, args.staffPhones)) continue;
      const lt = String(later.message_text || "");
      if (COMMITMENT_DONE_RE.test(lt)) {
        fulfilled = true;
        break;
      }
    }

    if (!fulfilled) {
      const title = text.length > 60 ? `מעקב: ${text.slice(0, 57)}…` : `מעקב: ${text}`;
      out.push({
        message_at: m.created_at,
        sender_name: m.sender_name ?? null,
        excerpt: text.slice(0, 280),
        suggested_task_title: title.slice(0, 120),
        reason: "staff_commitment_without_done_followup_in_group",
      });
    }
  }

  return out.slice(-5);
}

export function pickWeeklyUpdateMessage(
  messages: GroupMessageRow[],
  staffPhones: string[],
  windowMs = WEEKLY_CARD_WINDOW_MS,
  nowMs?: number,
): GroupMessageRow | null {
  const now = nowMs ?? Date.now();
  const sinceMs = now - windowMs;
  let best: GroupMessageRow | null = null;
  let bestScore = 0;
  for (const m of messages) {
    if (!isOutboundDirection(m.direction)) continue;
    if (!isStaffSender(m.sender_phone, staffPhones)) continue;
    const text = String(m.message_text || "").trim();
    if (!isLikelyWeeklyGroupUpdate(text, 80)) continue;
    const at = new Date(m.created_at).getTime();
    if (Number.isNaN(at) || at < sinceMs) continue;
    const score = text.length + (WEEKLY_UPDATE_RE.test(text) ? 500 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
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
  unfulfilled_staff_commitments: UnfulfilledCommitment[];
  missing_card_weekly_updates: MissingCardWeeklyUpdate[];
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
      unfulfilled_staff_commitments: [],
      missing_card_weekly_updates: [],
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
      unfulfilled_staff_commitments: [],
      missing_card_weekly_updates: [],
      staff_phones_loaded: 0,
      note: "whatsapp_group_id לא נמצא בטבלת הקבוצות.",
    };
  }

  const { data: cardUpdates } = await supabase
    .from("client_updates")
    .select("update_type, content, created_at")
    .eq("client_id", args.clientId)
    .eq("tenant_id", args.tenantId)
    .gte("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(20);

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

  const cardRows = cardUpdates || [];
  const unfulfilled = findUnfulfilledStaffCommitments({ messages: rows, staffPhones });
  const missingWeekly = findMissingCardWeeklyUpdates({
    messages: rows,
    staffPhones,
    cardUpdates: cardRows,
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
    unfulfilled_staff_commitments: unfulfilled,
    missing_card_weekly_updates: missingWeekly,
    staff_phones_loaded: staffPhones.length,
    note:
      "קריאה בלבד מ-Green API (CRM). אסור לשלוח הודעות לקבוצה דרך כלי זה. אם חסר עדכון בכרטיס — sync_weekly_update_from_green_group; אם הובטחה פעולה ולא בוצעה — create_commitment_followup (משימה + עדכון).",
  };
}

export async function syncWeeklyUpdateFromGreenGroup(
  supabase: { from: (t: string) => any },
  args: {
    tenantId: string;
    clientId: string;
    messageAt?: string | null;
    dryRun?: boolean;
    actorUserId?: string | null;
  },
): Promise<Record<string, unknown>> {
  const comm = await fetchClientGreenApiGroupCommunications(supabase, {
    tenantId: args.tenantId,
    clientId: args.clientId,
    daysBack: 14,
    messageLimit: 80,
  });
  if (!comm.linked) return { ok: false, ...comm };

  const { data: rawMessages } = await supabase
    .from("chat_messages")
    .select("created_at, direction, message_text, sender_name, sender_phone, client_id")
    .eq("tenant_id", args.tenantId)
    .eq("group_id", comm.group_id)
    .eq("provider", "green_api")
    .order("created_at", { ascending: false })
    .limit(80);

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

  let picked: GroupMessageRow | null = null;
  if (args.messageAt) {
    picked = rows.find((r) => r.created_at === args.messageAt) || null;
  } else {
    picked = pickWeeklyUpdateMessage(rows, staffPhones);
  }

  if (!picked?.message_text) {
    return {
      ok: false,
      error: "no_weekly_candidate",
      missing_card_weekly_updates: comm.missing_card_weekly_updates,
    };
  }

  const content =
    `[מסונכרן מקבוצת WhatsApp — Green API · ${comm.group_name || "קבוצה"}]\n` +
    String(picked.message_text).trim();

  if (args.dryRun !== false) {
    return {
      ok: true,
      dry_run: true,
      message_at: picked.created_at,
      preview_content: content.slice(0, 2000),
      action: "call again with dry_run=false to write client_updates (weekly_update)",
    };
  }

  const { data, error } = await supabase
    .from("client_updates")
    .insert({
      client_id: args.clientId,
      tenant_id: args.tenantId,
      user_id: args.actorUserId ?? null,
      content,
      update_type: "weekly_update",
    })
    .select("id, created_at")
    .single();
  if (error) throw error;

  return { ok: true, dry_run: false, update_id: data.id, created_at: data.created_at, message_at: picked.created_at };
}

export async function createCommitmentFollowup(
  supabase: { from: (t: string) => any },
  args: {
    tenantId: string;
    clientId: string;
    messageAt: string;
    taskTitle?: string;
    actorUserId?: string | null;
  },
): Promise<Record<string, unknown>> {
  const comm = await fetchClientGreenApiGroupCommunications(supabase, {
    tenantId: args.tenantId,
    clientId: args.clientId,
    daysBack: 14,
  });

  const hit = comm.unfulfilled_staff_commitments.find((c) => c.message_at === args.messageAt)
    || comm.unfulfilled_staff_commitments[comm.unfulfilled_staff_commitments.length - 1];

  if (!hit) {
    return { ok: false, error: "commitment_not_found", message_at: args.messageAt };
  }

  const title = (args.taskTitle || hit.suggested_task_title).slice(0, 200);
  const notes =
    `הובטח בקבוצת WhatsApp (${hit.message_at}) ולא זוהה follow-up בקבוצה.\n` +
    `מקור: «${hit.excerpt.slice(0, 400)}»\n` +
    `נפתח אוטומטית ע\"י כרמן — Client Ops.`;

  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .insert({
      tenant_id: args.tenantId,
      client_id: args.clientId,
      title,
      notes,
      status: "open",
      priority: 7,
    })
    .select("id")
    .single();
  if (taskErr) throw taskErr;

  const { data: update, error: upErr } = await supabase
    .from("client_updates")
    .insert({
      client_id: args.clientId,
      tenant_id: args.tenantId,
      user_id: args.actorUserId ?? null,
      content:
        `[מעקב התחייבות בקבוצה]\n${notes}`,
      update_type: "note",
    })
    .select("id")
    .single();
  if (upErr) throw upErr;

  return { ok: true, task_id: task.id, client_update_id: update.id, commitment: hit };
}

import { supabase } from "@/integrations/supabase/client";

/** WhatsApp groups where Carmen's Manus WA bot is connected — not operator Green API mirror only. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_RE.test(value);
}

function collectAutomationGroupRefs(cfg: Record<string, unknown> | null | undefined): string[] {
  const refs: string[] = [];
  if (Array.isArray(cfg?.carmen_allowed_group_ids)) refs.push(...(cfg.carmen_allowed_group_ids as string[]));
  if (cfg?.carmen_allowed_group_id) refs.push(String(cfg.carmen_allowed_group_id));
  return refs.map(String).filter(Boolean);
}

async function resolveGroupRefsToIds(
  tenantId: string,
  refs: string[],
  into: Set<string>,
) {
  for (const ref of refs) {
    if (isUuid(ref)) into.add(ref);
  }
  const chatIds = refs.filter((r) => r.includes("@g.us"));
  if (chatIds.length === 0) return;
  const { data: groups, error } = await supabase
    .from("whatsapp_groups")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("group_chat_id", chatIds);
  if (error) throw error;
  for (const g of groups || []) into.add(String(g.id));
}

/** Groups whose chat history is exclusively Green API operator mirror traffic. */
export function findGreenApiMirrorOnlyGroupIds(
  groupIds: string[],
  messages: Array<{ group_id: string | null; provider: string | null; connection_user_id: string | null }>,
  greenUserIds: Set<string>,
  manusLinkedIds: Set<string>,
): Set<string> {
  const mirrorOnly = new Set<string>();
  if (groupIds.length === 0 || greenUserIds.size === 0) return mirrorOnly;

  for (const gid of groupIds) {
    if (manusLinkedIds.has(gid)) continue;
    const groupMsgs = messages.filter((m) => String(m.group_id) === gid);
    if (groupMsgs.length === 0) continue;
    if (groupMsgs.some((m) => m.provider === "manus_wa")) continue;
    const onlyGreenOperator = groupMsgs.every(
      (m) => m.provider === "green_api" && m.connection_user_id && greenUserIds.has(m.connection_user_id),
    );
    if (onlyGreenOperator) mirrorOnly.add(gid);
  }
  return mirrorOnly;
}

export async function fetchCarmenManusGroupIds(tenantId: string): Promise<Set<string>> {
  const ids = new Set<string>();

  const [
    { data: manusIntegrations, error: manusIntErr },
    { data: greenIntegrations, error: greenIntErr },
    { data: steps, error: stepsErr },
    { data: policies, error: policyErr },
    { data: clientGroupAccess, error: cgaErr },
    { data: clients, error: clientsErr },
  ] = await Promise.all([
    supabase
      .from("tenant_integrations")
      .select("id, user_id")
      .eq("tenant_id", tenantId)
      .eq("integration_type", "manus_wa")
      .eq("is_active", true),
    supabase
      .from("tenant_integrations")
      .select("id, user_id")
      .eq("tenant_id", tenantId)
      .in("integration_type", ["green_api", "greenapi"])
      .eq("is_active", true),
    supabase
      .from("automation_flow_steps")
      .select("configuration")
      .eq("tenant_id", tenantId)
      .eq("step_type", "trigger")
      .eq("action_type", "carmen_whatsapp_session"),
    supabase
      .from("carmen_access_policies" as any)
      .select("allowed_group_ids")
      .eq("tenant_id", tenantId),
    supabase
      .from("carmen_client_group_access" as any)
      .select("whatsapp_group_id")
      .eq("tenant_id", tenantId),
    supabase
      .from("clients")
      .select("whatsapp_group_id")
      .eq("tenant_id", tenantId)
      .not("whatsapp_group_id", "is", null),
  ]);

  if (manusIntErr) throw manusIntErr;
  if (greenIntErr) throw greenIntErr;
  if (stepsErr) throw stepsErr;
  if (policyErr) throw policyErr;
  if (cgaErr) throw cgaErr;
  if (clientsErr) throw clientsErr;

  const manusIntegrationIds = new Set((manusIntegrations || []).map((i) => i.id));
  const manusUserIds = [...new Set((manusIntegrations || []).map((i) => i.user_id).filter(Boolean))] as string[];
  const greenUserIds = new Set(
    (greenIntegrations || []).map((i) => i.user_id).filter(Boolean) as string[],
  );

  let openMemberMode = false;
  const configGroupRefs: string[] = [];

  for (const step of steps || []) {
    const cfg = ((step as { configuration?: Record<string, unknown> }).configuration) || {};
    const pinned = cfg.carmen_integration_id as string | undefined;
    const usesManus = !pinned || manusIntegrationIds.has(pinned);
    if (!usesManus) continue;
    if (cfg.carmen_open_member_groups === true) openMemberMode = true;
    configGroupRefs.push(...collectAutomationGroupRefs(cfg));
  }

  for (const p of policies || []) {
    for (const gid of (p as { allowed_group_ids?: string[] }).allowed_group_ids || []) {
      if (gid) ids.add(String(gid));
    }
  }
  for (const row of clientGroupAccess || []) {
    const gid = (row as { whatsapp_group_id?: string }).whatsapp_group_id;
    if (gid) ids.add(String(gid));
  }
  for (const c of clients || []) {
    const gid = (c as { whatsapp_group_id?: string }).whatsapp_group_id;
    if (gid) ids.add(String(gid));
  }

  await resolveGroupRefsToIds(tenantId, configGroupRefs, ids);

  const { data: manusMsgs, error: msgErr } = await supabase
    .from("chat_messages")
    .select("group_id")
    .eq("tenant_id", tenantId)
    .eq("provider", "manus_wa")
    .not("group_id", "is", null);
  if (msgErr) throw msgErr;
  for (const row of manusMsgs || []) {
    if (row.group_id) ids.add(String(row.group_id));
  }

  if (manusUserIds.length > 0) {
    const { data: manusConnMsgs, error: connErr } = await supabase
      .from("chat_messages")
      .select("group_id")
      .eq("tenant_id", tenantId)
      .in("connection_user_id", manusUserIds)
      .not("group_id", "is", null);
    if (connErr) throw connErr;
    for (const row of manusConnMsgs || []) {
      if (row.group_id) ids.add(String(row.group_id));
    }
  }

  const { data: sessions, error: sessErr } = await supabase
    .from("carmen_whatsapp_sessions")
    .select("chat_id")
    .eq("tenant_id", tenantId)
    .like("chat_id", "%@g.us");
  if (sessErr) throw sessErr;
  const sessionChatIds = [...new Set((sessions || []).map((s) => s.chat_id).filter(Boolean))] as string[];
  if (sessionChatIds.length > 0) {
    await resolveGroupRefsToIds(tenantId, sessionChatIds, ids);
  }

  if (openMemberMode) {
    const { data: allGroups, error: allErr } = await supabase
      .from("whatsapp_groups")
      .select("id")
      .eq("tenant_id", tenantId)
      .or("is_blocked.is.null,is_blocked.eq.false");
    if (allErr) throw allErr;
    const allIds = (allGroups || []).map((g) => String(g.id));
    if (allIds.length > 0) {
      const { data: groupMsgs, error: gmErr } = await supabase
        .from("chat_messages")
        .select("group_id, provider, connection_user_id")
        .eq("tenant_id", tenantId)
        .in("group_id", allIds)
        .not("group_id", "is", null);
      if (gmErr) throw gmErr;
      const mirrorOnly = findGreenApiMirrorOnlyGroupIds(
        allIds,
        groupMsgs || [],
        greenUserIds,
        ids,
      );
      for (const gid of allIds) {
        if (!mirrorOnly.has(gid)) ids.add(gid);
      }
    }
  }

  return ids;
}

export async function fetchCarmenManusGroups(tenantId: string) {
  const manusIds = await fetchCarmenManusGroupIds(tenantId);
  if (manusIds.size === 0) return [];

  const { data, error } = await supabase
    .from("whatsapp_groups")
    .select("id, group_name, group_chat_id, is_blocked")
    .eq("tenant_id", tenantId)
    .in("id", [...manusIds])
    .or("is_blocked.is.null,is_blocked.eq.false")
    .order("group_name");
  if (error) throw error;
  return data || [];
}

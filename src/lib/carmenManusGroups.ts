import { supabase } from "@/integrations/supabase/client";

/**
 * Groups Carmen can see in conversation-access UI.
 * STRICT Manus-only sources — never Green API operator phone groups.
 *
 * Sources:
 * 1. chat_messages.provider = manus_wa (Carmen bot traffic)
 * 2. carmen_whatsapp_sessions with @g.us (Carmen group sessions)
 * 3. Automation carmen_allowed_group_ids / carmen_allowed_group_id
 * 4. carmen_access_policies.allowed_group_ids
 *
 * Manus Gateway currently has no list-groups endpoint, so membership cannot
 * be synced proactively — only observed traffic / explicit allowlist.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_RE.test(value);
}

function isMissingRelation(err: { code?: string; message?: string } | null | undefined) {
  if (!err) return false;
  return err.code === "PGRST205" || err.code === "42P01" || /does not exist/i.test(err.message || "");
}

function collectAutomationGroupRefs(cfg: Record<string, unknown> | null | undefined): string[] {
  const refs: string[] = [];
  if (Array.isArray(cfg?.carmen_allowed_group_ids)) refs.push(...(cfg.carmen_allowed_group_ids as string[]));
  if (cfg?.carmen_allowed_group_id) refs.push(String(cfg.carmen_allowed_group_id));
  return refs.map(String).filter(Boolean);
}

async function resolveGroupRefsToIds(tenantId: string, refs: string[], into: Set<string>) {
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

export async function fetchCarmenManusGroupIds(tenantId: string): Promise<Set<string>> {
  const ids = new Set<string>();

  const [
    { data: manusIntegrations, error: manusIntErr },
    { data: steps, error: stepsErr },
    { data: policies, error: policyErr },
  ] = await Promise.all([
    supabase
      .from("tenant_integrations")
      .select("id, user_id")
      .eq("tenant_id", tenantId)
      .eq("integration_type", "manus_wa")
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
  ]);

  if (manusIntErr) throw manusIntErr;
  if (stepsErr) throw stepsErr;
  if (policyErr && !isMissingRelation(policyErr)) throw policyErr;

  const manusIntegrationIds = new Set((manusIntegrations || []).map((i) => i.id));
  const manusUserIds = [...new Set((manusIntegrations || []).map((i) => i.user_id).filter(Boolean))] as string[];

  const configGroupRefs: string[] = [];
  for (const step of steps || []) {
    const cfg = ((step as { configuration?: Record<string, unknown> }).configuration) || {};
    const pinned = cfg.carmen_integration_id as string | undefined;
    // Only automations pinned to Manus (or unpinned when Manus exists)
    if (pinned && !manusIntegrationIds.has(pinned)) continue;
    if (!pinned && manusIntegrationIds.size === 0) continue;
    configGroupRefs.push(...collectAutomationGroupRefs(cfg));
  }

  for (const p of policies || []) {
    for (const gid of (p as { allowed_group_ids?: string[] }).allowed_group_ids || []) {
      if (gid) ids.add(String(gid));
    }
  }
  await resolveGroupRefsToIds(tenantId, configGroupRefs, ids);

  // Manus WA message traffic only
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
      .select("group_id, provider")
      .eq("tenant_id", tenantId)
      .in("connection_user_id", manusUserIds)
      .not("group_id", "is", null);
    if (connErr) throw connErr;
    for (const row of manusConnMsgs || []) {
      // connection_user_id of Manus integration — keep even if provider was mis-tagged
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

/** True when tenant has an active Manus WA integration (own or we only check own). */
export async function tenantHasManusWa(tenantId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("tenant_integrations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("integration_type", "manus_wa")
    .eq("is_active", true)
    .limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

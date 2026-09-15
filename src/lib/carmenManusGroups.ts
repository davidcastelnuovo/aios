import { supabase } from "@/integrations/supabase/client";

/**
 * Groups Carmen can see in conversation-access UI.
 * Source of truth: Manus Gateway list-groups sync (actual bot membership).
 * Legacy fallback (pre-sync only): manus_wa message traffic — never Green API.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ManusGroupsSyncMeta = {
  synced_at?: string;
  group_chat_ids?: string[];
};

function isUuid(value: string) {
  return UUID_RE.test(value);
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

function collectSyncedChatIds(
  integrations: Array<{ settings?: Record<string, unknown> | null }>,
): { chatIds: string[]; hasSync: boolean } {
  const chatIds: string[] = [];
  let hasSync = false;
  for (const integ of integrations) {
    const sync = (integ.settings?.manus_groups_sync || {}) as ManusGroupsSyncMeta;
    if (sync.synced_at) hasSync = true;
    if (Array.isArray(sync.group_chat_ids)) {
      chatIds.push(...sync.group_chat_ids.map(String).filter(Boolean));
    }
  }
  return { chatIds: [...new Set(chatIds)], hasSync };
}

/** Fallback before first gateway sync: groups with confirmed manus_wa traffic only. */
async function fetchManusTrafficGroupIds(tenantId: string, into: Set<string>) {
  const { data: manusMsgs, error: msgErr } = await supabase
    .from("chat_messages")
    .select("group_id")
    .eq("tenant_id", tenantId)
    .eq("provider", "manus_wa")
    .not("group_id", "is", null);
  if (msgErr) throw msgErr;
  for (const row of manusMsgs || []) {
    if (row.group_id) into.add(String(row.group_id));
  }
}

export async function fetchCarmenManusGroupIds(tenantId: string): Promise<Set<string>> {
  const ids = new Set<string>();

  const { data: manusIntegrations, error: manusIntErr } = await supabase
    .from("tenant_integrations")
    .select("id, user_id, settings")
    .eq("tenant_id", tenantId)
    .eq("integration_type", "manus_wa")
    .eq("is_active", true);

  if (manusIntErr) throw manusIntErr;
  if (!manusIntegrations?.length) return ids;

  const { chatIds, hasSync } = collectSyncedChatIds(manusIntegrations);

  if (hasSync) {
    // Gateway sync is authoritative — only groups Carmen's Manus instance is in.
    if (chatIds.length > 0) {
      await resolveGroupRefsToIds(tenantId, chatIds, ids);
    }
    return ids;
  }

  // Pre-sync: only groups with manus_wa traffic (not Green / automation allowlist).
  await fetchManusTrafficGroupIds(tenantId, ids);
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

export type SyncManusGroupsResult = {
  success: boolean;
  syncedCount?: number;
  groups?: Array<{ groupId: string; groupChatId: string; name: string }>;
  error?: string;
};

/** Pull group membership from Manus Gateway and upsert whatsapp_groups. */
export async function syncCarmenManusGroups(tenantId: string): Promise<SyncManusGroupsResult> {
  const { data, error } = await supabase.functions.invoke("manus-wa-sync-groups", {
    body: { tenantId },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "סנכרון קבוצות נכשל");
  return data as SyncManusGroupsResult;
}

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

import { supabase } from "@/integrations/supabase/client";
import { collectSyncedCatalog, mergeSyncCatalogWithDb } from "./carmenManusGroupsSync.mjs";

/**
 * Groups Carmen can see in conversation-access UI.
 * Source of truth: Manus Gateway list-groups sync (actual bot membership).
 * Legacy fallback (pre-sync only): manus_wa message traffic — never Green API.
 */

type ManusGroupsSyncMeta = {
  synced_at?: string;
  group_chat_ids?: string[];
  groups?: Array<{ groupChatId: string; groupId: string; name: string }>;
  count?: number;
};

type WhatsappGroupRow = {
  id: string;
  group_name: string;
  group_chat_id: string;
  is_blocked: boolean | null;
};

async function fetchWhatsappGroupPages(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: WhatsappGroupRow[] | null; error: Error | null }>,
): Promise<WhatsappGroupRow[]> {
  const pageSize = 1000;
  const rows: WhatsappGroupRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

async function fetchGroupsByChatIds(tenantId: string, chatIds: string[]): Promise<Map<string, WhatsappGroupRow>> {
  const byChatId = new Map<string, WhatsappGroupRow>();
  if (chatIds.length === 0) return byChatId;

  const chunkSize = 200;
  for (let i = 0; i < chatIds.length; i += chunkSize) {
    const chunk = chatIds.slice(i, i + chunkSize);
    const rows = await fetchWhatsappGroupPages((from, to) =>
      supabase
        .from("whatsapp_groups")
        .select("id, group_name, group_chat_id, is_blocked")
        .eq("tenant_id", tenantId)
        .in("group_chat_id", chunk)
        .order("group_name")
        .range(from, to),
    );
    for (const row of rows) byChatId.set(row.group_chat_id, row);
  }
  return byChatId;
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

export type ManusGroupsSyncInfo = {
  syncedAt?: string;
  count?: number;
  hasSync: boolean;
};

export async function fetchManusGroupsSyncInfo(tenantId: string): Promise<ManusGroupsSyncInfo> {
  const { data } = await supabase
    .from("tenant_integrations")
    .select("settings")
    .eq("tenant_id", tenantId)
    .eq("integration_type", "manus_wa")
    .eq("is_active", true);
  let syncedAt: string | undefined;
  let count = 0;
  let hasSync = false;
  for (const row of data || []) {
    const sync = ((row as { settings?: Record<string, unknown> }).settings?.manus_groups_sync
      || {}) as ManusGroupsSyncMeta;
    if (sync.synced_at) {
      hasSync = true;
      if (!syncedAt || sync.synced_at > syncedAt) syncedAt = sync.synced_at;
      const catalogCount = Array.isArray(sync.groups) ? sync.groups.length : 0;
      const chatCount = sync.group_chat_ids?.length || 0;
      count = Math.max(count, catalogCount, chatCount, sync.count || 0);
    }
  }
  return { syncedAt, count, hasSync };
}

export async function fetchCarmenManusGroupIds(tenantId: string): Promise<Set<string>> {
  const groups = await fetchCarmenManusGroups(tenantId);
  return new Set(groups.map((g) => String(g.id)));
}

export async function fetchCarmenManusGroups(tenantId: string) {
  const { data: manusIntegrations, error: manusIntErr } = await supabase
    .from("tenant_integrations")
    .select("id, user_id, settings")
    .eq("tenant_id", tenantId)
    .eq("integration_type", "manus_wa")
    .eq("is_active", true);

  if (manusIntErr) throw manusIntErr;
  if (!manusIntegrations?.length) return [];

  const { entries, chatIds, hasSync } = collectSyncedCatalog(manusIntegrations);
  const notBlocked = "is_blocked.is.null,is_blocked.eq.false";

  if (hasSync && (entries.length > 0 || chatIds.length > 0)) {
    const dbByChatId = await fetchGroupsByChatIds(tenantId, chatIds);

    // Also include any rows already tagged from prior syncs (names may be fresher in DB).
    const taggedRows = await fetchWhatsappGroupPages((from, to) =>
      supabase
        .from("whatsapp_groups")
        .select("id, group_name, group_chat_id, is_blocked")
        .eq("tenant_id", tenantId)
        .eq("description", "manus_wa_sync")
        .or(notBlocked)
        .order("group_name")
        .range(from, to),
    );
    for (const row of taggedRows) dbByChatId.set(row.group_chat_id, row);

    return mergeSyncCatalogWithDb(entries, dbByChatId);
  }

  const ids = new Set<string>();
  await fetchManusTrafficGroupIds(tenantId, ids);
  if (ids.size === 0) return [];

  const { data, error } = await supabase
    .from("whatsapp_groups")
    .select("id, group_name, group_chat_id, is_blocked")
    .eq("tenant_id", tenantId)
    .in("id", [...ids])
    .or(notBlocked)
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

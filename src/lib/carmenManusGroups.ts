import { supabase } from "@/integrations/supabase/client";

/** WhatsApp groups where Carmen's Manus WA bot has traffic (not operator Green API mirror). */
export async function fetchCarmenManusGroupIds(tenantId: string): Promise<Set<string>> {
  const ids = new Set<string>();

  const { data: manusMsgs, error: msgErr } = await supabase
    .from("chat_messages")
    .select("group_id")
    .eq("tenant_id", tenantId)
    .eq("provider", "manus_wa")
    .not("group_id", "is", null);
  if (msgErr) throw msgErr;
  for (const row of manusMsgs || []) {
    if (row.group_id) ids.add(row.group_id);
  }

  const { data: sessions, error: sessErr } = await supabase
    .from("carmen_whatsapp_sessions")
    .select("chat_id")
    .eq("tenant_id", tenantId)
    .like("chat_id", "%@g.us");
  if (sessErr) throw sessErr;

  const chatIds = [...new Set((sessions || []).map((s) => s.chat_id).filter(Boolean))];
  if (chatIds.length > 0) {
    const { data: groups, error: grpErr } = await supabase
      .from("whatsapp_groups")
      .select("id")
      .eq("tenant_id", tenantId)
      .in("group_chat_id", chatIds);
    if (grpErr) throw grpErr;
    for (const g of groups || []) ids.add(g.id);
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

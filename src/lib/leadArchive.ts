import { supabase } from "@/integrations/supabase/client";

/** Hide archived rows from pipeline / dashboard / audience queries. */
export function excludeArchivedLeads<T extends { is: (column: string, value: null) => T }>(
  query: T,
): T {
  return query.is("archived_at", null);
}

export async function archiveLeads(leadIds: string[]): Promise<number> {
  if (leadIds.length === 0) return 0;
  const { data, error } = await supabase.rpc("archive_leads", { p_lead_ids: leadIds });
  if (error) throw error;
  return typeof data === "number" ? data : leadIds.length;
}

export async function restoreArchivedLeads(leadIds: string[]): Promise<number> {
  if (leadIds.length === 0) return 0;
  const { data, error } = await supabase.rpc("restore_archived_leads", { p_lead_ids: leadIds });
  if (error) throw error;
  return typeof data === "number" ? data : leadIds.length;
}

export async function permanentlyDeleteArchivedLeads(leadIds: string[]): Promise<number> {
  if (leadIds.length === 0) return 0;
  const { data, error } = await supabase.rpc("permanently_delete_archived_leads", {
    p_lead_ids: leadIds,
  });
  if (error) throw error;
  return typeof data === "number" ? data : leadIds.length;
}

export const PERMANENT_DELETE_PHRASE = "מחק לצמיתות";

import { supabase } from "@/integrations/supabase/client";

function isMissingTableError(message: string): boolean {
  return /recording_folders|PGRST205|42P01/i.test(message);
}

export async function fetchRecordingFolders(tenantId: string) {
  const { data, error } = await (supabase as any)
    .from("recording_folders")
    .select("id, name, icon, position")
    .eq("tenant_id", tenantId)
    .order("position")
    .order("name");

  if (error) {
    if (isMissingTableError(error.message)) return [];
    throw error;
  }

  return data || [];
}

import { supabase } from "@/integrations/supabase/client";

const RECORDINGS_FEED_SELECT_FULL =
  "*, clients!zoom_recordings_client_id_fkey(name), leads(company_name), agencies!zoom_recordings_agency_id_fkey(name)";

const RECORDINGS_FEED_SELECT_BASE =
  "*, clients!zoom_recordings_client_id_fkey(name), leads(company_name)";

function isMissingRelationError(message: string): boolean {
  return /relationship|could not find|schema cache|42703|PGRST200/i.test(message);
}

function isMissingTableError(message: string): boolean {
  return /recording_folders|PGRST205|42P01/i.test(message);
}

/** Load tenant recordings for the feed; falls back when optional embeds/columns are missing in prod. */
export async function fetchRecordingsFeed(tenantId: string) {
  let { data, error } = await supabase
    .from("zoom_recordings")
    .select(RECORDINGS_FEED_SELECT_FULL)
    .eq("tenant_id", tenantId)
    .order("start_time", { ascending: false, nullsFirst: false });

  if (error && isMissingRelationError(error.message)) {
    ({ data, error } = await supabase
      .from("zoom_recordings")
      .select(RECORDINGS_FEED_SELECT_BASE)
      .eq("tenant_id", tenantId)
      .order("start_time", { ascending: false, nullsFirst: false }));
  }

  if (error) throw error;
  return data || [];
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

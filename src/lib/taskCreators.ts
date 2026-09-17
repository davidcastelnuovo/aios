import { supabase } from "@/integrations/supabase/client";

export async function withTaskCreatorNames<T extends { created_by?: string | null }>(
  rows: T[],
): Promise<(T & { creator_name: string | null })[]> {
  const creatorIds = Array.from(
    new Set(rows.map((row) => row.created_by).filter((id): id is string => Boolean(id))),
  );
  if (creatorIds.length === 0) {
    return rows.map((row) => ({ ...row, creator_name: null }));
  }
  const { data: creators } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", creatorIds);
  const names = new Map((creators || []).map((creator) => [creator.id, creator.full_name]));
  return rows.map((row) => ({
    ...row,
    creator_name: row.created_by ? names.get(row.created_by) || null : null,
  }));
}

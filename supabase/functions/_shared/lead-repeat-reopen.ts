/** When an inbound lead matches an existing phone/email, reopen the card at the top. */

export type LeadOriginRow = {
  created_at?: string | null;
  first_created_at?: string | null;
  source?: string | null;
  first_source?: string | null;
};

export function applyRepeatInboundReopen(
  existing: LeadOriginRow,
  incoming: { source?: string | null },
  nowIso = new Date().toISOString(),
): Record<string, unknown> {
  const firstCreated = existing.first_created_at || existing.created_at || nowIso;
  const updates: Record<string, unknown> = {
    first_created_at: firstCreated,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const incomingSource = incoming.source?.trim() || null;
  const currentSource = existing.source || null;
  const originalSource = existing.first_source || currentSource;
  if (originalSource) updates.first_source = originalSource;
  if (incomingSource && incomingSource !== currentSource) {
    updates.source = incomingSource;
  }

  return updates;
}

/** Drop reopen/archive columns so a retry works before those migrations land. */
export function withoutNewLeadOriginColumns(
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...updates };
  delete next.first_created_at;
  delete next.first_source;
  delete next.created_at;
  delete next.archived_at;
  delete next.archived_by;
  return next;
}

export async function updateLeadWithRepeatReopen(
  supabase: { from: (table: string) => any },
  leadId: string,
  updates: Record<string, unknown>,
): Promise<{ error: { message?: string } | null }> {
  const { error } = await supabase.from("leads").update(updates).eq("id", leadId);
  if (!error) return { error: null };
  const msg = String(error.message || "");
  if (!/first_created_at|first_source|archived_at|archived_by/.test(msg)) {
    return { error };
  }
  const fallback = withoutNewLeadOriginColumns(updates);
  if (Object.keys(fallback).length === 0) return { error: null };
  const retry = await supabase.from("leads").update(fallback).eq("id", leadId);
  return { error: retry.error };
}

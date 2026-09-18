/** Resolving what a re-generated meeting summary should be attached to. */

export type SummaryTargetType = "client" | "lead" | "campaigner" | "agency";

export interface SummaryTargetRow {
  id: string;
  transcription?: string | null;
  client_id?: string | null;
  lead_id?: string | null;
  campaigner_ids?: string[] | null;
  agency_id?: string | null;
  summary_scope?: string | null;
}

export interface SummaryTarget {
  target_type: SummaryTargetType;
  target_id: string;
}

/**
 * Mirrors the association order used by the recording pipeline so a re-summarize
 * keeps the meeting attached where it already lives instead of reassigning it.
 */
export function resolveSummaryTarget(
  row: SummaryTargetRow,
  fallbackAgencyId?: string | null,
): SummaryTarget | null {
  const scope = row.summary_scope ?? null;
  const campaignerId = row.campaigner_ids?.find((id) => !!id) ?? null;

  if (scope === "client" && row.client_id) return { target_type: "client", target_id: row.client_id };
  if (scope === "lead" && row.lead_id) return { target_type: "lead", target_id: row.lead_id };
  if (scope === "campaigner" && campaignerId) {
    return { target_type: "campaigner", target_id: campaignerId };
  }
  if (scope === "agency" && row.agency_id) return { target_type: "agency", target_id: row.agency_id };

  if (row.client_id) return { target_type: "client", target_id: row.client_id };
  if (row.lead_id) return { target_type: "lead", target_id: row.lead_id };
  if (campaignerId) return { target_type: "campaigner", target_id: campaignerId };
  if (row.agency_id) return { target_type: "agency", target_id: row.agency_id };
  if (fallbackAgencyId) return { target_type: "agency", target_id: fallbackAgencyId };

  return null;
}

/** The longest transcript in a grouped meeting — Zoom splits one meeting across rows. */
export function pickTranscriptRow<T extends SummaryTargetRow>(rows: T[]): T | null {
  let best: T | null = null;
  let bestLength = 0;

  for (const row of rows) {
    const length = (row.transcription ?? "").trim().length;
    if (length > bestLength) {
      best = row;
      bestLength = length;
    }
  }

  return best;
}

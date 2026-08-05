/**
 * Helpers for the Pulse Check dashboard (דשבורד בדיקת דופק).
 * Maps deterministic campaign_pulse_snapshots into UI rows.
 */

export type PulseStatus = "healthy" | "warning" | "critical" | "no_data";

export type PulseSnapshotRow = {
  client_id: string;
  agency_id: string | null;
  status: PulseStatus;
  is_ecommerce: boolean | null;
  spend_7d: number | null;
  leads_7d: number | null;
  cpl_7d: number | null;
  cpl_change_pct: number | null;
  purchases_7d: number | null;
  revenue_7d: number | null;
  roas_7d: number | null;
  flags: string[] | null;
  data_fresh_through: string | null;
  calculated_at: string | null;
  last_meta_change_at: string | null;
  last_meta_change_type: string | null;
  last_meta_change_actor: string | null;
  last_meta_change_object: string | null;
  meta_change_availability: string | null;
};

export function pulseStatusToOverall(status: PulseStatus | null | undefined): "green" | "yellow" | "red" {
  if (status === "critical") return "red";
  if (status === "warning" || status === "no_data") return "yellow";
  if (status === "healthy") return "green";
  return "yellow";
}

export function pulseStatusLabel(status: PulseStatus | null | undefined): string {
  switch (status) {
    case "healthy":
      return "🟢 תקין";
    case "warning":
      return "🟡 תשומת לב";
    case "critical":
      return "🔴 קריטי";
    case "no_data":
      return "🟡 אין טבלת קמפיין מחוברת";
    default:
      return "🟡 ממתין לבדיקה";
  }
}

export function clientHasCampaignService(services: string[] | null | undefined): boolean {
  if (!Array.isArray(services)) return false;
  return services.includes("ppc_meta") || services.includes("ppc_google");
}

export function formatPulseMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `₪${Math.round(Number(value) * 100) / 100}`;
}

export function formatPulseOutcomes(row: Pick<PulseSnapshotRow, "is_ecommerce" | "leads_7d" | "purchases_7d">): string {
  if (row.is_ecommerce) {
    return row.purchases_7d === null || row.purchases_7d === undefined ? "—" : String(row.purchases_7d);
  }
  return row.leads_7d === null || row.leads_7d === undefined ? "—" : String(row.leads_7d);
}

export function formatPulseEfficiency(row: Pick<PulseSnapshotRow, "is_ecommerce" | "cpl_7d" | "roas_7d">): string {
  if (row.is_ecommerce) {
    return row.roas_7d === null || row.roas_7d === undefined ? "—" : `ROAS ${row.roas_7d}`;
  }
  return row.cpl_7d === null || row.cpl_7d === undefined ? "—" : `₪${row.cpl_7d}`;
}

export function formatPulseChange(cplChangePct: number | null | undefined): string {
  if (cplChangePct === null || cplChangePct === undefined) return "—";
  const sign = cplChangePct > 0 ? "+" : "";
  return `${sign}${cplChangePct}%`;
}

export function formatMetaChange(row: PulseSnapshotRow): string {
  if (row.last_meta_change_at) {
    const when = new Date(row.last_meta_change_at).toLocaleString("he-IL", {
      timeZone: "Asia/Jerusalem",
      dateStyle: "short",
      timeStyle: "short",
    });
    const type = row.last_meta_change_type || "שינוי";
    const object = row.last_meta_change_object ? ` (${row.last_meta_change_object})` : "";
    return `${when} — ${type}${object}`;
  }
  if (row.meta_change_availability === "no_campaign_change_in_30d") return "לא נמצא ב-30 יום";
  if (row.meta_change_availability === "not_applicable") return "—";
  return "לא זמין";
}

/** Build shareable authenticated pulse dashboard URL for a tenant + optional agency. */
export function buildPulseDashboardUrl(origin: string, tenantSlug: string, agencyId?: string | null): string {
  const base = `${origin.replace(/\/$/, "")}/${tenantSlug}/dmm-dashboard`;
  if (agencyId && agencyId !== "all") {
    return `${base}?agency=${encodeURIComponent(agencyId)}`;
  }
  return base;
}

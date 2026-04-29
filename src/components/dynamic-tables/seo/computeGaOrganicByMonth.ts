/**
 * Shared helper: derive monthly NON-PAID GA sessions from raw crm_records.
 * MUST stay in sync between the internal SeoDashboardView and the public
 * SharedTable so the SEO traffic chart shows identical numbers in both places.
 *
 * Priority:
 *   1. monthly_channel — full channel breakdown (preferred)
 *   2. daily_source — derived by month, excluding paid mediums
 *   3. monthly_organic — last fallback (organic only)
 */
export type GaRecord = { id?: string; data?: any } | { data?: any };

export interface GaOrganicMonth {
  month: string; // YYYY-MM
  sessions: number;
}

const isPaidChannel = (cg: string) => {
  const v = cg.toLowerCase();
  return v.startsWith("paid") || v === "cross-network" || v === "display" || v.includes("paid");
};

const isPaidMedium = (sm: string) => {
  const v = sm.toLowerCase();
  return /\b(cpc|ppc|paid|cpm|cpv|paidsearch|display)\b/.test(v);
};

export function computeGaOrganicByMonth(gaRecords: GaRecord[] | null | undefined): GaOrganicMonth[] {
  if (!gaRecords || gaRecords.length === 0) return [];

  // 1. monthly_channel
  const monthlyChannelRows = gaRecords.filter((r: any) => r.data?.report_type === "monthly_channel");
  if (monthlyChannelRows.length > 0) {
    const monthMap = new Map<string, number>();
    for (const r of monthlyChannelRows as any[]) {
      const cg = String(r.data?.channel_group || "");
      if (isPaidChannel(cg)) continue;
      const month = r.data?.month as string;
      if (!month) continue;
      const sessions = Number(r.data?.sessions) || 0;
      monthMap.set(month, (monthMap.get(month) || 0) + sessions);
    }
    if (monthMap.size > 0) {
      return Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, sessions]) => ({ month, sessions }));
    }
  }

  // 2. daily_source
  const dailySourceRows = gaRecords.filter((r: any) => r.data?.report_type === "daily_source");
  if (dailySourceRows.length > 0) {
    const monthMap = new Map<string, number>();
    for (const r of dailySourceRows as any[]) {
      const sm = String(r.data?.source_medium || "");
      if (isPaidMedium(sm)) continue;
      const date = r.data?.date;
      if (!date) continue;
      const monthKey = String(date).substring(0, 7);
      const sessions = Number(r.data?.sessions) || 0;
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + sessions);
    }
    if (monthMap.size > 0) {
      return Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, sessions]) => ({ month, sessions }));
    }
  }

  // 3. monthly_organic
  return (gaRecords as any[])
    .filter((r: any) => r.data?.report_type === "monthly_organic")
    .map((r: any) => ({ month: r.data.month as string, sessions: Number(r.data.sessions) || 0 }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserIntegrations } from "@/hooks/useUserIntegrations";
import { useResolvedGscIntegration } from "@/hooks/useResolvedGscIntegration";
import { seoDomainsMatch } from "@/lib/seoDomain";
import type { GscKeywordData } from "@/components/dynamic-tables/seo/GscIntegration";

export type SeoMonthlyGscPeriods = {
  /** Search Console rows for the selected month. */
  current: GscKeywordData[];
  /** Rows for the month before the selected one. */
  prev: GscKeywordData[];
  /** Rows for the first month of the campaign (the "since we started" baseline). */
  baseline: GscKeywordData[];
};

export type SeoMonthlyGscResult = SeoMonthlyGscPeriods & {
  siteUrl: string | null;
  /** First day of the baseline month, or null when there is nothing to compare to. */
  baselineMonth: string | null;
  isLoading: boolean;
  isAvailable: boolean;
};

const EMPTY: SeoMonthlyGscPeriods = { current: [], prev: [], baseline: [] };

function monthBounds(month: string): { startDate: string; endDate: string } {
  const start = new Date(`${month}T12:00:00`);
  start.setDate(1);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(0);
  const iso = (d: Date) => d.toISOString().split("T")[0];
  // Search Console has no data for the future; never ask beyond yesterday.
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return { startDate: iso(start), endDate: iso(end > yesterday ? yesterday : end) };
}

function shiftMonth(month: string, delta: number): string {
  const d = new Date(`${month}T12:00:00`);
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Search Console clicks/impressions for a single month of the SEO report,
 * alongside the previous month and the first month of the campaign so the
 * slideshow can show "this month" next to "since we started".
 *
 * GSC keeps ~16 months of history, so the baseline is clamped to that window.
 */
export function useSeoMonthlyGsc(params: {
  clientId: string | undefined;
  tenantIds: string[] | undefined;
  /** Selected month, first day (YYYY-MM-01). */
  month: string;
  /** First month the campaign has data for — used as the baseline period. */
  campaignStartMonth?: string | null;
  savedSiteUrl?: string;
  domain?: string;
  /**
   * The client's own domain. Any resolved property that belongs to another site
   * is rejected, so one bad mapping can't pull another client's Search Console
   * numbers into this report.
   */
  expectedDomain?: string;
  enabled?: boolean;
}): SeoMonthlyGscResult {
  const {
    clientId,
    tenantIds,
    month,
    campaignStartMonth,
    savedSiteUrl,
    domain,
    expectedDomain,
    enabled = true,
  } = params;

  const { data: personalIntegrations = [], isLoading: loadingPersonal } = useUserIntegrations(
    tenantIds,
    "google_search_console",
    { enabled: enabled && !!clientId },
  );

  const personal = useMemo(() => {
    if (!clientId) return null;
    for (const integration of personalIntegrations as any[]) {
      const mapped: string | undefined = integration?.settings?.client_sites?.[clientId];
      if (!mapped) continue;
      if (expectedDomain && !seoDomainsMatch(mapped, expectedDomain)) continue;
      return { integrationId: integration.id as string, siteUrl: mapped };
    }
    return null;
  }, [personalIntegrations, clientId, expectedDomain]);

  const fallback = useResolvedGscIntegration({
    clientId,
    tenantIds,
    savedSiteUrl,
    expectedDomain: expectedDomain || domain,
    enabled: enabled && !personal,
  });

  const integrationId = personal?.integrationId ?? fallback.integrationId;
  const resolvedSiteUrl = personal?.siteUrl ?? fallback.siteUrl ?? savedSiteUrl ?? null;
  const siteUrl =
    resolvedSiteUrl && expectedDomain && !seoDomainsMatch(resolvedSiteUrl, expectedDomain)
      ? null
      : resolvedSiteUrl;

  // Never look further back than Search Console retains (~16 months).
  const earliestAllowed = shiftMonth(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`,
    -15,
  );
  const baselineMonth =
    campaignStartMonth && campaignStartMonth < month
      ? campaignStartMonth < earliestAllowed
        ? earliestAllowed
        : campaignStartMonth
      : null;

  const canFetch = enabled && !!integrationId && !!siteUrl && !!month;

  const { data, isLoading } = useQuery({
    queryKey: ["seo-monthly-gsc", integrationId, siteUrl, month, baselineMonth],
    enabled: canFetch,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<SeoMonthlyGscPeriods> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return EMPTY;

      const windows: Array<{ key: keyof SeoMonthlyGscPeriods; month: string }> = [
        { key: "current", month },
        { key: "prev", month: shiftMonth(month, -1) },
      ];
      if (baselineMonth) windows.push({ key: "baseline", month: baselineMonth });

      const responses = await Promise.all(
        windows.map((w) => {
          const { startDate, endDate } = monthBounds(w.month);
          return supabase.functions.invoke("fetch-gsc-data", {
            body: { integrationId, siteUrl, startDate, endDate, aggregateAll: true },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
        }),
      );

      const result: SeoMonthlyGscPeriods = { current: [], prev: [], baseline: [] };
      windows.forEach((w, i) => {
        const rows = responses[i]?.data?.rows;
        result[w.key] = Array.isArray(rows) ? (rows as GscKeywordData[]) : [];
      });
      return result;
    },
  });

  return {
    ...(data ?? EMPTY),
    siteUrl,
    baselineMonth,
    isLoading: loadingPersonal || fallback.isLoading || (canFetch && isLoading),
    isAvailable: !!integrationId && !!siteUrl,
  };
}

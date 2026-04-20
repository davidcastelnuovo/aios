import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AhrefsKeyword {
  keyword: string;
  best_position: number | null;
  best_position_prev: number | null;
  best_position_url: string | null;
  best_position_url_prev: string | null;
  sum_traffic: number;
  sum_traffic_prev: number;
  volume: number | null;
  volume_prev: number | null;
  keyword_difficulty: number | null;
  keyword_difficulty_prev: number | null;
  cpc: number | null;
  cpc_prev: number | null;
}

export interface AhrefsComparisonData {
  threeMonth: Map<string, AhrefsKeyword>;
  yearly: Map<string, AhrefsKeyword>;
}

export function useAhrefsEnrichment() {
  const [isLoading, setIsLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState<AhrefsComparisonData>({
    threeMonth: new Map(),
    yearly: new Map(),
  });

  const fetchKeywordsForPeriod = async (
    domain: string,
    date: string,
    dateCompared: string,
    limit: number,
    country: string,
    accessToken: string,
    anonKey: string,
    projectId: string
  ): Promise<AhrefsKeyword[]> => {
    const url = `https://${projectId}.supabase.co/functions/v1/ahrefs-auth?action=fetch-keywords`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken || anonKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify({
        target: domain,
        date,
        date_compared: dateCompared,
        limit,
        country,
      }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to fetch from Ahrefs");
    }

    const result = await resp.json();
    // Handle structured quota-exceeded response (returns 200 with success:false)
    if (result?.success === false && result?.error === 'quota_exceeded') {
      const err = new Error(result.message || 'מכסת ה-API של Ahrefs נגמרה');
      (err as Error & { code?: string }).code = 'quota_exceeded';
      throw err;
    }
    return result.data?.keywords || [];
  };

  const buildMap = (keywords: AhrefsKeyword[]): Map<string, AhrefsKeyword> => {
    const map = new Map<string, AhrefsKeyword>();
    for (const kw of keywords) {
      map.set(kw.keyword.toLowerCase().trim(), kw);
    }
    return map;
  };

  const fetchComparisons = useCallback(async (
    domain: string,
    reportDate?: string,
    limit = 1000,
    country = "il"
  ) => {
    setIsLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token || anonKey;

      // Safe base date: never use future dates (Ahrefs has no data for them).
      // Use the report date if it's in the past, otherwise fall back to 7 days ago
      // (Ahrefs typically has data with a few days lag).
      const today = new Date();
      const safeRecentDate = new Date(today);
      safeRecentDate.setDate(safeRecentDate.getDate() - 7);

      let baseDate: Date;
      if (reportDate) {
        const reportDateObj = new Date(reportDate);
        baseDate = reportDateObj > safeRecentDate ? safeRecentDate : reportDateObj;
      } else {
        baseDate = safeRecentDate;
      }
      const currentDate = baseDate.toISOString().split("T")[0];

      // Calculate comparison dates (3 months back and 1 year back from base date)
      const threeMonthsAgo = new Date(baseDate);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const oneYearAgo = new Date(baseDate);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const date3m = threeMonthsAgo.toISOString().split("T")[0];
      const date1y = oneYearAgo.toISOString().split("T")[0];

      console.log('[Ahrefs Enrichment] Date range:', { currentDate, date3m, date1y, originalReportDate: reportDate });

      // Fetch both periods in parallel
      const [threeMonthKw, yearlyKw] = await Promise.all([
        fetchKeywordsForPeriod(domain, currentDate, date3m, limit, country, token, anonKey, projectId),
        fetchKeywordsForPeriod(domain, currentDate, date1y, limit, country, token, anonKey, projectId),
      ]);

      const data: AhrefsComparisonData = {
        threeMonth: buildMap(threeMonthKw),
        yearly: buildMap(yearlyKw),
      };
      setComparisonData(data);
      toast.success(`סונכרנו ${threeMonthKw.length} ביטויים (3 חודשים + שנה)`);
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "שגיאה בשליפת נתונים מ-Ahrefs";
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetComparisonData = useCallback(() => {
    setComparisonData({ threeMonth: new Map(), yearly: new Map() });
  }, []);

  return { fetchComparisons, comparisonData, resetComparisonData, isLoading };
}

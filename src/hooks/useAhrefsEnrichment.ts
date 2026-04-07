import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AhrefsKeyword {
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

interface EnrichmentResult {
  keywords: AhrefsKeyword[];
}

export function useAhrefsEnrichment() {
  const [isLoading, setIsLoading] = useState(false);
  const [enrichedData, setEnrichedData] = useState<Map<string, AhrefsKeyword>>(new Map());

  const fetchKeywords = useCallback(async (
    domain: string,
    date?: string,
    dateCompared?: string,
    limit = 100,
    country = "il"
  ) => {
    setIsLoading(true);
    try {
      const currentDate = date || new Date().toISOString().split("T")[0];
      // Default comparison: 3 months back
      const compDate = dateCompared || (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 3);
        return d.toISOString().split("T")[0];
      })();

      const { data, error } = await supabase.functions.invoke("ahrefs-auth", {
        body: {
          target: domain,
          date: currentDate,
          date_compared: compDate,
          limit,
          country,
        },
        headers: { "x-action": "fetch-keywords" },
      });

      // The edge function uses query params for action, but invoke sends body.
      // We need to call with the action in the URL. Let's use fetch directly.
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = (await supabase.auth.getSession()).data.session;

      const url = `https://${projectId}.supabase.co/functions/v1/ahrefs-auth?action=fetch-keywords`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || anonKey}`,
          "apikey": anonKey,
        },
        body: JSON.stringify({
          target: domain,
          date: currentDate,
          date_compared: compDate,
          limit,
          country,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to fetch from Ahrefs");
      }

      const result = await resp.json();
      const keywords: AhrefsKeyword[] = result.data?.keywords || [];

      // Build lookup map
      const map = new Map<string, AhrefsKeyword>();
      for (const kw of keywords) {
        map.set(kw.keyword.toLowerCase().trim(), kw);
      }
      setEnrichedData(map);
      return map;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "שגיאה בשליפת נתונים מ-Ahrefs";
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { fetchKeywords, enrichedData, isLoading };
}

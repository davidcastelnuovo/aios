import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ElementorSubmission {
  id: string | number;
  form_id: string;
  form_name: string;
  email: string | null;
  created_at: string;
  referer: string | null;
  source: "google_ads" | "google" | "facebook" | "organic" | "direct" | "test" | "other";
  gclid: string | null;
  gad_campaignid: string | null;
  fbclid: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  ip: string | null;
  raw_fields: Record<string, any>;
}

export interface PerFormStat {
  form_id: string;
  form_name: string;
  total: number;
  last_7_days: number;
  last_30_days: number;
  sources: Record<ElementorSubmission["source"], number>;
  last_submission_at: string | null;
}

export interface PerCampaignStat {
  gad_campaignid: string;
  submissions: number;
  forms: string[];
}

export interface ElementorSubmissionsResponse {
  success?: boolean;
  error?: string;
  hint?: string;
  status?: number;
  site?: { id: string; name: string; url: string };
  total_available?: number;
  totals?: {
    total: number;
    google_ads: number;
    facebook: number;
    organic: number;
    direct: number;
    test: number;
  };
  per_form?: PerFormStat[];
  per_campaign?: PerCampaignStat[];
  submissions?: ElementorSubmission[];
}

/**
 * Fetches and aggregates Elementor form submissions for a WordPress site.
 * Uses a 5-minute cache to avoid hitting WP repeatedly.
 */
export function useElementorSubmissions(siteId: string | null | undefined, days?: number) {
  return useQuery<ElementorSubmissionsResponse>({
    queryKey: ["elementor-submissions", siteId, days ?? "all"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-elementor-submissions", {
        body: { site_id: siteId, days },
      });
      if (error) throw error;
      return data as ElementorSubmissionsResponse;
    },
    enabled: !!siteId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}

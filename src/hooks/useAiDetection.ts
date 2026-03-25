import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { toast } from "sonner";

// Types
export interface AiDetectionBrand {
  id: string;
  tenant_id: string;
  brand_name: string;
  keywords: string[];
  competitor_names: string[];
  created_at: string;
  updated_at: string;
}

export interface AiDetectionPrompt {
  id: string;
  tenant_id: string;
  brand_id: string;
  prompt: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

export interface AiDetectionResult {
  id: string;
  prompt_id: string;
  platform: string;
  is_mentioned: boolean;
  position: number | null;
  sentiment: string | null;
  response_snippet: string | null;
  citations: string[] | null;
  scanned_at: string;
}

export interface AiDetectionScore {
  id: string;
  brand_id: string;
  score: number;
  chatgpt_score: number | null;
  gemini_score: number | null;
  perplexity_score: number | null;
  total_prompts: number;
  mentioned_prompts: number;
  week_start: string;
}

export interface CompetitorResult {
  competitor_name: string;
  platform: string;
  is_mentioned: boolean;
  position: number | null;
}

export function useAiDetection() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);

  // Get or create brand config
  const { data: brand, isLoading: brandLoading } = useQuery({
    queryKey: ["ai-detection-brand", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("ai_detection_brands" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code === "PGRST116") return null; // No rows
      if (error) throw error;
      return data as unknown as AiDetectionBrand;
    },
    enabled: !!tenantId,
  });

  // Get prompts
  const { data: prompts = [], isLoading: promptsLoading } = useQuery({
    queryKey: ["ai-detection-prompts", brand?.id],
    queryFn: async () => {
      if (!brand?.id) return [];
      const { data, error } = await supabase
        .from("ai_detection_prompts" as any)
        .select("*")
        .eq("brand_id", brand.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as AiDetectionPrompt[];
    },
    enabled: !!brand?.id,
  });

  // Get latest results for each prompt
  const { data: results = [], isLoading: resultsLoading } = useQuery({
    queryKey: ["ai-detection-results", brand?.id],
    queryFn: async () => {
      if (!brand?.id) return [];
      const { data, error } = await supabase
        .from("ai_detection_results" as any)
        .select("*")
        .eq("brand_id", brand.id)
        .order("scanned_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as AiDetectionResult[];
    },
    enabled: !!brand?.id,
  });

  // Get scores history
  const { data: scores = [] } = useQuery({
    queryKey: ["ai-detection-scores", brand?.id],
    queryFn: async () => {
      if (!brand?.id) return [];
      const { data, error } = await supabase
        .from("ai_detection_scores" as any)
        .select("*")
        .eq("brand_id", brand.id)
        .order("week_start", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as AiDetectionScore[];
    },
    enabled: !!brand?.id,
  });

  // Get competitor results
  const { data: competitorResults = [] } = useQuery({
    queryKey: ["ai-detection-competitors", brand?.id],
    queryFn: async () => {
      if (!brand?.id) return [];
      const { data, error } = await supabase
        .from("ai_detection_competitor_results" as any)
        .select("*")
        .eq("brand_id", brand.id)
        .order("scanned_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as CompetitorResult[];
    },
    enabled: !!brand?.id,
  });

  // Create/update brand
  const saveBrand = useMutation({
    mutationFn: async (data: { brandName: string; keywords: string[]; competitors: string[] }) => {
      if (!tenantId) throw new Error("No tenant");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (brand?.id) {
        const { error } = await supabase
          .from("ai_detection_brands" as any)
          .update({
            brand_name: data.brandName,
            keywords: data.keywords,
            competitor_names: data.competitors,
            updated_at: new Date().toISOString(),
          })
          .eq("id", brand.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ai_detection_brands" as any)
          .insert({
            tenant_id: tenantId,
            brand_name: data.brandName,
            keywords: data.keywords,
            competitor_names: data.competitors,
            created_by: user.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-detection-brand", tenantId] });
      toast.success("הגדרות המותג נשמרו בהצלחה");
    },
    onError: (error) => {
      toast.error("שגיאה בשמירת הגדרות: " + error.message);
    },
  });

  // Add prompt
  const addPrompt = useMutation({
    mutationFn: async (data: { prompt: string; category: string }) => {
      if (!brand?.id || !tenantId) throw new Error("No brand configured");

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("ai_detection_prompts" as any)
        .insert({
          tenant_id: tenantId,
          brand_id: brand.id,
          prompt: data.prompt,
          category: data.category,
          created_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-detection-prompts", brand?.id] });
      toast.success("הפרומפט נוסף בהצלחה");
    },
    onError: (error) => {
      toast.error("שגיאה בהוספת פרומפט: " + error.message);
    },
  });

  // Run scan
  const runScan = async (promptIds?: string[]) => {
    if (!brand?.id || !tenantId) {
      toast.error("יש להגדיר מותג קודם");
      return;
    }

    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-detection-scan", {
        body: {
          brand_id: brand.id,
          tenant_id: tenantId,
          prompt_ids: promptIds,
        },
      });

      if (error) throw error;

      toast.success(`סריקה הושלמה! ${data.scanned} בדיקות, ${data.mentioned} אזכורים, ציון: ${data.score}`);

      // Refresh all data
      queryClient.invalidateQueries({ queryKey: ["ai-detection-results", brand.id] });
      queryClient.invalidateQueries({ queryKey: ["ai-detection-scores", brand.id] });
      queryClient.invalidateQueries({ queryKey: ["ai-detection-competitors", brand.id] });
    } catch (error: any) {
      toast.error("שגיאה בסריקה: " + (error.message || "Unknown error"));
    } finally {
      setIsScanning(false);
    }
  };

  // Helper: get latest result per prompt per platform
  const getPromptResults = (promptId: string) => {
    const promptResults = results.filter(r => r.prompt_id === promptId);
    const latest: Record<string, AiDetectionResult> = {};
    for (const r of promptResults) {
      if (!latest[r.platform] || new Date(r.scanned_at) > new Date(latest[r.platform].scanned_at)) {
        latest[r.platform] = r;
      }
    }
    return latest;
  };

  // Helper: calculate competitor scores
  const getCompetitorScores = () => {
    const competitorMap: Record<string, { mentioned: number; total: number }> = {};
    for (const r of competitorResults) {
      if (!competitorMap[r.competitor_name]) {
        competitorMap[r.competitor_name] = { mentioned: 0, total: 0 };
      }
      competitorMap[r.competitor_name].total++;
      if (r.is_mentioned) competitorMap[r.competitor_name].mentioned++;
    }
    return Object.entries(competitorMap).map(([name, data]) => ({
      name,
      score: data.total > 0 ? Math.round((data.mentioned / data.total) * 100) : 0,
      change: 0,
      topCategories: [] as string[],
    }));
  };

  // Current score
  const currentScore = scores.length > 0 ? scores[scores.length - 1] : null;
  const previousScore = scores.length > 1 ? scores[scores.length - 2] : null;

  return {
    brand,
    prompts,
    results,
    scores,
    competitorResults,
    currentScore,
    previousScore,
    isLoading: brandLoading || promptsLoading || resultsLoading,
    isScanning,
    saveBrand,
    addPrompt,
    runScan,
    getPromptResults,
    getCompetitorScores,
  };
}

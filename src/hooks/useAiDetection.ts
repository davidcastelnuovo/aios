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
  url: string | null;
  description: string | null;
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
  scan_id: string | null;
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
  created_at: string;
}

export interface CompetitorResult {
  competitor_name: string;
  platform: string;
  is_mentioned: boolean;
  position: number | null;
}

// Helper to safely query tables that might not exist yet
async function safeQuery<T>(queryFn: () => any): Promise<T | null> {
  try {
    const result = await queryFn();
    const { data, error } = result;
    if (error) {
      // Table doesn't exist or other DB error - return null silently
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.warn("AI Detection tables not found. Run the migration first.");
        return null;
      }
      if (error.code === "PGRST116") return null; // No rows found
      throw error;
    }
    return data;
  } catch (e: any) {
    if (e?.code === "42P01" || e?.message?.includes("does not exist")) {
      return null;
    }
    throw e;
  }
}

export function useAiDetection() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);

  // Get all projects for this tenant
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["ai-detection-projects", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const result = await safeQuery(() =>
        supabase.from("ai_detection_brands" as any).select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false })
      );
      return (result || []) as unknown as AiDetectionBrand[];
    },
    enabled: !!tenantId,
  });

  // Create project
  const createProject = useMutation({
    mutationFn: async (data: { brandName: string; url: string; description: string; keywords: string[]; competitors: string[] }) => {
      if (!tenantId) throw new Error("No tenant");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: brand, error } = await supabase.from("ai_detection_brands" as any).insert({
        tenant_id: tenantId,
        brand_name: data.brandName,
        url: data.url || null,
        description: data.description || null,
        keywords: data.keywords,
        competitor_names: data.competitors,
        created_by: user.id,
      }).select().single();
      if (error) throw error;

      // Auto-generate default prompts based on brand name and keywords
      const brandId = (brand as any).id;
      const defaultPrompts = [
        { prompt: `מה הכלי הכי טוב ל${data.keywords[0] || data.brandName}?`, category: "recommendation" },
        { prompt: `השווה בין ${data.brandName}${data.competitors.length > 0 ? ` ל-${data.competitors[0]}` : " למתחרים בשוק"}`, category: "comparison" },
        { prompt: `מה דעתך על ${data.brandName}? האם כדאי להשתמש בהם?`, category: "review" },
      ];

      if (data.keywords.length > 1) {
        defaultPrompts.push({
          prompt: `איזה שירות מומלץ ל${data.keywords[1]}?`,
          category: "recommendation",
        });
      }

      const promptInserts = defaultPrompts.map(p => ({
        tenant_id: tenantId,
        brand_id: brandId,
        prompt: p.prompt,
        category: p.category,
        is_active: true,
        created_by: user.id,
      }));

      const { error: promptError } = await supabase.from("ai_detection_prompts" as any).insert(promptInserts);
      if (promptError) console.error("Error creating default prompts:", promptError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-detection-projects", tenantId] });
      toast.success("הפרויקט נוצר בהצלחה עם פרומפטים ברירת מחדל");
    },
    onError: (error) => toast.error("שגיאה: " + error.message),
  });

  // Update project
  const updateProject = useMutation({
    mutationFn: async ({ projectId, data }: { projectId: string; data: { brandName: string; url: string; description: string; keywords: string[]; competitors: string[] } }) => {
      const { error } = await supabase.from("ai_detection_brands" as any).update({
        brand_name: data.brandName,
        url: data.url || null,
        description: data.description || null,
        keywords: data.keywords,
        competitor_names: data.competitors,
        updated_at: new Date().toISOString(),
      }).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-detection-projects", tenantId] });
      toast.success("הפרויקט עודכן");
    },
    onError: (error) => toast.error("שגיאה: " + error.message),
  });

  // Delete project
  const deleteProject = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase.from("ai_detection_brands" as any).delete().eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-detection-projects", tenantId] });
      toast.success("הפרויקט נמחק");
    },
    onError: (error) => toast.error("שגיאה: " + error.message),
  });

  return {
    projects,
    isLoading: projectsLoading,
    createProject,
    updateProject,
    deleteProject,
  };
}

// Hook for a specific project's data
export function useAiDetectionProject(projectId: string | null) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);

  // Get prompts
  const { data: prompts = [], isLoading: promptsLoading } = useQuery({
    queryKey: ["ai-detection-prompts", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const result = await safeQuery(() =>
        supabase.from("ai_detection_prompts" as any).select("*").eq("brand_id", projectId).eq("is_active", true).order("created_at", { ascending: false })
      );
      return (result || []) as unknown as AiDetectionPrompt[];
    },
    enabled: !!projectId,
  });

  // Get results
  const { data: results = [], isLoading: resultsLoading } = useQuery({
    queryKey: ["ai-detection-results", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const result = await safeQuery(() =>
        supabase.from("ai_detection_results" as any).select("*").eq("brand_id", projectId).order("scanned_at", { ascending: false })
      );
      return (result || []) as unknown as AiDetectionResult[];
    },
    enabled: !!projectId,
  });

  // Get scores history
  const { data: scores = [] } = useQuery({
    queryKey: ["ai-detection-scores", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const result = await safeQuery(() =>
        supabase.from("ai_detection_scores" as any).select("*").eq("brand_id", projectId).order("week_start", { ascending: true })
      );
      return (result || []) as unknown as AiDetectionScore[];
    },
    enabled: !!projectId,
  });

  // Get competitor results
  const { data: competitorResults = [] } = useQuery({
    queryKey: ["ai-detection-competitors", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const result = await safeQuery(() =>
        supabase.from("ai_detection_competitor_results" as any).select("*").eq("brand_id", projectId).order("scanned_at", { ascending: false })
      );
      return (result || []) as unknown as CompetitorResult[];
    },
    enabled: !!projectId,
  });

  // Add prompt
  const addPrompt = useMutation({
    mutationFn: async (data: { prompt: string; category: string }) => {
      if (!projectId || !tenantId) throw new Error("No project");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("ai_detection_prompts" as any).insert({
        tenant_id: tenantId,
        brand_id: projectId,
        prompt: data.prompt,
        category: data.category,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-detection-prompts", projectId] });
      toast.success("הפרומפט נוסף");
    },
    onError: (error) => toast.error("שגיאה: " + error.message),
  });

  // Delete prompt
  const deletePrompt = useMutation({
    mutationFn: async (promptId: string) => {
      const { error } = await supabase.from("ai_detection_prompts" as any).update({ is_active: false }).eq("id", promptId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-detection-prompts", projectId] });
      toast.success("הפרומפט הוסר");
    },
    onError: (error) => toast.error("שגיאה: " + error.message),
  });

  // Run scan
  const runScan = async () => {
    if (!projectId || !tenantId) {
      toast.error("יש לבחור פרויקט");
      return;
    }
    if (prompts.length === 0) {
      toast.error("הוסף לפחות פרומפט אחד לפני הסריקה");
      return;
    }

    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-detection-scan", {
        body: { brand_id: projectId, tenant_id: tenantId },
      });

      if (error) throw error;

      toast.success(`סריקה הושלמה! ציון: ${data.score}/100 (${data.mentioned}/${data.scanned} אזכורים)`);

      // Refresh all project data
      queryClient.invalidateQueries({ queryKey: ["ai-detection-results", projectId] });
      queryClient.invalidateQueries({ queryKey: ["ai-detection-scores", projectId] });
      queryClient.invalidateQueries({ queryKey: ["ai-detection-competitors", projectId] });
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

  // Helper: competitor scores
  const getCompetitorScores = () => {
    const map: Record<string, { mentioned: number; total: number }> = {};
    for (const r of competitorResults) {
      if (!map[r.competitor_name]) map[r.competitor_name] = { mentioned: 0, total: 0 };
      map[r.competitor_name].total++;
      if (r.is_mentioned) map[r.competitor_name].mentioned++;
    }
    return Object.entries(map).map(([name, data]) => ({
      name,
      score: data.total > 0 ? Math.round((data.mentioned / data.total) * 100) : 0,
      change: 0,
      topCategories: [] as string[],
    }));
  };

  const currentScore = scores.length > 0 ? scores[scores.length - 1] : null;
  const previousScore = scores.length > 1 ? scores[scores.length - 2] : null;

  return {
    prompts,
    results,
    scores,
    competitorResults,
    currentScore,
    previousScore,
    isLoading: promptsLoading || resultsLoading,
    isScanning,
    addPrompt,
    deletePrompt,
    runScan,
    getPromptResults,
    getCompetitorScores,
  };
}

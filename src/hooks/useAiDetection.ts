import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { toast } from "sonner";
import { ALL_CLIENTS_FILTER, type MarketingClientFilter } from "@/components/marketing/clientFilter";

// Types
export interface AiDetectionBrand {
  id: string;
  tenant_id: string;
  client_id: string | null;
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

export interface AiDetectionJob {
  id: string;
  scan_id: string;
  engine: string;
  status: "queued" | "running" | "done" | "failed" | string;
  total_prompts: number;
  completed_prompts: number;
  mentioned_prompts: number;
  error: string | null;
  created_at: string;
}

export interface CompetitorResult {
  competitor_name: string;
  prompt_id?: string | null;
  platform: string;
  is_mentioned: boolean;
  position: number | null;
  scanned_at?: string | null;
}

// Helper to safely query tables that might not exist yet
async function safeQuery<T>(queryFn: () => PromiseLike<{ data: T | null; error: any }>): Promise<T | null> {
  try {
    const { data, error } = await queryFn();
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

function normalizeBrand(row: AiDetectionBrand): AiDetectionBrand {
  return {
    ...row,
    keywords: row.keywords ?? [],
    competitor_names: row.competitor_names ?? [],
  };
}

export function useAiDetection(clientFilter?: MarketingClientFilter) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();

  // Get projects for this tenant, scoped to the SEO client filter when provided
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["ai-detection-projects", tenantId, clientFilter],
    queryFn: async () => {
      if (!tenantId) return [];
      const result = await safeQuery(() =>
        supabase.from("ai_detection_brands").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false })
      );
      const rows = ((result || []) as unknown as AiDetectionBrand[]).map(normalizeBrand);
      if (clientFilter === undefined || clientFilter === ALL_CLIENTS_FILTER) return rows;
      const hasClientColumn = rows.some((row) => "client_id" in row && row.client_id !== undefined);
      if (!hasClientColumn && rows.length > 0) return rows;
      if (!clientFilter) return rows.filter((row) => !row.client_id);
      return rows.filter((row) => row.client_id === clientFilter || !row.client_id);
    },
    enabled: !!tenantId,
  });

  const assignedClientId = clientFilter && clientFilter !== ALL_CLIENTS_FILTER ? clientFilter : null;

  // Create project
  const createProject = useMutation({
    mutationFn: async (data: { brandName: string; url: string; description: string; keywords: string[]; competitors: string[] }) => {
      if (!tenantId) throw new Error("No tenant");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload: Record<string, unknown> = {
        tenant_id: tenantId,
        brand_name: data.brandName,
        url: data.url || null,
        description: data.description || null,
        keywords: data.keywords,
        competitor_names: data.competitors,
        created_by: user.id,
      };
      if (assignedClientId) payload.client_id = assignedClientId;
      const first = await supabase.from("ai_detection_brands").insert(payload as never);
      if (first.error && /client_id/.test(first.error.message)) {
        delete payload.client_id;
        const retry = await supabase.from("ai_detection_brands").insert(payload as never);
        if (retry.error) throw retry.error;
        return;
      }
      if (first.error) throw first.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-detection-projects", tenantId] });
      toast.success("הפרויקט נוצר בהצלחה");
    },
    onError: (error) => toast.error("שגיאה: " + error.message),
  });

  // Update project
  const updateProject = useMutation({
    mutationFn: async ({ projectId, data }: { projectId: string; data: { brandName: string; url: string; description: string; keywords: string[]; competitors: string[] } }) => {
      const { error } = await supabase.from("ai_detection_brands").update({
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
      const { error } = await supabase.from("ai_detection_brands").delete().eq("id", projectId);
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
        supabase.from("ai_detection_prompts").select("*").eq("brand_id", projectId).eq("is_active", true).order("created_at", { ascending: false })
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
        supabase.from("ai_detection_results").select("*").eq("brand_id", projectId).order("scanned_at", { ascending: false })
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
        supabase.from("ai_detection_scores").select("*").eq("brand_id", projectId).order("week_start", { ascending: true })
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
        supabase.from("ai_detection_competitor_results").select("*").eq("brand_id", projectId).order("scanned_at", { ascending: false })
      );
      return (result || []) as unknown as CompetitorResult[];
    },
    enabled: !!projectId,
  });

  const { data: latestJob = null } = useQuery({
    queryKey: ["ai-detection-jobs", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const result = await safeQuery(() =>
        supabase.from("ai_detection_jobs").select("*").eq("brand_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle()
      );
      return (result || null) as AiDetectionJob | null;
    },
    enabled: !!projectId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 4000 : false;
    },
  });

  const prevJobStatus = useRef<string | null>(null);
  useEffect(() => {
    const status = latestJob?.status ?? null;
    const wasActive = prevJobStatus.current === "queued" || prevJobStatus.current === "running";
    if (wasActive && status === "done") {
      toast.success(`סריקת ChatGPT.com הסתיימה (${latestJob?.mentioned_prompts ?? 0}/${latestJob?.total_prompts ?? 0} אזכורים)`);
      queryClient.invalidateQueries({ queryKey: ["ai-detection-results", projectId] });
      queryClient.invalidateQueries({ queryKey: ["ai-detection-scores", projectId] });
      queryClient.invalidateQueries({ queryKey: ["ai-detection-competitors", projectId] });
    }
    if (wasActive && status === "failed") {
      toast.error(latestJob?.error || "סריקת ChatGPT.com נכשלה");
    }
    prevJobStatus.current = status;
  }, [latestJob?.status, latestJob?.scan_id, latestJob?.error, latestJob?.mentioned_prompts, latestJob?.total_prompts, projectId, queryClient]);

  // Add prompt
  const addPrompt = useMutation({
    mutationFn: async (data: { prompt: string; category: string }) => {
      if (!projectId || !tenantId) throw new Error("No project");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("ai_detection_prompts").insert({
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

  const [isGenerating, setIsGenerating] = useState(false);
  const generatePrompts = async (brand: AiDetectionBrand) => {
    if (!projectId || !tenantId) return;
    setIsGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("generate-ai-prompts", {
        body: {
          brand_name: brand.brand_name,
          keywords: brand.keywords || [],
          competitors: brand.competitor_names || [],
          description: brand.description || "",
        },
      });
      if (error) throw error;
      if (!data?.prompts?.length) throw new Error("No prompts generated");

      const inserts = data.prompts.map((p: { prompt: string; category: string }) => ({
        tenant_id: tenantId,
        brand_id: projectId,
        prompt: p.prompt,
        category: p.category,
        is_active: true,
        created_by: user?.id,
      }));

      const { error: insertError } = await supabase.from("ai_detection_prompts").insert(inserts);
      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["ai-detection-prompts", projectId] });
      toast.success(`${data.prompts.length} פרומפטים נוצרו בהצלחה`);
    } catch (error: any) {
      toast.error("שגיאה ביצירת פרומפטים: " + (error.message || "Unknown error"));
    } finally {
      setIsGenerating(false);
    }
  };

  const importPrompts = useMutation({
    mutationFn: async (items: { prompt: string; category: string }[]) => {
      if (!projectId || !tenantId) throw new Error("No project");
      const { data: { user } } = await supabase.auth.getUser();
      const existing = await safeQuery(() =>
        supabase.from("ai_detection_prompts").select("prompt").eq("brand_id", projectId).eq("is_active", true)
      );
      const seen = new Set(((existing || []) as Array<{ prompt: string }>).map((row) => row.prompt.trim().toLowerCase().replace(/\s+/g, " ")));
      const inserts = items
        .map((item) => ({ prompt: item.prompt.trim(), category: item.category || "geo" }))
        .filter((item) => {
          const key = item.prompt.toLowerCase().replace(/\s+/g, " ");
          if (!item.prompt || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((item) => ({
          tenant_id: tenantId,
          brand_id: projectId,
          prompt: item.prompt,
          category: item.category,
          is_active: true,
          created_by: user?.id,
        }));
      if (inserts.length === 0) return 0;
      const { error } = await supabase.from("ai_detection_prompts").insert(inserts);
      if (error) throw error;
      return inserts.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["ai-detection-prompts", projectId] });
      if (count === 0) toast.info("כל השאלות האלה כבר במעקב");
      else toast.success(`${count} שאלות נוספו למעקב`);
    },
    onError: (error) => toast.error("שגיאה: " + error.message),
  });

  const editPrompt = useMutation({
    mutationFn: async ({ promptId, prompt, category }: { promptId: string; prompt: string; category: string }) => {
      const { error } = await supabase.from("ai_detection_prompts").update({ prompt, category }).eq("id", promptId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-detection-prompts", projectId] });
      toast.success("הפרומפט עודכן");
    },
    onError: (error) => toast.error("שגיאה: " + error.message),
  });

  // Delete prompt
  const deletePrompt = useMutation({
    mutationFn: async (promptId: string) => {
      const { error } = await supabase.from("ai_detection_prompts").update({ is_active: false }).eq("id", promptId);
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

      if (data?.queued) {
        toast.success("הסריקה רצה על וורקר ChatGPT.com — שיחה חדשה לכל פרומפט, זה לוקח כמה דקות");
        queryClient.invalidateQueries({ queryKey: ["ai-detection-jobs", projectId] });
        return;
      }

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

  const jobActive = latestJob?.status === "queued" || latestJob?.status === "running";

  return {
    prompts,
    results,
    scores,
    competitorResults,
    latestJob,
    currentScore,
    previousScore,
    isLoading: promptsLoading || resultsLoading,
    isScanning: isScanning || jobActive,
    addPrompt,
    importPrompts,
    editPrompt,
    deletePrompt,
    generatePrompts,
    isGenerating,
    runScan,
    getPromptResults,
    getCompetitorScores,
  };
}

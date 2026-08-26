import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AiVisibilityScore } from "@/components/ai-detection/AiVisibilityScore";
import { PlatformBreakdown } from "@/components/ai-detection/PlatformBreakdown";
import { PromptTracker } from "@/components/ai-detection/PromptTracker";
import { CompetitorAnalysis } from "@/components/ai-detection/CompetitorAnalysis";
import { CitationSources } from "@/components/ai-detection/CitationSources";
import { TrendChart } from "@/components/ai-detection/TrendChart";
import { StatsCards } from "@/components/ai-detection/StatsCards";
import { Recommendations } from "@/components/ai-detection/Recommendations";
import { CreateProjectDialog, ProjectFormData } from "@/components/ai-detection/CreateProjectDialog";
import { ProjectList } from "@/components/ai-detection/ProjectList";
import { ScanHistory } from "@/components/ai-detection/ScanHistory";
import { Eye, Loader2, Radar, Plus, ArrowRight, Globe, Settings } from "lucide-react";
import { useAiDetection, useAiDetectionProject, AiDetectionBrand } from "@/hooks/useAiDetection";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ALL_CLIENTS_FILTER, applyClientFilter, type MarketingClientFilter } from "@/components/marketing/clientFilter";
import { ensurePipelineForClient } from "@/components/marketing/lib/ensurePipeline";
import {
  buildVisibilitySummary,
  collectGeoQuestions,
  normalizePromptText,
  type VisibilityTip,
} from "@/lib/aiVisibilityInsights";
import { toast } from "sonner";

interface AiVisibilityStudioProps {
  tenantId: string;
  clientFilter: MarketingClientFilter;
}

export function AiVisibilityStudio({ tenantId, clientFilter }: AiVisibilityStudioProps) {
  const [selectedProject, setSelectedProject] = useState<AiDetectionBrand | null>(null);
  const { projects, isLoading, createProject, updateProject, deleteProject } = useAiDetection(clientFilter);
  const selectedClientId = clientFilter && clientFilter !== ALL_CLIENTS_FILTER ? clientFilter : null;

  const { data: client } = useQuery({
    queryKey: ["ai-visibility-client", tenantId, selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("id,name,website,industry,notes")
        .eq("id", selectedClientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClientId,
  });

  const handleCreateProject = (data: ProjectFormData) => {
    createProject.mutate(data);
  };

  const handleDeleteProject = (projectId: string) => {
    if (window.confirm("למחוק את הפרויקט? כל הנתונים ימחקו לצמיתות.")) {
      deleteProject.mutate(projectId);
      if (selectedProject?.id === projectId) setSelectedProject(null);
    }
  };

  const createDefaults: Partial<ProjectFormData> | undefined = client
    ? {
        brandName: client.name,
        url: client.website || "",
        description: [client.industry, client.notes].filter(Boolean).join(" — "),
        keywords: [],
        competitors: [],
      }
    : undefined;

  if (selectedProject) {
    return (
      <ProjectDashboard
        project={selectedProject}
        tenantId={tenantId}
        clientFilter={clientFilter}
        onBack={() => setSelectedProject(null)}
        onUpdate={(data) => updateProject.mutate({ projectId: selectedProject.id, data })}
      />
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <Eye className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">נראות AI</h2>
              <p className="text-sm text-muted-foreground">מדידת המותג בתשובות ChatGPT — טיפים הופכים למשימות במחלקת SEO</p>
            </div>
          </div>
          <CreateProjectDialog
            trigger={<Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="ml-1 h-4 w-4" />פרויקט חדש</Button>}
            initialData={createDefaults}
            onSave={handleCreateProject}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <Card className="mx-auto mt-8 max-w-lg">
            <CardContent className="space-y-4 pt-6 text-center">
              <Radar className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">צור את פרויקט הנראות הראשון</h3>
              <p className="text-sm text-muted-foreground">
                הוסף מותג, ביטויי מפתח ומתחרים. ייבאו שאלות מתוכנית GEO, ייצרו פרומפטים והפעילו סריקה — כל טיפ יכול להפוך למשימת תוכן ב-SEO.
              </p>
              <CreateProjectDialog
                trigger={<Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="ml-1 h-4 w-4" />צור פרויקט</Button>}
                initialData={createDefaults}
                onSave={handleCreateProject}
              />
            </CardContent>
          </Card>
        ) : (
          <ProjectList projects={projects} onSelect={setSelectedProject} onDelete={handleDeleteProject} />
        )}
      </div>
    </div>
  );
}

function ProjectDashboard({
  project,
  tenantId,
  clientFilter,
  onBack,
  onUpdate,
}: {
  project: AiDetectionBrand;
  tenantId: string;
  clientFilter: MarketingClientFilter;
  onBack: () => void;
  onUpdate: (data: ProjectFormData) => void;
}) {
  const queryClient = useQueryClient();
  const selectedClientId = clientFilter && clientFilter !== ALL_CLIENTS_FILTER ? clientFilter : null;
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const {
    prompts, results, scores, competitorResults, currentScore, previousScore,
    isScanning, isGenerating,
    addPrompt, importPrompts, editPrompt, deletePrompt, generatePrompts, runScan,
    getCompetitorScores,
  } = useAiDetectionProject(project.id);

  const summary = useMemo(() => buildVisibilitySummary({
    prompts: prompts.map((prompt) => ({ id: prompt.id, prompt: prompt.prompt, category: prompt.category })),
    results,
    competitorResults,
    brandUrl: project.url,
  }), [prompts, results, competitorResults, project.url]);

  const { data: geoQuestions = [] } = useQuery({
    queryKey: ["ai-visibility-geo-questions", tenantId, clientFilter],
    queryFn: async () => {
      let query = supabase.from("marketing_work_items").select("payload").eq("tenant_id", tenantId);
      query = applyClientFilter(query, clientFilter);
      const { data, error } = await query;
      if (error) throw error;
      return collectGeoQuestions((data ?? []) as Array<{ payload?: Record<string, unknown> | null }>);
    },
  });

  const trackedKeys = useMemo(() => new Set(prompts.map((prompt) => normalizePromptText(prompt.prompt))), [prompts]);
  const importableGeo = useMemo(
    () => geoQuestions.filter((question) => !trackedKeys.has(normalizePromptText(question))),
    [geoQuestions, trackedKeys],
  );

  const platformBreakdown = ["chatgpt"].map((platform) => {
    const platformResults = results.filter((result) => result.platform === platform);
    const latestByPrompt: Record<string, typeof platformResults[0]> = {};
    for (const result of platformResults) {
      if (!latestByPrompt[result.prompt_id] || new Date(result.scanned_at) > new Date(latestByPrompt[result.prompt_id].scanned_at)) {
        latestByPrompt[result.prompt_id] = result;
      }
    }
    const latest = Object.values(latestByPrompt);
    const mentions = latest.filter((result) => result.is_mentioned).length;
    const total = latest.length || prompts.length || 1;
    return { name: "ChatGPT", score: total > 0 ? Math.round((mentions / total) * 100) : 0, mentions, total, icon: "🤖", color: "" };
  });

  const trendData = scores.map((score) => ({
    date: new Date(score.week_start).toLocaleDateString("he-IL", { month: "short", day: "numeric" }),
    score: score.score, chatgpt: score.chatgpt_score || 0, gemini: score.gemini_score || 0, perplexity: score.perplexity_score || 0,
  }));

  const createSeoTask = async (tip: VisibilityTip) => {
    if (!selectedClientId) {
      toast.error("בחרו לקוח במסנן כדי ליצור משימת SEO");
      return;
    }
    setCreatingId(tip.id);
    try {
      const pipeline = await ensurePipelineForClient({ clientId: selectedClientId, tenantId, track: "seo_geo" });
      if (!pipeline) throw new Error("לא ניתן לפתוח סביבת SEO/GEO");
      const { data: stages, error: stageError } = await supabase
        .from("marketing_pipeline_stages")
        .select("id,stage_type")
        .eq("pipeline_id", pipeline.id);
      if (stageError) throw stageError;
      const stageId = stages?.find((stage) => stage.stage_type === "target_seo")?.id ?? null;
      const brief = [
        tip.description,
        `ראיה: ${tip.evidence}`,
        tip.promptText ? `פרומפט שנמדד: ${tip.promptText}` : "",
        `מותג: ${project.brand_name}`,
      ].filter(Boolean).join("\n\n");
      const { error } = await supabase.from("marketing_work_items").insert({
        tenant_id: tenantId,
        client_id: selectedClientId,
        pipeline_id: pipeline.id,
        current_stage_id: stageId,
        title: tip.title.slice(0, 120),
        status: "draft",
        target_channel: "seo",
        payload: {
          brief_text: brief,
          department: "seo",
          intake_source: "ai_visibility",
          geoQuestions: tip.promptText ? [tip.promptText] : [],
          visibility_tip: {
            id: tip.id,
            type: tip.type,
            impact: tip.impact,
            promptId: tip.promptId ?? null,
            brand_id: project.id,
          },
        },
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["seo-department-items", clientFilter, tenantId] });
      toast.success("נוצרה משימת תוכן במחלקת SEO");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "יצירת המשימה נכשלה");
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{project.brand_name}</h2>
                {project.url && (
                  <a href={project.url.startsWith("http") ? project.url : `https://${project.url}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                    <Globe className="h-4 w-4" />
                  </a>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                {project.url && <span className="text-xs text-muted-foreground" dir="ltr">{project.url}</span>}
                {project.keywords.length > 0 && (
                  <div className="flex gap-1">
                    {project.keywords.slice(0, 3).map((keyword) => <Badge key={keyword} variant="outline" className="text-xs">{keyword}</Badge>)}
                    {project.keywords.length > 3 && <Badge variant="outline" className="text-xs">+{project.keywords.length - 3}</Badge>}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={runScan} disabled={isScanning || prompts.length === 0}>
              {isScanning ? <><Loader2 className="ml-1 h-4 w-4 animate-spin" />סורק...</> : <><Radar className="ml-1 h-4 w-4" />הפעל סריקה</>}
            </Button>
            <CreateProjectDialog
              trigger={<Button variant="outline" size="sm"><Settings className="ml-1 h-4 w-4" />הגדרות</Button>}
              title="עריכת פרויקט"
              initialData={{ brandName: project.brand_name, url: project.url || "", description: project.description || "", keywords: project.keywords, competitors: project.competitor_names }}
              onSave={onUpdate}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          הסריקה רצה כרגע דרך ChatGPT. עמודות Gemini ו-Perplexity ישמרו כתוויות עד שיותקנו מתאמים אמיתיים — לא מציגים אותן כמנועים נפרדים ללקוח.
        </p>

        <Tabs defaultValue="overview" dir="rtl">
          <TabsList>
            <TabsTrigger value="overview">סקירה כללית</TabsTrigger>
            <TabsTrigger value="prompts">פרומפטים ({prompts.length})</TabsTrigger>
            <TabsTrigger value="history">היסטוריית סריקות</TabsTrigger>
            <TabsTrigger value="competitors">מתחרים</TabsTrigger>
            <TabsTrigger value="citations">ציטוטים</TabsTrigger>
            <TabsTrigger value="recommendations">תוכנית פעולה ({summary.tips.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            {scores.length === 0 && prompts.length === 0 ? (
              <Card>
                <CardContent className="space-y-3 py-12 pt-6 text-center">
                  <Radar className="mx-auto h-10 w-10 text-muted-foreground" />
                  <h3 className="font-semibold">הפרויקט מוכן</h3>
                  <p className="mx-auto max-w-md text-sm text-muted-foreground">
                    ייבאו שאלות מתוכנית GEO או ייצרו פרומפטים, ואז הפעילו סריקה. הטיפים שיגיעו מהסריקה יהפכו למשימות SEO — לא יישארו בדשבורד.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <StatsCards
                    totalPrompts={prompts.length}
                    owned={summary.owned}
                    competitorWins={summary.competitorWins}
                    shareOfVoice={summary.shareOfVoice}
                  />
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <AiVisibilityScore
                    score={currentScore?.score || 0}
                    previousScore={previousScore?.score || 0}
                    totalPrompts={currentScore?.total_prompts || prompts.length}
                    mentionedPrompts={currentScore?.mentioned_prompts || summary.mentionedPrompts}
                  />
                  <PlatformBreakdown platforms={platformBreakdown} />
                </div>
                {trendData.length > 0 && <TrendChart data={trendData} />}
                <Recommendations
                  recommendations={summary.tips.slice(0, 3)}
                  onCreateTask={createSeoTask}
                  creatingId={creatingId}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="prompts" className="mt-6">
            <PromptTracker
              prompts={summary.prompts}
              onAddPrompt={(prompt, category) => addPrompt.mutate({ prompt, category })}
              onDeletePrompt={(promptId) => deletePrompt.mutate(promptId)}
              onEditPrompt={(promptId, prompt, category) => editPrompt.mutate({ promptId, prompt, category })}
              onAutoGenerate={() => generatePrompts(project)}
              isGenerating={isGenerating}
              onImportGeo={() => importPrompts.mutate(importableGeo.map((prompt) => ({ prompt, category: "geo" })))}
              geoCount={importableGeo.length}
              isImporting={importPrompts.isPending}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <ScanHistory scores={scores} />
          </TabsContent>

          <TabsContent value="competitors" className="mt-6">
            {project.competitor_names.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <CompetitorAnalysis brandName={project.brand_name} brandScore={currentScore?.score || 0} competitors={getCompetitorScores()} />
                <PlatformBreakdown platforms={platformBreakdown} />
              </div>
            ) : (
              <Card><CardContent className="py-8 pt-6 text-center text-muted-foreground">
                <p>הוסף מתחרים בהגדרות הפרויקט כדי לראות השוואה</p>
              </CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="citations" className="mt-6">
            {summary.citations.length > 0 ? <CitationSources citations={summary.citations} /> : (
              <Card><CardContent className="py-8 pt-6 text-center text-muted-foreground"><p>הפעל סריקה כדי לגלות מקורות ציטוט</p></CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="recommendations" className="mt-6">
            <Recommendations
              recommendations={summary.tips}
              onCreateTask={createSeoTask}
              creatingId={creatingId}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

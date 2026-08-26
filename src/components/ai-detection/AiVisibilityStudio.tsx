import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AiVisibilityScore } from "@/components/ai-detection/AiVisibilityScore";
import { PlatformBreakdown } from "@/components/ai-detection/PlatformBreakdown";
import { PromptTracker, TrackedPrompt } from "@/components/ai-detection/PromptTracker";
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
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { ALL_CLIENTS_FILTER, type MarketingClientFilter } from "@/components/marketing/clientFilter";

const staticRecommendations = [
  { id: "1", title: "הוסף דף FAQ מקיף לאתר", description: "מודלי AI מעדיפים מקורות עם תשובות מובנות לשאלות נפוצות. הוסף דף FAQ עם 20+ שאלות ותשובות רלוונטיות.", impact: "high" as const, type: "onsite" as const },
  { id: "2", title: "פרסם מאמרי השוואה", description: "צור מאמרי השוואה בין המוצר שלך למתחרים. תוכן כזה מצוטט לעתים קרובות על ידי AI בתשובות.", impact: "high" as const, type: "content" as const },
  { id: "3", title: "שפר נוכחות ב-G2 ו-Capterra", description: "הגדל את מספר הביקורות באתרי סקירות. ביקורות חיוביות משפיעות ישירות על המלצות AI.", impact: "medium" as const, type: "offsite" as const },
  { id: "4", title: "הוסף Schema Markup", description: "הוסף נתונים מובנים (structured data) לאתר שלך כדי לעזור ל-AI להבין טוב יותר את המוצר.", impact: "medium" as const, type: "technical" as const },
  { id: "5", title: "צור תוכן בבלוג על מגמות בתעשייה", description: "פרסם תוכן עדכני ורלוונטי שממצב אותך כמוביל דעה בתחום.", impact: "low" as const, type: "content" as const },
];

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
              <p className="text-sm text-muted-foreground">מדידת המותג בתשובות ChatGPT ומנועי AI — חלק ממחלקת SEO</p>
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
                הוסף מותג, ביטויי מפתח ומתחרים. אחר כך ייצר פרומפטים והפעל סריקה כדי לראות אם מנועי AI ממליצים עליכם.
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
  onBack,
  onUpdate,
}: {
  project: AiDetectionBrand;
  onBack: () => void;
  onUpdate: (data: ProjectFormData) => void;
}) {
  const {
    prompts, results, scores, currentScore, previousScore,
    isScanning, isGenerating,
    addPrompt, editPrompt, deletePrompt, generatePrompts, runScan,
    getPromptResults, getCompetitorScores,
  } = useAiDetectionProject(project.id);

  const trackedPrompts: TrackedPrompt[] = prompts.map((p) => {
    const pr = getPromptResults(p.id);
    const latestScan = Object.values(pr).sort((a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime())[0];
    const sentiments = Object.values(pr).map((r) => r.sentiment).filter(Boolean);
    const sentiment = sentiments.includes("positive") ? "positive" : sentiments.includes("negative") ? "negative" : sentiments.length > 0 ? "neutral" : null;
    return {
      id: p.id,
      prompt: p.prompt,
      category: p.category,
      lastChecked: latestScan ? formatDistanceToNow(new Date(latestScan.scanned_at), { addSuffix: true, locale: he }) : "טרם נסרק",
      platforms: {
        chatgpt: pr["chatgpt"]?.is_mentioned || false,
        gemini: pr["gemini"]?.is_mentioned || false,
        perplexity: pr["perplexity"]?.is_mentioned || false,
      },
      position: Object.values(pr).find((r) => r.position)?.position || null,
      sentiment: sentiment as TrackedPrompt["sentiment"],
    };
  });

  const platformBreakdown = ["chatgpt", "gemini", "perplexity"].map((p) => {
    const names: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity" };
    const icons: Record<string, string> = { chatgpt: "🤖", gemini: "✨", perplexity: "🔍" };
    const pResults = results.filter((r) => r.platform === p);
    const latestByPrompt: Record<string, typeof pResults[0]> = {};
    for (const r of pResults) {
      if (!latestByPrompt[r.prompt_id] || new Date(r.scanned_at) > new Date(latestByPrompt[r.prompt_id].scanned_at)) latestByPrompt[r.prompt_id] = r;
    }
    const latest = Object.values(latestByPrompt);
    const mentions = latest.filter((r) => r.is_mentioned).length;
    const total = latest.length || prompts.length || 1;
    return { name: names[p], score: total > 0 ? Math.round((mentions / total) * 100) : 0, mentions, total, icon: icons[p], color: "" };
  });

  const trendData = scores.map((s) => ({
    date: new Date(s.week_start).toLocaleDateString("he-IL", { month: "short", day: "numeric" }),
    score: s.score, chatgpt: s.chatgpt_score || 0, gemini: s.gemini_score || 0, perplexity: s.perplexity_score || 0,
  }));

  const citations = (() => {
    const map: Record<string, number> = {};
    for (const r of results) {
      if (r.citations) for (const url of r.citations) {
        const domain = url.replace(/https?:\/\//, "").split("/")[0];
        map[domain] = (map[domain] || 0) + 1;
      }
    }
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 10).map(([domain, count], i) => ({
      id: String(i), source: domain, url: domain, mentions: count,
      influence: (count > 10 ? "high" : count > 5 ? "medium" : "low") as "high" | "medium" | "low",
      type: "blog" as const,
    }));
  })();

  const totalMentions = results.filter((r) => r.is_mentioned).length;
  const avgPosition = (() => {
    const positions = results.filter((r) => r.position).map((r) => r.position!);
    return positions.length > 0 ? Math.round(positions.reduce((a, b) => a + b, 0) / positions.length) : 0;
  })();

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
                    {project.keywords.slice(0, 3).map((kw) => <Badge key={kw} variant="outline" className="text-xs">{kw}</Badge>)}
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

        <Tabs defaultValue="overview" dir="rtl">
          <TabsList>
            <TabsTrigger value="overview">סקירה כללית</TabsTrigger>
            <TabsTrigger value="prompts">פרומפטים ({prompts.length})</TabsTrigger>
            <TabsTrigger value="history">היסטוריית סריקות</TabsTrigger>
            <TabsTrigger value="competitors">מתחרים</TabsTrigger>
            <TabsTrigger value="citations">ציטוטים</TabsTrigger>
            <TabsTrigger value="recommendations">המלצות</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            {scores.length === 0 && prompts.length === 0 ? (
              <Card>
                <CardContent className="space-y-3 py-12 pt-6 text-center">
                  <Radar className="mx-auto h-10 w-10 text-muted-foreground" />
                  <h3 className="font-semibold">הפרויקט מוכן</h3>
                  <p className="mx-auto max-w-md text-sm text-muted-foreground">
                    הוסף פרומפטים (או ייצר אותם אוטומטית) והפעל סריקה כדי לראות אם המותג מוזכר במנועי AI.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <StatsCards totalPrompts={prompts.length} totalMentions={totalMentions} totalCitations={citations.length} avgPosition={avgPosition} />
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <AiVisibilityScore score={currentScore?.score || 0} previousScore={previousScore?.score || 0} totalPrompts={currentScore?.total_prompts || prompts.length} mentionedPrompts={currentScore?.mentioned_prompts || 0} />
                  <PlatformBreakdown platforms={platformBreakdown} />
                </div>
                {trendData.length > 0 && <TrendChart data={trendData} />}
              </>
            )}
          </TabsContent>

          <TabsContent value="prompts" className="mt-6">
            <PromptTracker
              prompts={trackedPrompts}
              onAddPrompt={(prompt, category) => addPrompt.mutate({ prompt, category })}
              onDeletePrompt={(promptId) => deletePrompt.mutate(promptId)}
              onEditPrompt={(promptId, prompt, category) => editPrompt.mutate({ promptId, prompt, category })}
              onAutoGenerate={() => generatePrompts(project)}
              isGenerating={isGenerating}
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
            {citations.length > 0 ? <CitationSources citations={citations} /> : (
              <Card><CardContent className="py-8 pt-6 text-center text-muted-foreground"><p>הפעל סריקה כדי לגלות מקורות ציטוט</p></CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="recommendations" className="mt-6">
            <Recommendations recommendations={staticRecommendations} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

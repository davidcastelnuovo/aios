import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AiVisibilityScore } from "@/components/ai-detection/AiVisibilityScore";
import { PlatformBreakdown } from "@/components/ai-detection/PlatformBreakdown";
import { PromptTracker, TrackedPrompt } from "@/components/ai-detection/PromptTracker";
import { CompetitorAnalysis } from "@/components/ai-detection/CompetitorAnalysis";
import { CitationSources } from "@/components/ai-detection/CitationSources";
import { TrendChart } from "@/components/ai-detection/TrendChart";
import { StatsCards } from "@/components/ai-detection/StatsCards";
import { BrandSettings } from "@/components/ai-detection/BrandSettings";
import { Recommendations } from "@/components/ai-detection/Recommendations";
import { Eye, Loader2, Radar, AlertCircle } from "lucide-react";
import { useAiDetection } from "@/hooks/useAiDetection";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";

// Static recommendations (these don't come from DB)
const staticRecommendations = [
  {
    id: "1", title: "הוסף דף FAQ מקיף לאתר",
    description: "מודלי AI מעדיפים מקורות עם תשובות מובנות לשאלות נפוצות. הוסף דף FAQ עם 20+ שאלות ותשובות רלוונטיות.",
    impact: "high" as const, type: "onsite" as const,
  },
  {
    id: "2", title: "פרסם מאמרי השוואה",
    description: "צור מאמרי השוואה בין המוצר שלך למתחרים. תוכן כזה מצוטט לעתים קרובות על ידי AI בתשובות.",
    impact: "high" as const, type: "content" as const,
  },
  {
    id: "3", title: "שפר נוכחות ב-G2 ו-Capterra",
    description: "הגדל את מספר הביקורות באתרי סקירות. ביקורות חיוביות משפיעות ישירות על המלצות AI.",
    impact: "medium" as const, type: "offsite" as const,
  },
  {
    id: "4", title: "הוסף Schema Markup",
    description: "הוסף נתונים מובנים (structured data) לאתר שלך כדי לעזור ל-AI להבין טוב יותר את המוצר.",
    impact: "medium" as const, type: "technical" as const,
  },
  {
    id: "5", title: "צור תוכן בבלוג על מגמות בתעשייה",
    description: "פרסם תוכן עדכני ורלוונטי שממצב אותך כמוביל דעה בתחום ה-CRM.",
    impact: "low" as const, type: "content" as const,
  },
];

export default function AiDetection() {
  const {
    brand,
    prompts,
    results,
    scores,
    currentScore,
    previousScore,
    isLoading,
    isScanning,
    saveBrand,
    addPrompt,
    runScan,
    getPromptResults,
    getCompetitorScores,
  } = useAiDetection();

  // Transform prompts to the PromptTracker format
  const trackedPrompts: TrackedPrompt[] = prompts.map((p) => {
    const promptResults = getPromptResults(p.id);
    const latestScan = Object.values(promptResults).sort(
      (a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime()
    )[0];

    // Determine overall sentiment from results
    const sentiments = Object.values(promptResults).map(r => r.sentiment).filter(Boolean);
    const sentiment = sentiments.includes("positive") ? "positive"
      : sentiments.includes("negative") ? "negative"
      : sentiments.length > 0 ? "neutral" : null;

    return {
      id: p.id,
      prompt: p.prompt,
      category: p.category,
      lastChecked: latestScan
        ? formatDistanceToNow(new Date(latestScan.scanned_at), { addSuffix: true, locale: he })
        : "טרם נסרק",
      platforms: {
        chatgpt: promptResults["chatgpt"]?.is_mentioned || false,
        gemini: promptResults["gemini"]?.is_mentioned || false,
        perplexity: promptResults["perplexity"]?.is_mentioned || false,
      },
      position: Object.values(promptResults).find(r => r.position)?.position || null,
      sentiment: sentiment as TrackedPrompt["sentiment"],
    };
  });

  // Build platform breakdown from results
  const buildPlatformBreakdown = () => {
    const platforms = ["chatgpt", "gemini", "perplexity"];
    const names: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity" };
    const icons: Record<string, string> = { chatgpt: "🤖", gemini: "✨", perplexity: "🔍" };

    return platforms.map((p) => {
      const platformResults = results.filter(r => r.platform === p);
      // Get only latest result per prompt
      const latestByPrompt: Record<string, typeof platformResults[0]> = {};
      for (const r of platformResults) {
        if (!latestByPrompt[r.prompt_id] || new Date(r.scanned_at) > new Date(latestByPrompt[r.prompt_id].scanned_at)) {
          latestByPrompt[r.prompt_id] = r;
        }
      }
      const latest = Object.values(latestByPrompt);
      const mentions = latest.filter(r => r.is_mentioned).length;
      const total = latest.length || prompts.length;
      return {
        name: names[p],
        score: total > 0 ? Math.round((mentions / total) * 100) : 0,
        mentions,
        total,
        icon: icons[p],
        color: "",
      };
    });
  };

  // Build trend data from scores
  const trendData = scores.map((s) => ({
    date: new Date(s.week_start).toLocaleDateString("he-IL", { month: "short", day: "numeric" }),
    score: s.score,
    chatgpt: s.chatgpt_score || 0,
    gemini: s.gemini_score || 0,
    perplexity: s.perplexity_score || 0,
  }));

  // Build citation data from results
  const buildCitations = () => {
    const citationMap: Record<string, { count: number }> = {};
    for (const r of results) {
      if (r.citations) {
        for (const url of r.citations) {
          const domain = url.replace(/https?:\/\//, "").split("/")[0];
          citationMap[domain] = citationMap[domain] || { count: 0 };
          citationMap[domain].count++;
        }
      }
    }
    return Object.entries(citationMap)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([domain, data], i) => ({
        id: String(i),
        source: domain,
        url: domain,
        mentions: data.count,
        influence: (data.count > 10 ? "high" : data.count > 5 ? "medium" : "low") as "high" | "medium" | "low",
        type: "blog" as const,
      }));
  };

  // Stats
  const totalMentions = results.filter(r => r.is_mentioned).length;
  const citations = buildCitations();
  const avgPosition = (() => {
    const positions = results.filter(r => r.position).map(r => r.position!);
    return positions.length > 0 ? Math.round(positions.reduce((a, b) => a + b, 0) / positions.length) : 0;
  })();

  const handleAddPrompt = (prompt: string, category: string) => {
    addPrompt.mutate({ prompt, category });
  };

  const handleSaveSettings = (data: { brandName: string; keywords: string[]; competitors: string[] }) => {
    saveBrand.mutate(data);
  };

  // Empty state - no brand configured
  if (!isLoading && !brand) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Eye className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">AI Detection</h2>
            <p className="text-sm text-muted-foreground">ניטור נראות המותג שלך בתשובות AI</p>
          </div>
        </div>
        <Card className="max-w-lg mx-auto mt-12">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-semibold">הגדר את המותג שלך כדי להתחיל</h3>
            <p className="text-sm text-muted-foreground">
              כדי להתחיל לנטר את הנראות שלך בפלטפורמות AI, הגדר קודם את שם המותג, מילות המפתח והמתחרים שלך.
            </p>
            <BrandSettings
              brandName=""
              keywords={[]}
              competitors={[]}
              onSave={handleSaveSettings}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const platformBreakdown = buildPlatformBreakdown();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Eye className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">AI Detection</h2>
            <p className="text-sm text-muted-foreground">ניטור נראות המותג שלך בתשובות AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => runScan()}
            disabled={isScanning || prompts.length === 0}
            variant="default"
          >
            {isScanning ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                סורק...
              </>
            ) : (
              <>
                <Radar className="h-4 w-4 mr-1" />
                הפעל סריקה
              </>
            )}
          </Button>
          <BrandSettings
            brandName={brand?.brand_name || ""}
            keywords={brand?.keywords || []}
            competitors={brand?.competitor_names || []}
            onSave={handleSaveSettings}
          />
        </div>
      </div>

      <Tabs defaultValue="overview" dir="rtl">
        <TabsList>
          <TabsTrigger value="overview">סקירה כללית</TabsTrigger>
          <TabsTrigger value="prompts">פרומפטים</TabsTrigger>
          <TabsTrigger value="competitors">מתחרים</TabsTrigger>
          <TabsTrigger value="citations">ציטוטים</TabsTrigger>
          <TabsTrigger value="recommendations">המלצות</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCards
              totalPrompts={prompts.length}
              totalMentions={totalMentions}
              totalCitations={citations.length}
              avgPosition={avgPosition}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <AiVisibilityScore
              score={currentScore?.score || 0}
              previousScore={previousScore?.score || 0}
              totalPrompts={currentScore?.total_prompts || prompts.length}
              mentionedPrompts={currentScore?.mentioned_prompts || 0}
            />
            <PlatformBreakdown platforms={platformBreakdown} />
          </div>
          {trendData.length > 0 && <TrendChart data={trendData} />}
        </TabsContent>

        <TabsContent value="prompts" className="mt-6">
          <PromptTracker prompts={trackedPrompts} onAddPrompt={handleAddPrompt} />
        </TabsContent>

        <TabsContent value="competitors" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CompetitorAnalysis
              brandName={brand?.brand_name || ""}
              brandScore={currentScore?.score || 0}
              competitors={getCompetitorScores()}
            />
            <PlatformBreakdown platforms={platformBreakdown} />
          </div>
        </TabsContent>

        <TabsContent value="citations" className="mt-6">
          {citations.length > 0 ? (
            <CitationSources citations={citations} />
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <p>הפעל סריקה כדי לגלות מקורות ציטוט</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="mt-6">
          <Recommendations recommendations={staticRecommendations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

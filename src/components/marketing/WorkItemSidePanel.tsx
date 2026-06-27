import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Play, Loader2, Check, X, RotateCw, Image as ImageIcon, Megaphone, Search, AlertCircle, ChevronRight, Sparkles } from "lucide-react";
import { CampaignLauncher } from "./CampaignLauncher";
import { SEOPublishPanel } from "./SEOPublishPanel";
import { ABTestPanel } from "./ABTestPanel";

interface Props {
  itemId: string | null;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  queued: { label: "ממתין", variant: "outline" },
  running: { label: "רץ...", variant: "secondary" },
  awaiting_approval: { label: "ממתין לאישור", variant: "default" },
  completed: { label: "הושלם", variant: "secondary" },
  failed: { label: "נכשל", variant: "destructive" },
  cancelled: { label: "בוטל", variant: "outline" },
};

export function WorkItemSidePanel({ itemId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [item, setItem] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  const loadItem = async () => {
    if (!itemId) return;
    const { data } = await supabase.from("marketing_work_items").select("*").eq("id", itemId).single();
    setItem(data);
    if (data?.pipeline_id) {
      const { data: st } = await supabase
        .from("marketing_pipeline_stages")
        .select("id, name, stage_type, sort_order, agent_id, approval_mode, configuration")
        .eq("pipeline_id", data.pipeline_id)
        .order("sort_order");
      setStages(st ?? []);
    }
  };

  useEffect(() => {
    if (!itemId) {
      setItem(null);
      return;
    }
    loadItem();
  }, [itemId]);

  const { data: assets, refetch: refetchAssets } = useQuery({
    queryKey: ["marketing-assets", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_assets")
        .select("*, marketing_pipeline_stages(name, stage_type)")
        .eq("item_id", itemId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: runs, refetch: refetchRuns } = useQuery({
    queryKey: ["marketing-runs", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_runs")
        .select("*, marketing_pipeline_stages(name, stage_type)")
        .eq("item_id", itemId!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  // Realtime: refresh runs while something is running
  useEffect(() => {
    if (!itemId) return;
    const channel = supabase
      .channel(`marketing-runs-${itemId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marketing_runs", filter: `item_id=eq.${itemId}` },
        () => {
          refetchRuns();
          refetchAssets();
          loadItem();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [itemId]);

  const [activeAssetTab, setActiveAssetTab] = useState<string>("");
  const availableTypes = Object.keys(
    (assets ?? []).reduce((acc: Record<string, true>, a: any) => {
      acc[a.type] = true;
      return acc;
    }, {}),
  );
  useEffect(() => {
    if (availableTypes.length && !availableTypes.includes(activeAssetTab)) {
      setActiveAssetTab(availableTypes[0]);
    }
  }, [availableTypes.join("|")]);

  if (!itemId) return null;



  const save = async (patch: Partial<any>) => {
    setSaving(true);
    const { error } = await supabase.from("marketing_work_items").update(patch).eq("id", itemId);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    } else {
      setItem({ ...item, ...patch });
    }
    setSaving(false);
  };

  const runStage = async (stageId: string) => {
    setRunning(stageId);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-run-stage", {
        body: { item_id: itemId, stage_id: stageId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "✓ הופעל", description: "השלב הסתיים" });
      refetchRuns();
      refetchAssets();
      loadItem();
      queryClient.invalidateQueries({ queryKey: ["marketing-items-calendar"] });
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setRunning(null);
    }
  };

  const runFullPipeline = async () => {
    setRunning("ALL");
    try {
      const { data, error } = await supabase.functions.invoke("marketing-run-pipeline", {
        body: { item_id: itemId },
      });
      // Always refresh UI regardless of outcome
      refetchRuns();
      refetchAssets();
      loadItem();
      queryClient.invalidateQueries({ queryKey: ["marketing-items-calendar"] });
      if (error) throw error;
      if ((data as any)?.error) {
        toast({ title: "שגיאה בהרצת הפייפליין", description: (data as any).error, variant: "destructive" });
        return;
      }
      if ((data as any)?.awaiting_approval) {
        toast({ title: "⏸ ממתין לאישורך", description: "שלב הסתיים ומחכה לאישור להמשיך" });
        return;
      }
      if ((data as any)?.completed) {
        toast({ title: "✓ הפייפליין הושלם!", description: "כל השלבים הורצו בהצלחה" });
        return;
      }
      toast({ title: "✓ ה-Pipeline הופעל" });
    } catch (e: any) {
      // Still refresh even on error
      refetchRuns();
      refetchAssets();
      loadItem();
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setRunning(null);
    }
  };

  const approveRun = async (runId: string, stageId: string) => {
    await supabase.from("marketing_runs").update({ status: "completed" }).eq("id", runId);
    // advance to next stage
    const idx = stages.findIndex((s) => s.id === stageId);
    if (idx >= 0 && idx < stages.length - 1) {
      const nextStage = stages[idx + 1];
      await save({ current_stage_id: nextStage.id, status: "in_progress" });
      // Auto-run next stage if its approval_mode is "auto"
      if (nextStage.approval_mode === "auto") {
        setTimeout(() => runStage(nextStage.id), 500);
      }
    } else {
      // Last stage approved — mark item as completed
      await save({ status: "completed" });
    }
    refetchRuns();
    toast({ title: "✓ אושר" });
  };

  const rejectRun = async (runId: string) => {
    await supabase.from("marketing_runs").update({ status: "cancelled" }).eq("id", runId);
    refetchRuns();
  };

  // Group assets by type for tabbed preview
  const assetsByType: Record<string, any[]> = {};
  for (const a of assets ?? []) {
    (assetsByType[a.type] ??= []).push(a);
  }
  const TYPE_LABELS: Record<string, string> = {
    brief: "Brief",
    copy: "Copy",
    image: "קריאייטיב",
    data: "מדידה",
  };

  const stageHasAsset = (stageId: string) =>
    (assets ?? []).some((a: any) => a.stage_id === stageId);

  return (
    <Sheet open={!!itemId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="w-[600px] sm:max-w-none overflow-y-auto" dir="rtl">
        <SheetHeader>
          <SheetTitle className="text-right">{item?.title ?? "פריט תוכן"}</SheetTitle>
        </SheetHeader>
        {!item ? (
          <div className="py-8 text-center text-sm text-muted-foreground">טוען...</div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Hero: latest AI output */}
            {availableTypes.length > 0 ? (
              <div className="rounded-lg border bg-card p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Label className="text-sm font-semibold">מה שקרמן הכינה</Label>
                  <Badge variant="secondary" className="text-[10px]">
                    {(assets ?? []).length} תוצרים
                  </Badge>
                </div>
                {availableTypes.length > 1 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {availableTypes.map((t) => (
                      <Button
                        key={t}
                        size="sm"
                        variant={activeAssetTab === t ? "default" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => setActiveAssetTab(t)}
                      >
                        {TYPE_LABELS[t] ?? t}
                        <span className="ms-1 opacity-60">({assetsByType[t].length})</span>
                      </Button>
                    ))}
                  </div>
                )}
                <div className="space-y-3">
                  {(assetsByType[activeAssetTab] ?? []).map((a: any) => (
                    <div key={a.id} className="rounded-md border bg-background p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">
                          {TYPE_LABELS[a.type] ?? a.type}
                        </Badge>
                        <span>{a.marketing_pipeline_stages?.name ?? ""}</span>
                        <span className="ms-auto">
                          {new Date(a.created_at).toLocaleString("he-IL")}
                        </span>
                      </div>
                      {a.url && (
                        <a href={a.url} target="_blank" rel="noopener" className="block">
                          <img
                            src={a.url}
                            alt="asset"
                            className="max-h-72 w-full rounded object-cover"
                          />
                        </a>
                      )}
                      {a.content && (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {a.content}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                עוד לא נוצר תוכן. הפעילי שלב או את כל ה-Pipeline למטה.
              </div>
            )}

            {/* Awaiting approval — prominent banner */}
            {(() => {
              const pendingRuns = (runs ?? []).filter((r: any) => r.status === "awaiting_approval");
              if (pendingRuns.length === 0) return null;
              return (
                <div className="rounded-xl border-2 border-amber-400 bg-gradient-to-b from-amber-50 to-amber-50/40 shadow-md overflow-hidden">
                  {/* Banner header */}
                  <div className="flex items-center gap-2 bg-amber-400/20 px-4 py-2.5 border-b border-amber-300">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-sm font-bold text-amber-800">נדרש אישורך להמשך</span>
                    <span className="ms-auto rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      {pendingRuns.length} ממתינים
                    </span>
                  </div>
                  {/* Each pending run */}
                  <div className="divide-y divide-amber-200/60">
                    {pendingRuns.map((r: any) => {
                      const stageName = r.marketing_pipeline_stages?.name ?? "שלב";
                      const nextStageIdx = stages.findIndex((s: any) => s.id === r.stage_id);
                      const nextStageName = nextStageIdx >= 0 && nextStageIdx < stages.length - 1
                        ? stages[nextStageIdx + 1]?.name
                        : null;
                      return (
                        <div key={r.id} className="px-4 py-3">
                          <div className="mb-2 flex items-center gap-1.5 text-sm">
                            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                            <span className="font-medium text-amber-900">{stageName}</span>
                            {nextStageName && (
                              <>
                                <ChevronRight className="h-3 w-3 text-amber-400" />
                                <span className="text-amber-600 text-xs">{nextStageName}</span>
                              </>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                              onClick={() => approveRun(r.id, r.stage_id)}
                            >
                              <Check className="ml-1 h-3.5 w-3.5" />
                              {nextStageName ? `אשר ועבור ל${nextStageName}` : "אשר וסיים"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-amber-300 hover:bg-amber-100"
                              onClick={() => runStage(r.stage_id)}
                              title="הרץ מחדש"
                            >
                              <RotateCw className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:bg-red-50"
                              onClick={() => rejectRun(r.id)}
                              title="דחה"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* AB Test Panel — shown for copy stage */}
            {(() => {
              const currentStage = stages.find((s) => s.id === item?.current_stage_id);
              if (currentStage?.stage_type === "copy") {
                const brief = item.payload?.brief_text ?? item.payload?.notes ?? item.title ?? "";
                // Infer channel from pipeline track (stored in item payload or default to meta)
                const channel = item.payload?.channel ?? "meta";
                return (
                  <ABTestPanel
                    workItemId={item.id}
                    tenantId={item.tenant_id}
                    brief={brief}
                    channel={channel}
                    onVariantSelected={(variant) => {
                      // Advance to next stage after selecting winner
                      const idx = stages.findIndex((s) => s.id === item.current_stage_id);
                      if (idx >= 0 && idx < stages.length - 1) {
                        const nextStage = stages[idx + 1];
                        save({ current_stage_id: nextStage.id, status: "in_progress" });
                      }
                      loadItem();
                    }}
                  />
                );
              }
              return null;
            })()}

            {/* Campaign Launcher — shown for target_paid stage */}
            {(() => {
              const currentStage = stages.find((s) => s.id === item?.current_stage_id);
              if (currentStage?.stage_type === "target_paid") {
                return (
                  <CampaignLauncher
                    workItemId={item.id}
                    tenantId={item.tenant_id}
                    clientId={item.client_id}
                    copyText={item.payload?.copy_text}
                    imageUrl={item.payload?.image_url}
                    campaignName={item.title}
                  />
                );
              }
              if (currentStage?.stage_type === "target_seo") {
                return (
                  <SEOPublishPanel
                    workItemId={item.id}
                    tenantId={item.tenant_id}
                    clientId={item.client_id}
                    copyText={item.payload?.copy_text}
                    title={item.title}
                  />
                );
              }
              return null;
            })()}

            {/* Run pipeline button */}
            <Button onClick={runFullPipeline} disabled={!!running} className="w-full">
              {running === "ALL" ? (
                <Loader2 className="ml-1 h-4 w-4 animate-spin" />
              ) : (
                <Play className="ml-1 h-4 w-4" />
              )}
              הפעל את כל ה-Pipeline
            </Button>

            {/* Stage-by-stage runner */}
            <div>
              <Label className="mb-2 block">הרצת שלבים</Label>
              <div className="space-y-1.5">
                {stages.map((s) => {
                  const lastRun = (runs ?? []).find((r: any) => r.stage_id === s.id);
                  const hasAsset = stageHasAsset(s.id);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 rounded-md border bg-muted/20 p-2"
                    >
                      {hasAsset && <Check className="h-3.5 w-3.5 text-green-600" />}
                      <span className="flex-1 text-sm">{s.name}</span>
                      {lastRun && (
                        <Badge variant={STATUS_LABELS[lastRun.status]?.variant ?? "outline"}>
                          {STATUS_LABELS[lastRun.status]?.label ?? lastRun.status}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!!running}
                        onClick={() => runStage(s.id)}
                        title="הפעל שלב זה"
                      >
                        {running === s.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Collapsed metadata form */}
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">פרטי הפריט</summary>
              <div className="mt-3 space-y-3">
                <div>
                  <Label>כותרת</Label>
                  <Input
                    defaultValue={item.title ?? ""}
                    onBlur={(e) => save({ title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>תאריך פרסום מתוכנן</Label>
                  <Input
                    type="date"
                    defaultValue={item.scheduled_date ?? ""}
                    onBlur={(e) => save({ scheduled_date: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label>שלב נוכחי</Label>
                  <Select
                    value={item.current_stage_id ?? ""}
                    onValueChange={(v) => save({ current_stage_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>הערות</Label>
                  <Textarea
                    rows={3}
                    defaultValue={item.payload?.notes ?? ""}
                    onBlur={(e) =>
                      save({ payload: { ...(item.payload ?? {}), notes: e.target.value } })
                    }
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {saving ? "שומר..." : "שינויים נשמרים אוטומטית"}
                </div>
              </div>
            </details>

            {/* Recent runs / token usage */}
            {(runs ?? []).length > 0 && (
              <details className="rounded-md border p-2">
                <summary className="cursor-pointer text-sm font-medium">
                  היסטוריית ריצות ושימוש בטוקנים
                </summary>
                <div className="mt-2 space-y-1 text-xs">
                  {(runs ?? []).map((r: any) => (
                    <div key={r.id} className="flex items-center gap-2">
                      <Badge
                        variant={STATUS_LABELS[r.status]?.variant ?? "outline"}
                        className="text-[10px]"
                      >
                        {STATUS_LABELS[r.status]?.label ?? r.status}
                      </Badge>
                      <span>{r.marketing_pipeline_stages?.name}</span>
                      <span className="ms-auto text-muted-foreground">
                        {(r.tokens_in ?? 0) + (r.tokens_out ?? 0)} tok · $
                        {Number(r.cost_usd ?? 0).toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

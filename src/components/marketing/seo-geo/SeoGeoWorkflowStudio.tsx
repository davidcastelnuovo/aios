import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { he } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { isEntryApproved } from "@/lib/seoGeoCalendar";
import { materializeApprovedPlan, writePlannedArticles } from "@/lib/seoGeoExecutePlan";
import { GENERATION_LABELS, SOURCE_LABELS, heIntent, hePriority } from "@/lib/seoGeoLabels";
import { seoGeoDb, type SeoGeoCalendarEntry, type SeoGeoKeyword } from "@/lib/seoGeoDb";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquare,
  Rocket,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { SeoGeoArticlePreviewDialog } from "./SeoGeoArticlePreviewDialog";

type WorkItem = { id: string; title: string | null; payload: Record<string, unknown> | null; client_id: string | null };

export function SeoGeoWorkflowStudio({
  workItem,
  tenantId,
  clientId,
  onPlanRefresh,
  strategyPanel,
}: {
  workItem: WorkItem;
  tenantId: string;
  clientId: string;
  onPlanRefresh: () => void;
  strategyPanel?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [previewEntry, setPreviewEntry] = useState<SeoGeoCalendarEntry | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatLog, setChatLog] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [pipelineLabel, setPipelineLabel] = useState<string | null>(null);

  const programKey = ["seo-geo-program", workItem.id];
  const keywordsKey = ["seo-geo-keywords", workItem.id];
  const entriesKey = ["seo-geo-entries", workItem.id];

  const { data: program, isLoading: loadingProgram } = useQuery({
    queryKey: programKey,
    queryFn: async () => {
      const { data, error } = await seoGeoDb.from("seo_geo_programs").select("*").eq("work_item_id", workItem.id).maybeSingle();
      if (error) throw error;
      if (data) return data;
      const { data: created, error: insertError } = await seoGeoDb.from("seo_geo_programs").insert({
        tenant_id: tenantId,
        client_id: clientId,
        work_item_id: workItem.id,
        auto_approve: false,
        horizon_months: 3,
      }).select("*").single();
      if (insertError) throw insertError;
      return created;
    },
  });

  const { data: wpSites = [] } = useQuery({
    queryKey: ["seo-geo-wp-sites", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("social_media_wordpress_sites").select("id,site_url,site_name").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: keywords = [], isLoading: loadingKeywords } = useQuery({
    queryKey: keywordsKey,
    queryFn: async () => {
      const { data, error } = await seoGeoDb.from("seo_geo_keywords").select("*").eq("work_item_id", workItem.id).order("sort_order");
      if (error) throw error;
      return (data ?? []) as SeoGeoKeyword[];
    },
  });

  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: entriesKey,
    queryFn: async () => {
      const { data, error } = await seoGeoDb.from("seo_geo_calendar_entries").select("*").eq("work_item_id", workItem.id).order("scheduled_date");
      if (error) throw error;
      return (data ?? []) as SeoGeoCalendarEntry[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: programKey });
    qc.invalidateQueries({ queryKey: keywordsKey });
    qc.invalidateQueries({ queryKey: entriesKey });
  };

  const runGanttAndWrite = async (articleLimit: number) => {
    if (!planApproved) {
      toast.error("אשרי את תוכנית התוכן לפני הגאנט");
      return;
    }
    setPipelineLabel("מכניסה לגאנט");
    try {
      const stats = await materializeApprovedPlan(workItem.id);
      const writing = await writePlannedArticles(workItem.id, articleLimit, (title) => setPipelineLabel(`כותבת: ${title}`));
      toast.success(`${stats.keywords} ביטויים · ${stats.entries} בגאנט · נכתבו ${writing.written}${writing.remaining ? ` · נשארו ${writing.remaining}` : ""}`);
      invalidate();
      onPlanRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "גאנט או כתיבה נכשלו");
    } finally {
      setPipelineLabel(null);
    }
  };

  const updateProgram = async (patch: Record<string, unknown>) => {
    const { error } = await seoGeoDb.from("seo_geo_programs").update(patch).eq("work_item_id", workItem.id);
    if (error) throw error;
    invalidate();
  };

  const toggleKeyword = async (row: SeoGeoKeyword, promoted: boolean) => {
    const { error } = await seoGeoDb.from("seo_geo_keywords").update({ promoted }).eq("id", row.id);
    if (error) toast.error(error.message);
    else invalidate();
  };

  const setApproval = async (entry: SeoGeoCalendarEntry, status: "pending" | "approved") => {
    const { error } = await seoGeoDb.from("seo_geo_calendar_entries").update({
      approval_status: status,
      approved_at: status === "approved" ? new Date().toISOString() : null,
      approved_by_carmen: false,
    }).eq("id", entry.id);
    if (error) toast.error(error.message);
    else invalidate();
  };

  const generateEntry = async (entryId: string) => {
    setPipelineLabel("כותבת מאמר");
    try {
      const { data, error } = await supabase.functions.invoke("marketing-seo-generate-entry", { body: { entry_id: entryId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("כרמן כתבה טיוטה");
      invalidate();
    } finally {
      setPipelineLabel(null);
    }
  };

  const publishDue = async (entryId?: string) => {
    const { data, error } = await supabase.functions.invoke("marketing-seo-publish-due", {
      body: entryId ? { entry_id: entryId } : { work_item_id: workItem.id },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    toast.success(`פורסמו ${data.published ?? 0} מאמרים`);
    invalidate();
  };

  const monthKey = format(month, "yyyy-MM");
  const monthEntries = useMemo(
    () => entries.filter((e) => e.scheduled_date.startsWith(monthKey)).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)),
    [entries, monthKey],
  );
  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }), [month]);
  const byDay = useMemo(() => {
    const map = new Map<string, SeoGeoCalendarEntry[]>();
    for (const entry of entries) {
      const key = entry.scheduled_date.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return map;
  }, [entries]);

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatLog((prev) => [...prev, { role: "user", text: msg }]);
    setChatBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-seo-chat", { body: { work_item_id: workItem.id, message: msg } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setChatLog((prev) => [...prev, { role: "assistant", text: data.reply }]);
      if (data.actions?.length) invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "צ'אט נכשל");
    } finally {
      setChatBusy(false);
    }
  };

  const hasPlan = !!(workItem.payload?.seo_plan);
  const planApproved = String(workItem.payload?.seo_plan_status ?? "") === "approved";

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]" dir="rtl">
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex flex-col gap-2 border-b bg-card/60 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-4">
          <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
            <Label className="text-xs shrink-0">אתר WordPress</Label>
            <Select
              value={program?.wordpress_site_id ?? ""}
              onValueChange={(v) => updateProgram({ wordpress_site_id: v || null }).catch((e) => toast.error(String(e)))}
            >
              <SelectTrigger className="h-9 w-full min-w-0 sm:h-8 sm:w-52"><SelectValue placeholder="בחר אתר" /></SelectTrigger>
              <SelectContent>
                {wpSites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.site_name || s.site_url}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
            <Switch
              checked={!!program?.auto_approve}
              disabled={loadingProgram}
              onCheckedChange={(checked) => updateProgram({ auto_approve: checked }).catch((e) => toast.error(String(e)))}
            />
            <Label className="text-xs">אישור אוטומטי (כרמן)</Label>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={!hasPlan || !planApproved || !!pipelineLabel}
            onClick={() => runGanttAndWrite(2)}
          >
            {pipelineLabel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5" />}
            {pipelineLabel ?? "בנה גאנט מחדש וכתוב 2"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={!!pipelineLabel || !entries.some((e) => isEntryApproved(e.approval_status) && e.generation_status === "planned")}
            onClick={async () => {
              setPipelineLabel("כותבת מאמרים");
              try {
                const writing = await writePlannedArticles(workItem.id, 12, (title) => setPipelineLabel(`כותבת: ${title}`));
                toast.success(writing.written ? `נכתבו ${writing.written} מאמרים` : "אין מאמרים שממתינים לכתיבה");
                invalidate();
              } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "כתיבה נכשלה");
              } finally {
                setPipelineLabel(null);
              }
            }}
          >
            <WandSparkles className="h-3.5 w-3.5" />כתוב את כל המאושרים
          </Button>
          <Button size="sm" variant="outline" className="col-span-full w-full sm:col-span-1 sm:w-auto" onClick={() => publishDue()}><Rocket className="h-3.5 w-3.5" />פרסם מוכנים ל-WP</Button>
          </div>
        </div>

        <Tabs defaultValue="strategy" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-3 mt-2 flex h-auto w-[calc(100%-1.5rem)] flex-wrap justify-start gap-1 sm:mx-4 sm:w-fit" dir="rtl">
            <TabsTrigger value="strategy" className="flex-1 text-xs sm:flex-none sm:text-sm">בריף ותוכנית</TabsTrigger>
            <TabsTrigger value="keywords" className="flex-1 text-xs sm:flex-none sm:text-sm">ביטויים ({keywords.length})</TabsTrigger>
            <TabsTrigger value="gantt" className="flex-1 text-xs sm:flex-none sm:text-sm">גאנט ({entries.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="keywords" className="mt-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full p-4">
              {loadingKeywords ? <Loader2 className="mx-auto animate-spin" /> : (
                <div className="space-y-2">
                  {keywords.length === 0 ? <p className="text-sm text-muted-foreground">אין ביטויים — בנה תוכנית או סנכרן מ-Ahrefs/מעקב בצ&apos;אט.</p> : null}
                  {keywords.map((k) => (
                    <Card key={k.id} className="flex items-center gap-3 p-3">
                      <Checkbox checked={k.promoted} onCheckedChange={(v) => toggleKeyword(k, !!v)} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">{k.keyword}</div>
                        <div className="text-[10px] text-muted-foreground">{SOURCE_LABELS[k.source] ?? k.source} · {heIntent(k.intent) || "—"} · {k.evidence ?? ""}</div>
                      </div>
                      <Badge variant="outline">{hePriority(k.priority)}</Badge>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="gantt" className="mt-0 flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <Button variant="ghost" size="icon" aria-label="חודש קודם" onClick={() => setMonth(subMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
              <span className="text-sm font-bold">{format(month, "MMMM yyyy", { locale: he })}</span>
              <Button variant="ghost" size="icon" aria-label="חודש הבא" onClick={() => setMonth(addMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            </div>
            {loadingEntries ? (
              <Loader2 className="m-auto animate-spin" />
            ) : (
              <>
                <div className="space-y-2 p-3 lg:hidden">
                  {monthEntries.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">אין פריטים בחודש זה</p>
                  ) : (
                    monthEntries.map((entry) => (
                      <Card key={entry.id} className="p-3">
                        <div className="mb-2 text-xs font-medium text-muted-foreground">{entry.scheduled_date}</div>
                        <GanttChip
                          entry={entry}
                          compact={false}
                          onApprove={() => setApproval(entry, "approved")}
                          onRevoke={() => setApproval(entry, "pending")}
                          onGenerate={() => generateEntry(entry.id).catch((e) => toast.error(e.message))}
                          onPreview={() => setPreviewEntry(entry)}
                          onPublish={() => publishDue(entry.id).catch((e) => toast.error(e.message))}
                        />
                      </Card>
                    ))
                  )}
                </div>
                <ScrollArea className="hidden flex-1 lg:block">
                  <div className="grid min-w-[640px] grid-cols-7 gap-1 p-3" dir="rtl">
                    {["א", "ב", "ג", "ד", "ה", "ו", "ש"].map((label) => (
                      <div key={label} className="px-1 text-center text-[10px] font-semibold text-muted-foreground">{label}</div>
                    ))}
                    {Array.from({ length: startOfMonth(month).getDay() }).map((_, index) => (
                      <div key={`pad-${index}`} className="min-h-24 rounded-lg bg-muted/20" />
                    ))}
                    {days.map((day) => {
                      const key = format(day, "yyyy-MM-dd");
                      const dayEntries = byDay.get(key) ?? [];
                      return (
                        <div key={key} className={cn("min-h-24 rounded-lg border p-1", isSameDay(day, new Date()) && "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20")}>
                          <div className="text-[10px] font-medium text-muted-foreground">{format(day, "d")}</div>
                          <div className="mt-1 space-y-1">
                            {dayEntries.map((entry) => (
                              <GanttChip
                                key={entry.id}
                                entry={entry}
                                compact
                                onApprove={() => setApproval(entry, "approved")}
                                onRevoke={() => setApproval(entry, "pending")}
                                onGenerate={() => generateEntry(entry.id).catch((e) => toast.error(e.message))}
                                onPreview={() => setPreviewEntry(entry)}
                                onPublish={() => publishDue(entry.id).catch((e) => toast.error(e.message))}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            )}
          </TabsContent>

          <TabsContent value="strategy" className="mt-0 flex-1 overflow-auto p-2">
            {strategyPanel ?? <p className="p-4 text-sm text-muted-foreground">בנה תוכנית עם כרמן מהכפתור למעלה.</p>}
          </TabsContent>
        </Tabs>
      </div>

      <aside className="flex max-h-[min(420px,50dvh)] min-h-0 flex-col border-t bg-card/80 lg:max-h-none lg:border-s lg:border-t-0">
        <div className="border-b p-3">
          <div className="flex items-center gap-2 text-sm font-bold"><MessageSquare className="h-4 w-4 text-emerald-600" />כרמן SEO/GEO</div>
          <p className="text-[10px] text-muted-foreground">אישור, גאנט, מחקר, שכתוב — כמו ידני</p>
        </div>
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-2">
            {chatLog.map((line, i) => (
              <div key={i} className={cn("rounded-lg p-2 text-xs leading-relaxed", line.role === "user" ? "me-6 bg-muted" : "ms-6 bg-emerald-50 dark:bg-emerald-950/30")}>{line.text}</div>
            ))}
          </div>
        </ScrollArea>
        <div className="border-t p-3">
          <Textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="לדוגמה: סנכרן ביטויים ממעקב, אשרי הכל, הכנס לגאנט..." className="min-h-20 text-sm" />
          <Button className="mt-2 w-full gap-2 bg-emerald-600" disabled={chatBusy} onClick={sendChat}>
            {chatBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}שלח
          </Button>
        </div>
      </aside>

      <SeoGeoArticlePreviewDialog entry={previewEntry} open={!!previewEntry} onClose={() => setPreviewEntry(null)} onSaved={invalidate} />
    </div>
  );
}

function GanttChip({
  entry,
  compact = false,
  onApprove,
  onRevoke,
  onGenerate,
  onPreview,
  onPublish,
}: {
  entry: SeoGeoCalendarEntry;
  compact?: boolean;
  onApprove: () => void;
  onRevoke: () => void;
  onGenerate: () => void;
  onPreview: () => void;
  onPublish: () => void;
}) {
  const approved = isEntryApproved(entry.approval_status);
  return (
    <div className={cn("rounded border bg-background leading-tight", compact ? "p-1 text-[9px]" : "p-2 text-xs")}>
      <div className={cn("font-semibold", compact ? "truncate" : "")}>{entry.title}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        <Badge variant="outline" className={cn(compact ? "h-4 px-1 text-[8px]" : "text-[10px]", approved ? "border-emerald-500 text-emerald-700" : "border-amber-400 text-amber-700")}>
          {entry.approval_status === "auto_approved" ? "אושר (כרמן)" : approved ? "אושר" : "לא אושר"}
        </Badge>
        <Badge variant="secondary" className={compact ? "h-4 px-1 text-[8px]" : "text-[10px]"}>{GENERATION_LABELS[entry.generation_status] ?? entry.generation_status}</Badge>
      </div>
      <div className={cn("mt-1 flex flex-wrap gap-2", compact && "gap-0.5")}>
        {!approved ? (
          <button type="button" className="text-emerald-600 underline" onClick={onApprove}>אשר</button>
        ) : (
          <button type="button" className="text-muted-foreground underline" onClick={onRevoke}>בטל</button>
        )}
        <button type="button" className="underline" onClick={onPreview}>פריוויו</button>
        {approved && entry.generation_status === "planned" ? (
          <button type="button" className="text-violet-600 underline" onClick={onGenerate}><WandSparkles className="inline h-2.5 w-2.5" />כתוב</button>
        ) : null}
        {entry.generation_status === "draft" ? (
          <button type="button" className="text-blue-600 underline" onClick={onPublish}>פרסם</button>
        ) : null}
        {entry.live_url ? (
          <a href={entry.live_url} target="_blank" rel="noreferrer" className="text-emerald-700 underline"><CheckCircle2 className="inline h-2.5 w-2.5" /></a>
        ) : null}
      </div>
    </div>
  );
}

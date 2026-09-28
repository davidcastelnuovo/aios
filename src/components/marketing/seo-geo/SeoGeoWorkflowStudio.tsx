import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { seoGeoDb, type SeoGeoCalendarEntry, type SeoGeoKeyword } from "@/lib/seoGeoDb";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
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

  const materialize = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("marketing-seo-materialize", { body: { work_item_id: workItem.id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`גאנט: ${data.entries} מאמרים, ${data.keywords} ביטויים`);
      invalidate();
      onPlanRefresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
    const { data, error } = await supabase.functions.invoke("marketing-seo-generate-entry", { body: { entry_id: entryId } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    toast.success("כרמן כתבה טיוטה");
    invalidate();
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
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b bg-card/60 px-4 py-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs">אתר WordPress</Label>
            <Select
              value={program?.wordpress_site_id ?? ""}
              onValueChange={(v) => updateProgram({ wordpress_site_id: v || null }).catch((e) => toast.error(String(e)))}
            >
              <SelectTrigger className="h-8 w-52"><SelectValue placeholder="בחר אתר" /></SelectTrigger>
              <SelectContent>
                {wpSites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.site_name || s.site_url}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={!!program?.auto_approve}
              disabled={loadingProgram}
              onCheckedChange={(checked) => updateProgram({ auto_approve: checked }).catch((e) => toast.error(String(e)))}
            />
            <Label className="text-xs">אישור אוטומטי (כרמן)</Label>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!hasPlan || !planApproved || materialize.isPending}
            onClick={() => {
              if (!planApproved) {
                toast.error("אשר תוכנית תוכן בלשונית אסטרטגיה לפני הגאנט");
                return;
              }
              materialize.mutate();
            }}
            className="gap-1"
          >
            {materialize.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5" />}
            הכנס תוכנית לגאנט
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!entries.some((e) => isEntryApproved(e.approval_status) && e.generation_status === "planned")}
            onClick={async () => {
              const targets = entries.filter((e) => isEntryApproved(e.approval_status) && e.generation_status === "planned");
              for (const row of targets) {
                try {
                  await generateEntry(row.id);
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "כתיבה נכשלה");
                  break;
                }
              }
            }}
            className="gap-1"
          >
            <WandSparkles className="h-3.5 w-3.5" />כתבי כל המאושרים
          </Button>
          <Button size="sm" variant="outline" onClick={() => publishDue()} className="gap-1"><Rocket className="h-3.5 w-3.5" />פרסם מוכנים ל-WP</Button>
        </div>

        <Tabs defaultValue="gantt" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-4 mt-2 w-fit">
            <TabsTrigger value="gantt">גאנט תוכן</TabsTrigger>
            <TabsTrigger value="keywords">ביטויים לקידום</TabsTrigger>
            <TabsTrigger value="strategy">אסטרטגיה</TabsTrigger>
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
                        <div className="text-[10px] text-muted-foreground">{k.source} · {k.intent ?? "—"} · {k.evidence ?? ""}</div>
                      </div>
                      <Badge variant="outline">{k.priority ?? "medium"}</Badge>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="gantt" className="mt-0 flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <Button variant="ghost" size="icon" onClick={() => setMonth(subMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
              <span className="text-sm font-bold">{format(month, "MMMM yyyy", { locale: he })}</span>
              <Button variant="ghost" size="icon" onClick={() => setMonth(addMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            </div>
            {loadingEntries ? (
              <Loader2 className="m-auto animate-spin" />
            ) : (
              <ScrollArea className="flex-1">
                <div className="grid grid-cols-7 gap-1 p-3">
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
            )}
          </TabsContent>

          <TabsContent value="strategy" className="mt-0 flex-1 overflow-auto p-2">
            {strategyPanel ?? <p className="p-4 text-sm text-muted-foreground">בנה תוכנית עם כרמן מהכפתור למעלה.</p>}
          </TabsContent>
        </Tabs>
      </div>

      <aside className="flex min-h-0 flex-col border-r bg-card/80">
        <div className="border-b p-3">
          <div className="flex items-center gap-2 text-sm font-bold"><MessageSquare className="h-4 w-4 text-emerald-600" />כרמן SEO/GEO</div>
          <p className="text-[10px] text-muted-foreground">אישור, גאנט, מחקר, שכתוב — כמו ידני</p>
        </div>
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-2">
            {chatLog.map((line, i) => (
              <div key={i} className={cn("rounded-lg p-2 text-xs", line.role === "user" ? "bg-muted ml-4" : "bg-emerald-50 dark:bg-emerald-950/30 mr-4")}>{line.text}</div>
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
  onApprove,
  onRevoke,
  onGenerate,
  onPreview,
  onPublish,
}: {
  entry: SeoGeoCalendarEntry;
  onApprove: () => void;
  onRevoke: () => void;
  onGenerate: () => void;
  onPreview: () => void;
  onPublish: () => void;
}) {
  const approved = isEntryApproved(entry.approval_status);
  return (
    <div className="rounded border bg-background p-1 text-[9px] leading-tight">
      <div className="truncate font-semibold">{entry.title}</div>
      <div className="mt-0.5 flex flex-wrap gap-0.5">
        <Badge variant="outline" className={cn("h-4 px-1 text-[8px]", approved ? "border-emerald-500 text-emerald-700" : "border-amber-400 text-amber-700")}>
          {entry.approval_status === "auto_approved" ? "אושר (כרמן)" : approved ? "אושר" : "לא אושר"}
        </Badge>
        <Badge variant="secondary" className="h-4 px-1 text-[8px]">{entry.generation_status}</Badge>
      </div>
      <div className="mt-1 flex flex-wrap gap-0.5">
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

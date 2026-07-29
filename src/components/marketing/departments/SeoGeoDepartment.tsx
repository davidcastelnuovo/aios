import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensurePipelineForClient } from "@/components/marketing/lib/ensurePipeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BookOpen, Brain, FilePlus2, Gauge, Loader2, Plus, Search, Sparkles, WandSparkles } from "lucide-react";
import { PublishingStudio } from "@/components/marketing/publishing/PublishingStudio";
import { ClientSelector } from "@/components/marketing/ClientSelector";

interface Props { clientId?: string; tenantId: string; onClientChange: (id: string | null) => void }
interface SeoItem { id: string; title: string | null; status: string; payload: Record<string, unknown> | null; current_stage_id: string | null; updated_at: string }
interface Cluster { name?: string; intent?: string; pillarKeyword?: string; supportingKeywords?: string[]; priority?: string; evidence?: string }
interface ContentItem { title?: string; contentType?: string; primaryKeyword?: string; cluster?: string; intent?: string; angle?: string; geoQuestions?: string[]; priority?: string; status?: string }
interface SeoPlan { strategy?: Record<string, string>; clusters?: Cluster[]; contentPlan?: ContentItem[]; geo?: { entities?: string[]; questions?: string[]; citationTargets?: string[]; schemaRecommendations?: string[] }; technicalPriorities?: Array<{ issue?: string; impact?: string; action?: string; priority?: string }>; dataNotes?: string[] }

const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
const asPlan = (value: unknown): SeoPlan | null => value && typeof value === "object" ? value as SeoPlan : null;
const priorityClass = (priority?: string) => priority === "high" ? "border-red-300 bg-red-50 text-red-700" : priority === "medium" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-300 bg-slate-50 text-slate-600";

export function SeoGeoDepartment({ clientId, tenantId, onClientChange }: Props) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [workspace, setWorkspace] = useState<"strategy" | "publishing">("strategy");

  const { data: context, isLoading: loadingContext } = useQuery({
    queryKey: ["seo-department-context", clientId, tenantId],
    queryFn: async () => {
      if (!clientId) return null;
      const pipeline = await ensurePipelineForClient({ clientId, tenantId, track: "seo_geo" });
      if (!pipeline) throw new Error("לא ניתן לפתוח סביבת SEO/GEO");
      const { data, error } = await supabase.from("marketing_pipeline_stages").select("id,stage_type").eq("pipeline_id", pipeline.id);
      if (error) throw error;
      return { pipeline, seoStage: data?.find((stage) => stage.stage_type === "target_seo") ?? null };
    }, enabled: !!clientId,
  });
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["seo-department-items", clientId, tenantId],
    queryFn: async () => {
      let query = supabase.from("marketing_work_items").select("id,title,status,payload,current_stage_id,updated_at").eq("tenant_id", tenantId).order("updated_at", { ascending: false });
      if (clientId) query = query.eq("client_id", clientId);
      else query = query.is("client_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as SeoItem[]).filter((item) => item.current_stage_id === context?.seoStage?.id || item.payload?.department === "seo" || !!item.payload?.seo_plan);
    },
  });
  const { data: signals } = useQuery({
    queryKey: ["seo-department-signals", clientId, tenantId],
    queryFn: async () => {
      if (!clientId) return { reports: 0, keywords: 0, projects: 0 };
      const [{ count: reports }, { data: projects }] = await Promise.all([
        supabase.from("ahrefs_reports").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("client_id", clientId),
        supabase.from("rank_tracking_projects").select("id").eq("tenant_id", tenantId).eq("client_id", clientId).eq("is_active", true),
      ]);
      const ids = (projects ?? []).map((project) => project.id);
      const { count: keywords } = ids.length ? await supabase.from("rank_tracking_keywords").select("id", { count: "exact", head: true }).in("project_id", ids).eq("is_active", true) : { count: 0 };
      return { reports: reports ?? 0, keywords: keywords ?? 0, projects: ids.length };
    }, enabled: !!clientId,
  });
  useEffect(() => { if (!selectedId && items[0]?.id) setSelectedId(items[0].id); if (selectedId && !items.some((item) => item.id === selectedId)) setSelectedId(items[0]?.id ?? null); }, [items, selectedId]);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const plan = useMemo(() => asPlan(selected?.payload?.seo_plan), [selected?.payload]);
  const refresh = async () => queryClient.invalidateQueries({ queryKey: ["seo-department-items", clientId, tenantId] });

  if (loadingContext) return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-emerald-500" /></div>;
  const sectionHeader = <div className="flex items-center gap-3"><Tabs value={workspace} onValueChange={(value) => setWorkspace(value as typeof workspace)}><TabsList><TabsTrigger value="strategy">SEO / GEO</TabsTrigger><TabsTrigger value="publishing">ניהול PBN ומאמרים</TabsTrigger></TabsList></Tabs>{workspace === "strategy" && <div className="mr-auto"><ClientSelector tenantId={tenantId} value={clientId ?? null} onChange={onClientChange} allowGeneral generalLabel="תוכן כללי" /></div>}</div>;
  if (workspace === "publishing") return <div className="flex min-h-0 flex-1 flex-col"><div className="border-b bg-background px-4 py-2">{sectionHeader}</div><PublishingStudio tenantId={tenantId} clientId={clientId} /></div>;
  return <div className="flex min-h-0 flex-1 flex-col"><div className="border-b bg-background px-4 py-2">{sectionHeader}</div><div className="grid min-h-0 flex-1 grid-cols-[270px_minmax(0,1fr)_290px] bg-muted/10">
    <aside className="flex min-h-0 flex-col border-l bg-card/70"><div className="flex items-center justify-between border-b p-3"><div><h2 className="text-sm font-bold">תוכניות SEO / GEO</h2><p className="text-[11px] text-muted-foreground">בריף, מחקר ותוכנית ביצוע</p></div><Button size="icon" className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /></Button></div><ScrollArea className="flex-1"><div className="space-y-2 p-2">{isLoading ? <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin" /> : items.length === 0 ? <div className="px-4 py-10 text-center text-xs text-muted-foreground"><FilePlus2 className="mx-auto mb-2 h-8 w-8 opacity-30" />אין תוכניות עדיין</div> : items.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={cn("w-full rounded-xl border p-3 text-right", selectedId === item.id ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20" : "bg-background hover:bg-muted/50")}><div className="truncate text-xs font-semibold">{item.title || "ללא כותרת"}</div><div className="mt-1 text-[10px] text-muted-foreground">{asPlan(item.payload?.seo_plan)?.contentPlan?.length ?? 0} פריטי תוכן</div></button>)}</div></ScrollArea></aside>
    <main className="flex min-h-0 min-w-0 flex-col">{selected ? <><div className="flex items-center gap-3 border-b bg-card/60 px-4 py-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white"><Search className="h-4 w-4" /></div><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold">{selected.title}</h2><p className="text-[11px] text-muted-foreground">SEO / GEO Strategy Studio</p></div><Badge variant="outline">Skin: seo</Badge><Button size="sm" className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600" onClick={() => setAiOpen(true)}><WandSparkles className="h-3.5 w-3.5" />כרמן תבנה הכול</Button></div>{plan ? <SeoPlanView plan={plan} /> : <div className="flex flex-1 items-center justify-center p-8 text-center"><div><Brain className="mx-auto mb-4 h-14 w-14 text-emerald-400/40" /><h3 className="text-xl font-black">מנתונים לתוכנית עבודה</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">כרמן תחבר את הבריף, נתוני Ahrefs ומעקב המיקומים לאשכולות, תוכנית תוכן ו-GEO.</p><Button className="mt-5 gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setAiOpen(true)}><Sparkles className="h-4 w-4" />בני תוכנית מלאה</Button></div></div>}</> : <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">בחר תוכנית או פתח חדשה</div>}</main>
    <aside className="flex min-h-0 flex-col border-r bg-card/80"><div className="border-b p-4"><h3 className="text-sm font-bold">מקורות מידע חיים</h3><p className="text-[11px] text-muted-foreground">כרמן מסמנת כשאין נתון ולא ממציאה</p></div><div className="space-y-3 p-4"><Signal icon={Gauge} label="דוחות Ahrefs" value={signals?.reports ?? 0} /><Signal icon={Search} label="ביטויים במעקב" value={signals?.keywords ?? 0} /><Signal icon={BookOpen} label="פרויקטי דירוג" value={signals?.projects ?? 0} /><Card className="mt-4 p-3 text-[11px] leading-relaxed text-muted-foreground">GEO הוא חלק מהתוכנית: שאלות שמנועי AI צריכים לענות עליהן, ישויות מותג, מקורות סמכות ו-Schema מומלץ.</Card></div></aside>
    <ManualSeoDialog open={createOpen} onClose={() => setCreateOpen(false)} tenantId={tenantId} defaultClientId={clientId} onCreated={async (id) => { setSelectedId(id); setCreateOpen(false); await refresh(); }} />
    {selected && <SeoAIDialog open={aiOpen} onClose={() => setAiOpen(false)} item={selected} hasPlan={!!plan} onCompleted={async () => { setAiOpen(false); await refresh(); }} />}
  </div></div>;
}

function SeoPlanView({ plan }: { plan: SeoPlan }) {
  return <Tabs defaultValue="strategy" className="flex min-h-0 flex-1 flex-col"><div className="border-b px-4 pt-2"><TabsList><TabsTrigger value="strategy">אסטרטגיה</TabsTrigger><TabsTrigger value="clusters">אשכולות ({plan.clusters?.length ?? 0})</TabsTrigger><TabsTrigger value="content">תוכנית תוכן ({plan.contentPlan?.length ?? 0})</TabsTrigger><TabsTrigger value="geo">GEO</TabsTrigger><TabsTrigger value="technical">טכני</TabsTrigger></TabsList></div><ScrollArea className="flex-1"><div className="p-5">
    <TabsContent value="strategy" className="mt-0 grid gap-3 md:grid-cols-2">{Object.entries(plan.strategy ?? {}).map(([key, value]) => <Card key={key} className="p-4"><div className="text-[10px] font-semibold uppercase text-emerald-600">{key}</div><div className="mt-2 text-sm leading-relaxed">{value || "—"}</div></Card>)}</TabsContent>
    <TabsContent value="clusters" className="mt-0 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(plan.clusters ?? []).map((cluster, index) => <Card key={`${cluster.name}-${index}`} className="p-4"><div className="flex items-start justify-between"><h3 className="text-sm font-bold">{cluster.name}</h3><Badge variant="outline" className={priorityClass(cluster.priority)}>{cluster.priority}</Badge></div><div className="mt-2 text-xs font-medium text-emerald-700">{cluster.pillarKeyword}</div><div className="mt-3 flex flex-wrap gap-1">{cluster.supportingKeywords?.map((keyword) => <Badge key={keyword} variant="secondary" className="text-[10px]">{keyword}</Badge>)}</div><p className="mt-3 text-[11px] text-muted-foreground">{cluster.intent} · {cluster.evidence}</p></Card>)}</TabsContent>
    <TabsContent value="content" className="mt-0 space-y-2">{(plan.contentPlan ?? []).map((content, index) => <Card key={`${content.title}-${index}`} className="grid grid-cols-[1fr_170px_120px] items-center gap-4 p-4"><div><div className="text-sm font-bold">{content.title}</div><div className="mt-1 text-[11px] text-muted-foreground">{content.angle}</div></div><div><div className="text-xs font-medium text-emerald-700">{content.primaryKeyword}</div><div className="text-[10px] text-muted-foreground">{content.cluster} · {content.intent}</div></div><div className="flex justify-end gap-1"><Badge variant="outline">{content.contentType}</Badge><Badge variant="outline" className={priorityClass(content.priority)}>{content.priority}</Badge></div></Card>)}</TabsContent>
    <TabsContent value="geo" className="mt-0 grid gap-4 md:grid-cols-2"><ListCard title="שאלות למנועי AI" values={plan.geo?.questions} /><ListCard title="ישויות מותג" values={plan.geo?.entities} /><ListCard title="מקורות סמכות וציטוט" values={plan.geo?.citationTargets} /><ListCard title="Schema מומלץ" values={plan.geo?.schemaRecommendations} /></TabsContent>
    <TabsContent value="technical" className="mt-0 space-y-2">{(plan.technicalPriorities ?? []).map((item, index) => <Card key={`${item.issue}-${index}`} className="p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">{item.issue}</h3><Badge variant="outline" className={priorityClass(item.priority)}>{item.priority}</Badge></div><p className="mt-2 text-xs text-muted-foreground">השפעה: {item.impact}</p><p className="mt-1 text-xs">פעולה: {item.action}</p></Card>)}</TabsContent>
  </div></ScrollArea></Tabs>;
}

function Signal({ icon: Icon, label, value }: { icon: typeof Search; label: string; value: number }) { return <div className="flex items-center gap-3 rounded-xl border bg-background p-3"><Icon className="h-4 w-4 text-emerald-600" /><div className="flex-1 text-xs">{label}</div><div className="text-lg font-black">{value}</div></div> }
function ListCard({ title, values = [] }: { title: string; values?: string[] }) { return <Card className="p-4"><h3 className="text-sm font-bold">{title}</h3><ul className="mt-3 space-y-2">{values.map((value, index) => <li key={`${value}-${index}`} className="flex gap-2 text-xs leading-relaxed"><span className="text-emerald-500">●</span>{value}</li>)}</ul></Card> }

function ManualSeoDialog({ open, onClose, tenantId, defaultClientId, onCreated }: { open: boolean; onClose: () => void; tenantId: string; defaultClientId?: string; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState(""); const [brief, setBrief] = useState(""); const [saving, setSaving] = useState(false);
  const [assignedClientId, setAssignedClientId] = useState<string | null>(defaultClientId ?? null);
  useEffect(() => { if (open) setAssignedClientId(defaultClientId ?? null); }, [defaultClientId, open]);
  const create = async () => {
    if (!title.trim() || !brief.trim()) return;
    setSaving(true);
    try {
      let pipelineId: string | null = null; let stageId: string | null = null;
      if (assignedClientId) {
        const pipeline = await ensurePipelineForClient({ clientId: assignedClientId, tenantId, track: "seo_geo" });
        const { data: stages, error: stageError } = await supabase.from("marketing_pipeline_stages").select("id,stage_type").eq("pipeline_id", pipeline.id);
        if (stageError) throw stageError;
        pipelineId = pipeline.id; stageId = stages?.find((stage) => stage.stage_type === "target_seo")?.id ?? null;
        if (!stageId) throw new Error("שלב SEO/GEO לא נמצא");
      }
      const { data, error } = await supabase.from("marketing_work_items").insert({ tenant_id: tenantId, client_id: assignedClientId, pipeline_id: pipelineId, current_stage_id: stageId, title: title.trim(), status: "draft", target_channel: "seo", payload: { brief_text: brief.trim(), department: "seo", intake_source: "manual" } }).select("id").single();
      if (error) throw error;
      toast.success(assignedClientId ? "הבריף נכנס למחלקת SEO/GEO" : "נוצרה תוכנית SEO/GEO כללית");
      onCreated(data.id); setTitle(""); setBrief("");
    } catch (error: unknown) { toast.error(message(error, "יצירת התוכנית נכשלה")); } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-w-xl" dir="rtl"><DialogHeader><DialogTitle>תוכנית SEO / GEO חדשה</DialogTitle></DialogHeader><div className="grid gap-4 py-2"><div><Label>שיוך</Label><div className="mt-1"><ClientSelector tenantId={tenantId} value={assignedClientId} onChange={setAssignedClientId} allowGeneral generalLabel="תוכן כללי — ללא לקוח" /></div></div><div><Label>שם התוכנית</Label><Input className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="לדוגמה: תוכנית SEO רבעון 4" /></div><div><Label>בריף / מטרות</Label><Textarea className="mt-1 min-h-36" value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="שירותים, קהל, שוק, אזורים, מתחרים, מטרות ודגשים שאסור להמציא" /></div><Button onClick={create} disabled={saving || !title.trim() || !brief.trim()} className="bg-emerald-600 hover:bg-emerald-700">{saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Plus className="ml-2 h-4 w-4" />}פתח תוכנית</Button></div></DialogContent></Dialog>;
}

function SeoAIDialog({ open, onClose, item, hasPlan, onCompleted }: { open: boolean; onClose: () => void; item: SeoItem; hasPlan: boolean; onCompleted: () => Promise<void> }) {
  const [mode, setMode] = useState<"autopilot" | "brief" | "fill">("autopilot"); const [prompt, setPrompt] = useState(""); const [months, setMonths] = useState("3"); const [running, setRunning] = useState(false);
  const run = async () => { setRunning(true); try { const { data, error } = await supabase.functions.invoke("marketing-seo-plan", { body: { item_id: item.id, prompt: prompt.trim(), mode, horizon_months: Number(months) } }); if (error) throw error; if (data?.error) throw new Error(data.error); toast.success(`כרמן בנתה תוכנית מנתוני ${data.data_sources?.ahrefs_reports ?? 0} דוחות ו-${data.data_sources?.tracked_keywords ?? 0} ביטויים`); await onCompleted(); } catch (error: unknown) { toast.error(message(error, "בניית התוכנית נכשלה")); } finally { setRunning(false); } };
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-w-2xl" dir="rtl"><DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-emerald-500" />כרמן — Skin SEO/GEO</DialogTitle></DialogHeader><div className="grid gap-5 py-2"><div className="grid grid-cols-3 gap-2">{[{ id: "autopilot", title: "כרמן עושה הכול", text: "פרומפט אחד ותוכנית מלאה" }, { id: "brief", title: "מתוך הבריף", text: "בריף + נתונים אמיתיים" }, { id: "fill", title: "מילוי ושיפור", text: "שיפור תוכנית קיימת", disabled: !hasPlan }].map((option) => <button key={option.id} disabled={option.disabled} onClick={() => setMode(option.id as typeof mode)} className={cn("rounded-xl border p-3 text-right", mode === option.id ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/10" : "hover:bg-muted/50", option.disabled && "opacity-40")}><div className="text-xs font-bold">{option.title}</div><div className="mt-1 text-[10px] text-muted-foreground">{option.text}</div></button>)}</div><div><Label>{mode === "autopilot" ? "מה המטרה?" : "הנחיות נוספות (לא חובה)"}</Label><Textarea className="mt-1 min-h-28" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="לדוגמה: לבנות סמכות בתחום אבטחת מידע לעסקים בינוניים, עם דגש על ביטויים מסחריים ועל שאלות שמקבלי החלטות שואלים ב-Google וב-ChatGPT" /></div><div className="w-48"><Label>אופק תוכנית</Label><Select value={months} onValueChange={setMonths}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{[1,3,6,12].map((value) => <SelectItem key={value} value={String(value)}>{value} חודשים</SelectItem>)}</SelectContent></Select></div><Button onClick={run} disabled={running || (mode === "autopilot" && !prompt.trim())} className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}{running ? "כרמן מנתחת ובונה תוכנית..." : "בני אסטרטגיה ותוכנית מלאה"}</Button></div></DialogContent></Dialog>;
}

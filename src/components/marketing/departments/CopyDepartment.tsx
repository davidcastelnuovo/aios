import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { supabase } from "@/integrations/supabase/client";
import { ensurePipelineForClient } from "@/components/marketing/lib/ensurePipeline";
import { ClientSelector } from "@/components/marketing/ClientSelector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Archive,
  Check,
  Clock3,
  FilePlus2,
  History,
  Loader2,
  MessageSquareText,
  PenLine,
  Plus,
  Save,
  Send,
  Sparkles,
  WandSparkles,
} from "lucide-react";

interface Props {
  clientId?: string;
  tenantId: string;
  onClientChange: (id: string | null) => void;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface CopyVersion {
  id: string;
  content: string | null;
  meta: { source?: string } | null;
  created_at: string;
  run_id: string | null;
}

interface CopyVariant {
  label: string;
  headline: string;
  primary: string;
  cta: string;
  rationale: string;
}

interface CopyItem {
  id: string;
  title: string | null;
  status: string;
  payload: Record<string, JsonValue> | null;
  current_stage_id: string | null;
  target_channel: string | null;
  created_at: string;
  updated_at: string;
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const asText = (value: JsonValue | undefined) => (typeof value === "string" ? value : "");

const CONTENT_TYPES = [
  { value: "social_post", label: "פוסט לסושיאל" },
  { value: "ad_script", label: "תסריט למודעה" },
  { value: "video_script", label: "תסריט וידאו" },
  { value: "ad_copy", label: "קופי למודעה" },
  { value: "email", label: "דיוור / אימייל" },
  { value: "landing_page", label: "דף נחיתה" },
];

const CHANNELS = ["Facebook", "Instagram", "TikTok", "LinkedIn", "Google Ads", "YouTube", "כללי"];

const CHANNEL_LIMITS: Record<string, { headline: number; primary: number }> = {
  Facebook: { headline: 40, primary: 125 },
  Instagram: { headline: 40, primary: 125 },
  TikTok: { headline: 90, primary: 150 },
  LinkedIn: { headline: 70, primary: 600 },
  "Google Ads": { headline: 30, primary: 90 },
  YouTube: { headline: 100, primary: 5000 },
  כללי: { headline: 60, primary: 500 },
};

const variantToMarkdown = (variant: CopyVariant) =>
  [`## ${variant.headline}`, variant.primary, variant.cta && `**CTA:** ${variant.cta}`, variant.rationale && `_${variant.rationale}_`]
    .filter(Boolean)
    .join("\n\n");

const readVariants = (payload: Record<string, JsonValue> | null): CopyVariant[] => {
  const raw = payload?.copy_variants;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    return [{
      label: asText(value.label) || "A",
      headline: asText(value.headline),
      primary: asText(value.primary),
      cta: asText(value.cta),
      rationale: asText(value.rationale),
    }];
  });
};

export function CopyDepartment({ clientId, tenantId, onClientChange }: Props) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [briefDraft, setBriefDraft] = useState("");

  const { data: context, isLoading: loadingContext } = useQuery({
    queryKey: ["copy-department-context", clientId, tenantId],
    queryFn: async () => {
      if (!clientId) return null;
      const pipeline = await ensurePipelineForClient({ clientId, tenantId, track: "campaigns" });
      const { data: stages, error } = await supabase
        .from("marketing_pipeline_stages")
        .select("id, stage_type, sort_order")
        .eq("pipeline_id", pipeline.id)
        .order("sort_order");
      if (error) throw error;
      return {
        pipeline,
        copyStage: stages?.find((stage) => stage.stage_type === "copy") ?? null,
        creativeStage: stages?.find((stage) => stage.stage_type === "creative") ?? null,
      };
    },
    enabled: !!clientId,
  });

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["copy-department-items", clientId, tenantId, context?.copyStage?.id, showArchived],
    queryFn: async () => {
      let query = supabase
        .from("marketing_work_items")
        .select("id,title,status,payload,current_stage_id,target_channel,created_at,updated_at")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });
      if (clientId) query = query.eq("client_id", clientId);
      else query = query.is("client_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as CopyItem[]).filter((item) => {
        const payload = item.payload ?? {};
        const isCopy =
          (!!context?.copyStage?.id && item.current_stage_id === context.copyStage.id) ||
          payload.department === "copy" ||
          !!payload.brief_text ||
          !!payload.copy_text ||
          Array.isArray(payload.copy_variants);
        if (!isCopy) return false;
        if (showArchived) return item.status === "archived";
        return item.status !== "archived";
      });
    },
  });

  useEffect(() => {
    if (!selectedId && items[0]?.id) setSelectedId(items[0].id);
    if (selectedId && !items.some((item) => item.id === selectedId)) setSelectedId(items[0]?.id ?? null);
  }, [items, selectedId]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const variants = useMemo(() => readVariants(selected?.payload ?? null), [selected?.payload]);
  const channel = asText(selected?.payload?.channel) || selected?.target_channel || "כללי";
  const limits = CHANNEL_LIMITS[channel] ?? CHANNEL_LIMITS["כללי"];

  useEffect(() => {
    setBriefDraft(asText(selected?.payload?.brief_text));
  }, [selected?.id, selected?.payload?.brief_text]);

  const { data: versions = [] } = useQuery({
    queryKey: ["copy-department-versions", selectedId, tenantId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_assets")
        .select("id,content,meta,created_at,run_id")
        .eq("tenant_id", tenantId)
        .eq("item_id", selectedId!)
        .in("type", ["copy", "brief"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CopyVersion[];
    },
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["copy-department-items", clientId, tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["copy-department-versions", selectedId, tenantId] }),
    ]);
  };

  const writeCopy = async (markdown: string, meta: Record<string, JsonValue>) => {
    if (!selected) return;
    const nextPayload = { ...(selected.payload ?? {}), copy_text: markdown, department: "copy" };
    const { error: itemError } = await supabase
      .from("marketing_work_items")
      .update({ payload: nextPayload, updated_at: new Date().toISOString() })
      .eq("id", selected.id)
      .eq("tenant_id", tenantId);
    if (itemError) throw itemError;
    const { error: assetError } = await supabase.from("marketing_assets").insert({
      tenant_id: tenantId,
      item_id: selected.id,
      stage_id: selected.current_stage_id,
      type: "copy",
      content: markdown,
      meta,
    });
    if (assetError) throw assetError;
    await refresh();
  };

  const handoff = useMutation({
    mutationFn: async () => {
      if (!selected || !context?.creativeStage) throw new Error("שלב קריאייטיב לא נמצא");
      const { error } = await supabase
        .from("marketing_work_items")
        .update({ current_stage_id: context.creativeStage.id, status: "draft" })
        .eq("id", selected.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("הקופי אושר והועבר למחלקת קריאייטיב");
      await refresh();
    },
    onError: (error: unknown) => toast.error(errorMessage(error, "ההעברה נכשלה")),
  });

  const archive = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("לא נבחרה משימה");
      const { error } = await supabase
        .from("marketing_work_items")
        .update({ status: "archived" })
        .eq("id", selected.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("המשימה הועברה לארכיון");
      await refresh();
    },
    onError: (error: unknown) => toast.error(errorMessage(error, "הארכוב נכשל")),
  });

  const saveBrief = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("marketing_work_items")
      .update({ payload: { ...(selected.payload ?? {}), brief_text: briefDraft, department: "copy" } })
      .eq("id", selected.id)
      .eq("tenant_id", tenantId);
    if (error) {
      toast.error(errorMessage(error, "שמירת הבריף נכשלה"));
      return;
    }
    toast.success("הבריף עודכן");
    await refresh();
  };

  if (loadingContext) {
    return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-violet-500" /></div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b bg-background px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground">תצוגה:</span>
        <ClientSelector tenantId={tenantId} value={clientId ?? null} onChange={onClientChange} allowGeneral generalLabel="תוכן כללי" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_320px] bg-muted/10">
        <aside className="flex min-h-0 flex-col border-l bg-card/70">
          <div className="flex items-center justify-between border-b p-3">
            <div>
              <h2 className="text-sm font-bold">בריפים ומשימות</h2>
              <p className="text-[11px] text-muted-foreground">אוטומטיים וידניים במקום אחד</p>
            </div>
            <Button size="icon" className="h-8 w-8" onClick={() => setCreateOpen(true)} title="בריף ידני חדש">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between border-b px-3 py-2 text-[11px]">
            <button className={cn("text-muted-foreground hover:text-foreground", !showArchived && "font-semibold text-foreground")} onClick={() => setShowArchived(false)}>פעילים</button>
            <button className={cn("text-muted-foreground hover:text-foreground", showArchived && "font-semibold text-foreground")} onClick={() => setShowArchived(true)}>ארכיון</button>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-2 p-2">
              {loadingItems ? (
                <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin" />
              ) : items.length === 0 ? (
                <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                  <FilePlus2 className="mx-auto mb-2 h-8 w-8 opacity-30" />
                  {showArchived ? "אין משימות בארכיון" : "אין בריפים עדיין"}
                </div>
              ) : items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-right transition-colors",
                    selectedId === item.id ? "border-violet-400 bg-violet-50 dark:bg-violet-950/20" : "bg-background hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <StatusDot status={item.status} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold">{item.title || "ללא כותרת"}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {asText(item.payload?.content_type) && <Badge variant="secondary" className="h-4 px-1 text-[9px]">{CONTENT_TYPES.find((type) => type.value === item.payload?.content_type)?.label ?? asText(item.payload?.content_type)}</Badge>}
                        {(asText(item.payload?.channel) || item.target_channel) && <Badge variant="outline" className="h-4 px-1 text-[9px]">{asText(item.payload?.channel) || item.target_channel}</Badge>}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                        {asText(item.payload?.brief_text) || asText(item.payload?.copy_text) || "מחכה להנחיות"}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col">
          {selected ? (
            <>
              <div className="flex items-center gap-3 border-b bg-card/50 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500 text-white"><PenLine className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-bold">{selected.title}</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Skin: copywriter · {channel} · כותרת עד {limits.headline} / גוף עד {limits.primary} תווים
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => archive.mutate()} disabled={archive.isPending || selected.status === "archived"}>
                  <Archive className="h-3.5 w-3.5" />ארכיון
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAiOpen(true)}>
                  <WandSparkles className="h-3.5 w-3.5" />
                  {asText(selected.payload?.copy_text) ? "כרמן תשפר / תיצור" : "כרמן תכתוב"}
                </Button>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => handoff.mutate()} disabled={handoff.isPending || !context?.creativeStage} title={!context?.creativeStage ? "בחרו לקוח עם פייפליין כדי להעביר לקריאייטיב" : undefined}>
                  <Send className="h-3.5 w-3.5" />אשר והעבר לקריאייטיב
                </Button>
              </div>
              <CopyEditor key={`${selected.id}-${selected.updated_at}`} item={selected} tenantId={tenantId} limits={limits} onSaved={refresh} />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center text-muted-foreground">
              <div>
                <MessageSquareText className="mx-auto mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm">בחר בריף או צור אחד חדש</p>
                <Button className="mt-4 gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />בריף חדש</Button>
              </div>
            </div>
          )}
        </main>

        <aside className="flex min-h-0 flex-col border-r bg-card/70">
          <Tabs defaultValue="brief" className="flex min-h-0 flex-1 flex-col">
            <div className="border-b px-3 pt-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="brief">בריף</TabsTrigger>
                <TabsTrigger value="variants">וריאציות</TabsTrigger>
                <TabsTrigger value="versions">גרסאות</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="brief" className="min-h-0 flex-1 p-3">
              {selected ? (
                <div className="flex h-full flex-col gap-3">
                  <p className="text-[11px] text-muted-foreground">הבריף נשמר במשימה ונכנס לכל יצירה של כרמן</p>
                  <Textarea className="min-h-0 flex-1" value={briefDraft} onChange={(event) => setBriefDraft(event.target.value)} placeholder="מטרה, קהל, כאבים, הצעה, מסרים ומידע שאסור להמציא" />
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void saveBrief()} disabled={briefDraft === asText(selected.payload?.brief_text)}>
                    <Save className="h-3.5 w-3.5" />שמור בריף
                  </Button>
                </div>
              ) : <div className="py-8 text-center text-xs text-muted-foreground">אין משימה נבחרת</div>}
            </TabsContent>
            <TabsContent value="variants" className="min-h-0 flex-1">
              <ScrollArea className="h-full">
                <div className="space-y-3 p-3">
                  {asText(selected?.payload?.copy_angle) && (
                    <Card className="p-3 text-[11px] leading-relaxed text-muted-foreground">
                      <div className="mb-1 font-semibold text-foreground">זווית: {asText(selected?.payload?.copy_angle)}</div>
                      {asText(selected?.payload?.copy_promise)}
                    </Card>
                  )}
                  {variants.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">כרמן תייצר כאן 3 וריאציות לבדיקה</div>
                  ) : variants.map((variant) => (
                    <Card key={variant.label} className="space-y-2 p-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">וריאציה {variant.label}</Badge>
                        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => void writeCopy(variantToMarkdown(variant), { source: "variant_select", label: variant.label }).then(() => toast.success(`וריאציה ${variant.label} נכנסה לעורך`)).catch((error: unknown) => toast.error(errorMessage(error, "ההעתקה נכשלה")))}>
                          העתק לעורך
                        </Button>
                      </div>
                      <div className="text-xs font-semibold">{variant.headline}</div>
                      <p className="text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">{variant.primary}</p>
                      {variant.cta && <Badge className="bg-violet-600 hover:bg-violet-600">{variant.cta}</Badge>}
                      {variant.rationale && <p className="text-[10px] text-muted-foreground">{variant.rationale}</p>}
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="versions" className="min-h-0 flex-1">
              <ScrollArea className="h-full">
                <div className="space-y-3 p-3">
                  <p className="text-[11px] text-muted-foreground">לחיצה משחזרת גרסה לעורך כטיוטה חדשה</p>
                  {versions.map((version, index) => (
                    <Card key={version.id} className="p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <Badge variant="outline">גרסה {versions.length - index}</Badge>
                        <span className="text-[10px] text-muted-foreground">{new Date(version.created_at).toLocaleString("he-IL")}</span>
                      </div>
                      <p className="line-clamp-5 text-xs leading-relaxed whitespace-pre-wrap">{version.content}</p>
                      {version.meta?.source === "manual_edit" && <div className="mt-2 text-[10px] text-muted-foreground">עריכה ידנית</div>}
                      {version.content && (
                        <Button size="sm" variant="ghost" className="mt-2 h-7 px-2 text-[11px]" onClick={() => void writeCopy(version.content!, { source: "restore", restored_asset_id: version.id }).then(() => toast.success("הגרסה שוחזרה לעורך")).catch((error: unknown) => toast.error(errorMessage(error, "השחזור נכשל")))}>
                          <History className="ml-1 h-3 w-3" />שחזר לעורך
                        </Button>
                      )}
                    </Card>
                  ))}
                  {selected && versions.length === 0 && <div className="py-8 text-center text-xs text-muted-foreground">הגרסה הראשונה תופיע כאן</div>}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      <ManualBriefDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        tenantId={tenantId}
        defaultClientId={clientId}
        onCreated={async (id) => { setSelectedId(id); setCreateOpen(false); await refresh(); }}
      />
      {selected && (
        <CopyAIDialog
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          item={selected}
          copyStageId={context?.copyStage?.id ?? null}
          tenantId={tenantId}
          onCompleted={async () => { setAiOpen(false); await refresh(); }}
        />
      )}
    </div>
  );
}

function CopyEditor({
  item,
  tenantId,
  limits,
  onSaved,
}: {
  item: CopyItem;
  tenantId: string;
  limits: { headline: number; primary: number };
  onSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const initialContent = useMemo(() => {
    const text = asText(item.payload?.copy_text) || "כאן יופיע הקופי. אפשר לכתוב ידנית או לבקש מכרמן ליצור גרסה.";
    return String(text).split("\n").map((line) => ({ type: "paragraph" as const, content: line || " " }));
  }, [item.payload?.copy_text]);
  const editor = useCreateBlockNote({ initialContent });

  useEffect(() => {
    const updateCount = () => {
      const markdown = editor.blocksToMarkdownLossy(editor.document);
      setCharCount(markdown.replace(/\s+/g, " ").trim().length);
    };
    updateCount();
    return editor.onChange(updateCount);
  }, [editor]);

  const save = async () => {
    setSaving(true);
    try {
      const markdown = editor.blocksToMarkdownLossy(editor.document);
      const nextPayload = { ...(item.payload ?? {}), copy_text: markdown, editor_blocks: editor.document as unknown as JsonValue, department: "copy" };
      const { error: itemError } = await supabase
        .from("marketing_work_items")
        .update({ payload: nextPayload })
        .eq("id", item.id)
        .eq("tenant_id", tenantId);
      if (itemError) throw itemError;
      const { error: assetError } = await supabase.from("marketing_assets").insert({
        tenant_id: tenantId,
        item_id: item.id,
        stage_id: item.current_stage_id,
        type: "copy",
        content: markdown,
        meta: { source: "manual_edit", skin_slug: "copywriter", editor_blocks: editor.document as unknown as JsonValue },
      });
      if (assetError) throw assetError;
      toast.success("הגרסה נשמרה");
      await onSaved();
    } catch (error: unknown) {
      toast.error(errorMessage(error, "השמירה נכשלה"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-xs text-muted-foreground">עורך בלוקים — גרור, סדר וערוך כל חלק בנפרד</span>
        <div className="flex items-center gap-3">
          <span className={cn("text-[11px]", charCount > limits.primary ? "font-semibold text-amber-600" : "text-muted-foreground")}>
            {charCount} / {limits.primary} תווים
          </span>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}שמור גרסה
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto min-h-full max-w-3xl rounded-2xl border bg-card p-5 shadow-sm" dir="rtl">
          <BlockNoteView editor={editor} theme={dark ? "dark" : "light"} />
        </div>
      </div>
    </div>
  );
}

function CopyAIDialog({
  open,
  onClose,
  item,
  copyStageId,
  tenantId,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  item: CopyItem;
  copyStageId: string | null;
  tenantId: string;
  onCompleted: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"autopilot" | "brief" | "improve">("autopilot");
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const hasCopy = !!asText(item.payload?.copy_text);
  const hasBrief = !!asText(item.payload?.brief_text);

  const run = async () => {
    setRunning(true);
    try {
      if (copyStageId && item.current_stage_id !== copyStageId) {
        const { error: moveError } = await supabase
          .from("marketing_work_items")
          .update({ current_stage_id: copyStageId, status: "draft" })
          .eq("id", item.id)
          .eq("tenant_id", tenantId);
        if (moveError) throw moveError;
      }
      const { data, error } = await supabase.functions.invoke("marketing-copy-plan", {
        body: { item_id: item.id, prompt: prompt.trim(), mode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`כרמן כתבה ${data?.variants?.length ?? 3} וריאציות קופי`);
      await onCompleted();
    } catch (error: unknown) {
      toast.error(errorMessage(error, "כרמן לא הצליחה לכתוב קופי"));
    } finally {
      setRunning(false);
    }
  };

  const modes = [
    { id: "autopilot" as const, title: "כרמן עושה הכול", description: "פרומפט אחד → 3 וריאציות, כותרת, גוף ו-CTA" },
    { id: "brief" as const, title: "מתוך הבריף", description: "רק מה שכתוב בבריף, בלי להמציא עובדות", disabled: !hasBrief },
    { id: "improve" as const, title: "שיפור הקיים", description: "שומרת על המסר ומייצרת 3 זוויות חזקות יותר", disabled: !hasCopy },
  ];

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WandSparkles className="h-5 w-5 text-violet-500" />
            עבודה עם כרמן — Skin קופירייטרית
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 py-2">
          <div className="grid grid-cols-3 gap-2">
            {modes.map((option) => (
              <button
                key={option.id}
                disabled={option.disabled}
                onClick={() => setMode(option.id)}
                className={cn(
                  "rounded-xl border p-3 text-right transition-all",
                  mode === option.id ? "border-violet-500 bg-violet-50 ring-2 ring-violet-500/10 dark:bg-violet-950/20" : "hover:bg-muted/50",
                  option.disabled && "cursor-not-allowed opacity-40",
                )}
              >
                <div className="text-xs font-bold">{option.title}</div>
                <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{option.description}</div>
              </button>
            ))}
          </div>
          <div>
            <Label>{mode === "autopilot" ? "מה כרמן צריכה לכתוב?" : "הנחיות נוספות לכרמן (לא חובה)"}</Label>
            <Textarea
              className="mt-1 min-h-32"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={mode === "autopilot" ? "לדוגמה: פוסט השקה לאינסטגרם שמדבר לבעלי עסקים שחוששים מפרסום ממומן. טון ישיר, בלי קלישאות של AI, CTA לשיחת ייעוץ." : "דגשים, מילים שחייבות להופיע, דברים שאסור להבטיח, אורך רצוי"}
            />
          </div>
          <div className="rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
            כרמן משתמשת בבריף, בפרטי הלקוח וב־Skin <b>copywriter</b>. אחרי היצירה אפשר לבחור וריאציה, לערוך בעורך הבלוקים ולשמור גרסה.
          </div>
          <Button onClick={() => void run()} disabled={running || (mode === "autopilot" && !prompt.trim())} className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
            {running ? "כרמן כותבת וריאציות..." : mode === "improve" ? "שפרי וצרי 3 וריאציות" : "כתבי קופי עם 3 וריאציות"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ManualBriefDialog({ open, onClose, tenantId, defaultClientId, onCreated }: {
  open: boolean; onClose: () => void; tenantId: string; defaultClientId?: string; onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [instructions, setInstructions] = useState("");
  const [contentType, setContentType] = useState("social_post");
  const [channel, setChannel] = useState("Facebook");
  const [saving, setSaving] = useState(false);
  const [assignedClientId, setAssignedClientId] = useState<string | null>(defaultClientId ?? null);

  useEffect(() => {
    if (open) setAssignedClientId(defaultClientId ?? null);
  }, [defaultClientId, open]);

  const create = async () => {
    if (!title.trim() || !brief.trim()) return;
    setSaving(true);
    try {
      const typeLabel = CONTENT_TYPES.find((type) => type.value === contentType)?.label ?? contentType;
      const notes = [`סוג תוצר: ${typeLabel}`, `ערוץ: ${channel}`, instructions && `הנחיות: ${instructions}`].filter(Boolean).join("\n");
      let pipelineId: string | null = null;
      let stageId: string | null = null;
      if (assignedClientId) {
        const pipeline = await ensurePipelineForClient({ clientId: assignedClientId, tenantId, track: "campaigns" });
        const { data: stages, error: stageError } = await supabase.from("marketing_pipeline_stages").select("id,stage_type").eq("pipeline_id", pipeline.id);
        if (stageError) throw stageError;
        pipelineId = pipeline.id;
        stageId = stages?.find((stage) => stage.stage_type === "copy")?.id ?? null;
        if (!stageId) throw new Error("שלב הקופי לא נמצא");
      }
      const { data, error } = await supabase.from("marketing_work_items").insert({
        tenant_id: tenantId,
        client_id: assignedClientId,
        pipeline_id: pipelineId,
        current_stage_id: stageId,
        title: title.trim(),
        status: "draft",
        target_channel: channel.toLowerCase().replace(/\s+/g, "_"),
        payload: { brief_text: brief.trim(), notes, instructions, content_type: contentType, channel, department: "copy", intake_source: "manual" },
      }).select("id").single();
      if (error) throw error;
      toast.success("הבריף נכנס למחלקת קופי");
      setTitle(""); setBrief(""); setInstructions("");
      onCreated(data.id);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "יצירת הבריף נכשלה"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader><DialogTitle>בריף חדש למחלקת קופי</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div><Label>שיוך</Label><div className="mt-1"><ClientSelector tenantId={tenantId} value={assignedClientId} onChange={setAssignedClientId} allowGeneral generalLabel="תוכן כללי — ללא לקוח" /></div></div>
          <div><Label>שם המשימה</Label><Input className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="לדוגמה: קמפיין השקת שירות חדש" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>מה יוצרים?</Label><Select value={contentType} onValueChange={setContentType}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{CONTENT_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>ערוץ</Label><Select value={channel} onValueChange={setChannel}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{CHANNELS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div><Label>בריף / חומר גלם</Label><Textarea className="mt-1 min-h-36" value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="מטרה, קהל, כאבים, הצעה, מסרים ומידע שאסור להמציא" /></div>
          <div><Label>הנחיות מיוחדות</Label><Textarea className="mt-1 min-h-20" value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="טון, אורך, מבנה, השראות, דברים שחייבים או אסור לכתוב" /></div>
          <Separator />
          <Button onClick={() => void create()} disabled={saving || !title.trim() || !brief.trim()} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}הכנס למחלקת קופי
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusDot({ status }: { status: string }) {
  const config = status === "waiting_approval"
    ? { icon: Clock3, className: "text-amber-500" }
    : status === "approved" || status === "published"
      ? { icon: Check, className: "text-emerald-500" }
      : status === "archived"
        ? { icon: Archive, className: "text-gray-400" }
        : { icon: Sparkles, className: "text-violet-500" };
  const Icon = config.icon;
  return <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", config.className)} />;
}

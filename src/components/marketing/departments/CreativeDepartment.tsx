import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Check,
  Clapperboard,
  Copy,
  Image as ImageIcon,
  Loader2,
  Palette,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";

interface Props {
  clientId: string;
  tenantId: string;
}

interface StoryboardFrame {
  id: string;
  order: number;
  title: string;
  shot: string;
  visualPrompt: string;
  overlayText: string;
  voiceover: string;
  duration: number;
  imageUrl?: string;
  x: number;
  y: number;
}

interface CreativeItem {
  id: string;
  title: string | null;
  status: string;
  payload: Record<string, unknown> | null;
  current_stage_id: string | null;
  target_channel: string | null;
  updated_at: string;
}

type StoryboardNode = Node<StoryboardFrame, "storyboard">;

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const makeFrame = (order: number, x = (order - 1) * 300, y = 100): StoryboardFrame => ({
  id: crypto.randomUUID(),
  order,
  title: `סצנה ${order}`,
  shot: "Medium shot",
  visualPrompt: "",
  overlayText: "",
  voiceover: "",
  duration: 3,
  x,
  y,
});

const getStoryboard = (payload: Record<string, unknown> | null): StoryboardFrame[] => {
  const value = payload?.storyboard;
  if (!Array.isArray(value)) return [];
  return value.filter((frame): frame is StoryboardFrame => {
    if (!frame || typeof frame !== "object") return false;
    return typeof (frame as StoryboardFrame).id === "string";
  });
};

function StoryboardCard({ data, selected }: NodeProps<StoryboardNode>) {
  return (
    <Card className={cn("w-60 overflow-hidden border-2 bg-card p-0 shadow-lg", selected && "border-pink-500 ring-4 ring-pink-500/10")} dir="rtl">
      <Handle type="target" position={Position.Right} />
      <div className="relative aspect-video bg-muted">
        {data.imageUrl ? (
          <img src={data.imageUrl} alt={data.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <ImageIcon className="mb-2 h-7 w-7 opacity-40" />
            <span className="text-[10px]">פריים טרם נוצר</span>
          </div>
        )}
        <Badge className="absolute right-2 top-2 bg-black/70 text-white hover:bg-black/70">{data.order}</Badge>
        <Badge variant="secondary" className="absolute bottom-2 left-2 text-[10px]">{data.duration} שנ׳</Badge>
      </div>
      <div className="p-3">
        <div className="truncate text-xs font-bold">{data.title}</div>
        <div className="mt-1 line-clamp-2 min-h-8 text-[10px] leading-relaxed text-muted-foreground">
          {data.visualPrompt || data.voiceover || "בחר את הסצנה והוסף הנחיות"}
        </div>
      </div>
      <Handle type="source" position={Position.Left} />
    </Card>
  );
}

const nodeTypes = { storyboard: StoryboardCard };

export function CreativeDepartment({ clientId, tenantId }: Props) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [frameDraft, setFrameDraft] = useState<StoryboardFrame | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const { data: context, isLoading: loadingContext } = useQuery({
    queryKey: ["creative-department-context", clientId, tenantId],
    queryFn: async () => {
      const pipeline = await ensurePipelineForClient({ clientId, tenantId, track: "campaigns" });
      if (!pipeline) throw new Error("לא ניתן לפתוח סביבת קריאייטיב");
      const { data: stages, error } = await supabase
        .from("marketing_pipeline_stages")
        .select("id, stage_type, sort_order")
        .eq("pipeline_id", pipeline.id)
        .order("sort_order");
      if (error) throw error;
      return {
        pipeline,
        creativeStage: stages?.find((stage) => stage.stage_type === "creative") ?? null,
        campaignStage: stages?.find((stage) => stage.stage_type === "target_paid") ?? null,
      };
    },
  });

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["creative-department-items", clientId, tenantId],
    enabled: !!context?.pipeline.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_work_items")
        .select("id,title,status,payload,current_stage_id,target_channel,updated_at")
        .eq("tenant_id", tenantId)
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as CreativeItem[]).filter((item) => {
        const payload = item.payload ?? {};
        return item.current_stage_id === context?.creativeStage?.id || payload.department === "creative" || Array.isArray(payload.storyboard) || !!payload.image_url;
      });
    },
  });

  useEffect(() => {
    if (!selectedId && items[0]?.id) setSelectedId(items[0].id);
    if (selectedId && !items.some((item) => item.id === selectedId)) setSelectedId(items[0]?.id ?? null);
  }, [items, selectedId]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const frames = useMemo(() => getStoryboard(selected?.payload ?? null), [selected?.payload]);
  const selectedFrame = frames.find((frame) => frame.id === selectedFrameId) ?? frames[0] ?? null;

  useEffect(() => {
    if (!selectedFrameId && frames[0]?.id) setSelectedFrameId(frames[0].id);
    if (selectedFrameId && !frames.some((frame) => frame.id === selectedFrameId)) setSelectedFrameId(frames[0]?.id ?? null);
  }, [frames, selectedFrameId]);

  useEffect(() => {
    const frame = frames.find((value) => value.id === selectedFrameId) ?? frames[0] ?? null;
    setFrameDraft(frame ? { ...frame } : null);
  }, [frames, selectedFrameId]);

  const nodes: StoryboardNode[] = useMemo(() => frames.map((frame) => ({
    id: frame.id,
    type: "storyboard",
    position: { x: frame.x, y: frame.y },
    data: frame,
  })), [frames]);

  const edges: Edge[] = useMemo(() => frames.slice(0, -1).map((frame, index) => ({
    id: `${frame.id}-${frames[index + 1].id}`,
    source: frame.id,
    target: frames[index + 1].id,
    animated: true,
    style: { stroke: "#ec4899", strokeWidth: 2 },
  })), [frames]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["creative-department-items", clientId, tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["creative-department-assets", selectedId, tenantId] }),
    ]);
  };

  const saveFrames = async (nextFrames: StoryboardFrame[], message = "ה־storyboard נשמר") => {
    if (!selected) return;
    const nextPayload = { ...(selected.payload ?? {}), storyboard: nextFrames, department: "creative" };
    const { error } = await supabase
      .from("marketing_work_items")
      .update({ payload: nextPayload })
      .eq("id", selected.id)
      .eq("tenant_id", tenantId);
    if (error) throw error;
    await supabase.from("marketing_assets").insert({
      tenant_id: tenantId,
      item_id: selected.id,
      stage_id: context?.creativeStage?.id ?? selected.current_stage_id,
      type: "storyboard",
      content: JSON.stringify(nextFrames),
      meta: { source: "visual_editor", skin_slug: "social_media", frame_count: nextFrames.length },
    });
    toast.success(message);
    await refresh();
  };

  const initializeStoryboard = async () => {
    if (!selected) return;
    const copy = String(selected.payload?.copy_text ?? selected.payload?.brief_text ?? "");
    const lines = copy.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 4);
    const nextFrames = (lines.length ? lines : ["הוק", "הבעיה", "הפתרון", "קריאה לפעולה"]).map((line, index) => ({
      ...makeFrame(index + 1),
      title: index === 0 ? "הוק" : index === (lines.length || 4) - 1 ? "קריאה לפעולה" : `סצנה ${index + 1}`,
      voiceover: line,
      overlayText: line.length <= 80 ? line : "",
    }));
    await saveFrames(nextFrames, "נוצר storyboard ראשוני מהקופי");
  };

  const saveFrameDraft = async () => {
    if (!frameDraft) return;
    const next = frames.map((frame) => frame.id === frameDraft.id ? frameDraft : frame);
    await saveFrames(next, "הסצנה נשמרה כגרסה חדשה");
  };

  const saveFramePosition = (frameId: string, x: number, y: number) => {
    const next = frames.map((frame) => frame.id === frameId ? { ...frame, x, y } : frame);
    void saveFrames(next, "מיקום הסצנה נשמר").catch((error: unknown) => toast.error(errorMessage(error, "השמירה נכשלה")));
  };

  const addFrame = async () => {
    const next = [...frames, makeFrame(frames.length + 1)];
    await saveFrames(next, "סצנה חדשה נוספה");
    setSelectedFrameId(next[next.length - 1].id);
  };

  const duplicateFrame = async () => {
    if (!selectedFrame) return;
    const copy = { ...selectedFrame, id: crypto.randomUUID(), order: frames.length + 1, x: selectedFrame.x + 300 };
    await saveFrames([...frames, copy], "הסצנה שוכפלה");
    setSelectedFrameId(copy.id);
  };

  const removeFrame = async () => {
    if (!selectedFrame) return;
    const next = frames.filter((frame) => frame.id !== selectedFrame.id).map((frame, index) => ({ ...frame, order: index + 1 }));
    await saveFrames(next, "הסצנה הוסרה");
  };

  const generateFrame = async () => {
    const frameToGenerate = frameDraft ?? selectedFrame;
    if (!selected || !frameToGenerate || !context?.creativeStage) return;
    setGenerating(true);
    try {
      const originalNotes = String(selected.payload?.notes ?? "");
      const generationNotes = [
        originalNotes,
        `בקשת פריים ${frameToGenerate.order}: ${frameToGenerate.visualPrompt || frameToGenerate.voiceover || frameToGenerate.title}`,
        `סוג שוט: ${frameToGenerate.shot}`,
        frameToGenerate.overlayText && `טקסט שיופיע: ${frameToGenerate.overlayText}`,
      ].filter(Boolean).join("\n");
      const { error: prepareError } = await supabase.from("marketing_work_items").update({
        current_stage_id: context.creativeStage.id,
        status: "draft",
        payload: { ...(selected.payload ?? {}), notes: generationNotes, department: "creative" },
      }).eq("id", selected.id).eq("tenant_id", tenantId);
      if (prepareError) throw prepareError;
      const { data, error } = await supabase.functions.invoke("marketing-run-stage", {
        body: { item_id: selected.id, stage_id: context.creativeStage.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const next = frames.map((frame) => frame.id === frameToGenerate.id ? { ...frameToGenerate, imageUrl: data.url } : frame);
      await saveFrames(next, "הפריים נוצר ונשמר ב־storyboard");
    } catch (error: unknown) {
      toast.error(errorMessage(error, "יצירת הפריים נכשלה"));
    } finally {
      setGenerating(false);
    }
  };

  const handoff = useMutation({
    mutationFn: async () => {
      if (!selected || !context?.campaignStage) throw new Error("שלב הקמפיינים לא נמצא");
      const { error } = await supabase.from("marketing_work_items").update({
        current_stage_id: context.campaignStage.id,
        status: "draft",
        payload: { ...(selected.payload ?? {}), storyboard: frames, creative_approved: true, department: "campaigns" },
      }).eq("id", selected.id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("הקריאייטיב אושר והועבר למחלקת הקמפיינים"); await refresh(); },
    onError: (error: unknown) => toast.error(errorMessage(error, "ההעברה נכשלה")),
  });

  if (loadingContext) return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-pink-500" /></div>;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[270px_minmax(0,1fr)_320px] bg-muted/10">
      <aside className="flex min-h-0 flex-col border-l bg-card/70">
        <div className="flex items-center justify-between border-b p-3">
          <div><h2 className="text-sm font-bold">פרויקטים לקריאייטיב</h2><p className="text-[11px] text-muted-foreground">מהקופי או מבריף ידני</p></div>
          <Button size="icon" className="h-8 w-8 bg-pink-600 hover:bg-pink-700" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /></Button>
        </div>
        <ScrollArea className="flex-1"><div className="space-y-2 p-2">
          {loadingItems ? <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin" /> : items.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground"><Palette className="mx-auto mb-2 h-8 w-8 opacity-30" />אין פרויקטים עדיין</div>
          ) : items.map((item) => (
            <button key={item.id} onClick={() => { setSelectedId(item.id); setSelectedFrameId(null); }} className={cn("w-full rounded-xl border p-3 text-right", selectedId === item.id ? "border-pink-400 bg-pink-50 dark:bg-pink-950/20" : "bg-background hover:bg-muted/50")}>
              <div className="truncate text-xs font-semibold">{item.title || "ללא כותרת"}</div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground"><span>{item.target_channel || "כללי"}</span><span>{getStoryboard(item.payload).length} סצנות</span></div>
            </button>
          ))}
        </div></ScrollArea>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-col">
        {selected ? <>
          <div className="flex items-center gap-3 border-b bg-card/60 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-700 text-white"><Clapperboard className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold">{selected.title}</h2><p className="text-[11px] text-muted-foreground">Creative Studio · storyboard חי עם גרסאות</p></div>
            <Badge variant="outline">Skin: social_media</Badge>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={addFrame}><Plus className="h-3.5 w-3.5" />סצנה</Button>
            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => handoff.mutate()} disabled={handoff.isPending || frames.length === 0}><Send className="h-3.5 w-3.5" />אשר לקמפיינים</Button>
          </div>
          {frames.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center"><div><Clapperboard className="mx-auto mb-4 h-14 w-14 text-pink-400/40" /><h3 className="text-xl font-black">מתחילים מהרעיון, לא מהתמונה</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">המערכת תהפוך את הקופי לסדרת סצנות. אחר כך אפשר לערוך כל פריים, לייצר ויזואל ולאשר.</p><Button className="mt-5 gap-2 bg-pink-600 hover:bg-pink-700" onClick={initializeStoryboard}><Sparkles className="h-4 w-4" />בנה storyboard מהקופי</Button></div></div>
          ) : (
            <div className="min-h-0 flex-1" dir="ltr">
              <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.2 }} onNodeClick={(_, node) => setSelectedFrameId(node.id)} onNodeDragStop={(_, node) => saveFramePosition(node.id, node.position.x, node.position.y)} proOptions={{ hideAttribution: true }}>
                <Background gap={24} size={1} /><Controls position="bottom-left" />
              </ReactFlow>
            </div>
          )}
        </> : <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">בחר פרויקט קריאייטיב</div>}
      </main>

      <aside className="flex min-h-0 flex-col border-r bg-card/80">
        {selectedFrame && frameDraft ? <>
          <div className="border-b p-4"><div className="flex items-center justify-between"><div><h3 className="text-sm font-bold">עריכת סצנה {selectedFrame.order}</h3><p className="text-[11px] text-muted-foreground">כל שינוי נשמר כגרסה</p></div><Badge variant="secondary">{selectedFrame.duration} שנ׳</Badge></div></div>
          <ScrollArea className="flex-1"><div className="space-y-4 p-4">
            <div><Label>שם הסצנה</Label><Input className="mt-1" value={frameDraft.title} onChange={(event) => setFrameDraft({ ...frameDraft, title: event.target.value })} /></div>
            <div><Label>סוג שוט</Label><Select value={frameDraft.shot} onValueChange={(value) => setFrameDraft({ ...frameDraft, shot: value })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{["Close-up", "Medium shot", "Wide shot", "POV", "Product shot", "UGC handheld", "Cinematic tracking"].map((shot) => <SelectItem key={shot} value={shot}>{shot}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>מה רואים בפריים?</Label><Textarea className="mt-1 min-h-24" value={frameDraft.visualPrompt} onChange={(event) => setFrameDraft({ ...frameDraft, visualPrompt: event.target.value })} placeholder="דמות, סביבה, תאורה, קומפוזיציה, סגנון והשראה" /></div>
            <div><Label>טקסט על המסך</Label><Textarea className="mt-1 min-h-16" value={frameDraft.overlayText} onChange={(event) => setFrameDraft({ ...frameDraft, overlayText: event.target.value })} /></div>
            <div><Label>קריינות / דיאלוג</Label><Textarea className="mt-1 min-h-20" value={frameDraft.voiceover} onChange={(event) => setFrameDraft({ ...frameDraft, voiceover: event.target.value })} /></div>
            <div><Label>משך בשניות</Label><Input className="mt-1" type="number" min={1} max={30} value={frameDraft.duration} onChange={(event) => setFrameDraft({ ...frameDraft, duration: Number(event.target.value) || 1 })} /></div>
            <Button variant="outline" className="w-full gap-2" onClick={() => void saveFrameDraft().catch((error: unknown) => toast.error(errorMessage(error, "השמירה נכשלה")))}><Save className="h-4 w-4" />שמור סצנה כגרסה</Button>
            <Button className="w-full gap-2 bg-gradient-to-r from-pink-600 to-violet-600" onClick={generateFrame} disabled={generating}>{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}{selectedFrame.imageUrl ? "צור וריאציה חדשה" : "צור את הפריים"}</Button>
            <div className="grid grid-cols-2 gap-2"><Button variant="outline" size="sm" className="gap-1" onClick={duplicateFrame}><Copy className="h-3.5 w-3.5" />שכפל</Button><Button variant="outline" size="sm" className="gap-1 text-destructive" onClick={removeFrame}><Trash2 className="h-3.5 w-3.5" />מחק</Button></div>
          </div></ScrollArea>
        </> : <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground"><Save className="ml-2 h-4 w-4" />בחר סצנה כדי לערוך אותה</div>}
      </aside>

      <ManualCreativeDialog open={createOpen} onClose={() => setCreateOpen(false)} tenantId={tenantId} clientId={clientId} pipelineId={context?.pipeline.id ?? ""} stageId={context?.creativeStage?.id ?? ""} onCreated={async (id) => { setSelectedId(id); setCreateOpen(false); await refresh(); }} />
    </div>
  );
}

function ManualCreativeDialog({ open, onClose, tenantId, clientId, pipelineId, stageId, onCreated }: { open: boolean; onClose: () => void; tenantId: string; clientId: string; pipelineId: string; stageId: string; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [format, setFormat] = useState("9:16");
  const [saving, setSaving] = useState(false);
  const create = async () => {
    if (!title.trim() || !brief.trim() || !pipelineId || !stageId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from("marketing_work_items").insert({ tenant_id: tenantId, client_id: clientId, pipeline_id: pipelineId, current_stage_id: stageId, title: title.trim(), status: "draft", target_channel: "creative", payload: { brief_text: brief.trim(), format, department: "creative", intake_source: "manual" } }).select("id").single();
      if (error) throw error;
      toast.success("הבריף נכנס למחלקת הקריאייטיב");
      setTitle(""); setBrief("");
      onCreated(data.id);
    } catch (error: unknown) { toast.error(errorMessage(error, "יצירת הפרויקט נכשלה")); } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-w-xl" dir="rtl"><DialogHeader><DialogTitle>פרויקט קריאייטיב חדש</DialogTitle></DialogHeader><div className="grid gap-4 py-2"><div><Label>שם הפרויקט</Label><Input className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="לדוגמה: סרטון השקת השירות" /></div><div><Label>פורמט</Label><Select value={format} onValueChange={setFormat}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="9:16">סטורי / רילס 9:16</SelectItem><SelectItem value="1:1">פוסט מרובע 1:1</SelectItem><SelectItem value="4:5">פיד 4:5</SelectItem><SelectItem value="16:9">וידאו רחב 16:9</SelectItem></SelectContent></Select></div><div><Label>בריף ויזואלי</Label><Textarea className="mt-1 min-h-36" value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="מטרה, קהל, מסר, סגנון, רפרנסים, מגבלות ומה חייב להופיע" /></div><Button onClick={create} disabled={saving || !title.trim() || !brief.trim()} className="gap-2 bg-pink-600 hover:bg-pink-700">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}פתח פרויקט</Button></div></DialogContent></Dialog>;
}

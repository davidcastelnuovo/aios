import { useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CreativeImage } from "@/components/marketing/departments/creative/CreativeImage";
import { Copy, Image as ImageIcon, Loader2, Plus, Save, Trash2, WandSparkles } from "lucide-react";
import type { StoryboardFrame } from "./types";
import { makeStoryboardFrame } from "./utils";

interface Props {
  frames: StoryboardFrame[];
  onChange: (frames: StoryboardFrame[]) => void;
  onSave: () => Promise<void>;
  onGenerateFrame: (frame: StoryboardFrame) => Promise<void>;
  onGenerateAll?: () => Promise<void>;
  generating?: boolean;
  saving?: boolean;
  scenePanelOpen?: boolean;
  onScenePanelOpenChange?: (open: boolean) => void;
}

type StoryboardNode = Node<StoryboardFrame, "storyboard">;

function StoryboardCard({ data, selected }: NodeProps<StoryboardNode>) {
  return (
    <Card className={cn("w-60 overflow-hidden border-2 bg-card p-0 shadow-lg", selected && "border-pink-500 ring-4 ring-pink-500/10")} dir="rtl">
      <Handle type="target" position={Position.Right} />
      <div className="relative aspect-video bg-muted">
        {data.imageUrl ? (
          <CreativeImage src={data.imageUrl} alt={data.title} className="h-full w-full object-cover" />
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

export function CreativeStoryboardEditor({
  frames,
  onChange,
  onSave,
  onGenerateFrame,
  onGenerateAll,
  generating,
  saving,
  scenePanelOpen,
  onScenePanelOpenChange,
}: Props) {
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(frames[0]?.id ?? null);
  const [frameDraft, setFrameDraft] = useState<StoryboardFrame | null>(frames[0] ?? null);
  const [internalSceneOpen, setInternalSceneOpen] = useState(false);

  const sceneOpen = scenePanelOpen ?? internalSceneOpen;
  const setSceneOpen = onScenePanelOpenChange ?? setInternalSceneOpen;

  useEffect(() => {
    if (!selectedFrameId && frames[0]?.id) setSelectedFrameId(frames[0].id);
    if (selectedFrameId && !frames.some((frame) => frame.id === selectedFrameId)) {
      setSelectedFrameId(frames[0]?.id ?? null);
    }
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

  const updateFrames = (next: StoryboardFrame[]) => onChange(next);

  const saveFrameDraft = () => {
    if (!frameDraft) return;
    updateFrames(frames.map((frame) => frame.id === frameDraft.id ? frameDraft : frame));
  };

  const addFrame = () => {
    const next = [...frames, makeStoryboardFrame(frames.length + 1)];
    updateFrames(next);
    const newId = next[next.length - 1].id;
    setSelectedFrameId(newId);
    setSceneOpen(true);
  };

  const duplicateFrame = () => {
    if (!frameDraft) return;
    const copy = { ...frameDraft, id: crypto.randomUUID(), order: frames.length + 1, x: frameDraft.x + 300 };
    updateFrames([...frames, copy]);
    setSelectedFrameId(copy.id);
  };

  const removeFrame = () => {
    if (!frameDraft) return;
    const next = frames.filter((frame) => frame.id !== frameDraft.id).map((frame, index) => ({ ...frame, order: index + 1 }));
    updateFrames(next);
    if (next.length === 0) setSceneOpen(false);
  };

  const selectFrame = (frameId: string) => {
    setSelectedFrameId(frameId);
    setSceneOpen(true);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-xs text-muted-foreground">Storyboard עקבי — פריים 1 קובע סגנון, הבאים נוצרים מולו</span>
        <div className="flex gap-2">
          {onGenerateAll && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void onGenerateAll()} disabled={generating || frames.length === 0}>
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
              צור הכל לפי סדר
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={addFrame}><Plus className="h-3.5 w-3.5" />סצנה</Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void onSave()} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}שמור
          </Button>
        </div>
      </div>

      {frames.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground">
          <div>
            <p className="text-sm">אין סצנות עדיין</p>
            <Button className="mt-4 gap-2" onClick={addFrame}><Plus className="h-4 w-4" />הוסף סצנה ראשונה</Button>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1" dir="ltr">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            onNodeClick={(_, node) => selectFrame(node.id)}
            onNodeDragStop={(_, node) => {
              updateFrames(frames.map((frame) => frame.id === node.id ? { ...frame, x: node.position.x, y: node.position.y } : frame));
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={24} size={1} />
            <Controls position="bottom-left" />
          </ReactFlow>
        </div>
      )}

      <Sheet open={sceneOpen} onOpenChange={setSceneOpen}>
        <SheetContent side="left" className="flex w-[360px] max-w-[90vw] flex-col gap-0 p-0 sm:max-w-[360px]" dir="rtl">
          <SheetHeader className="border-b px-6 py-4 text-right">
            <SheetTitle>{frameDraft ? `עריכת סצנה ${frameDraft.order}` : "עריכת סצנה"}</SheetTitle>
          </SheetHeader>
          {frameDraft ? (
            <ScrollArea className="flex-1">
              <div className="space-y-4 p-4">
                <div><Label>שם הסצנה</Label><Input className="mt-1" value={frameDraft.title} onChange={(event) => setFrameDraft({ ...frameDraft, title: event.target.value })} /></div>
                <div><Label>סוג שוט</Label><Select value={frameDraft.shot} onValueChange={(value) => setFrameDraft({ ...frameDraft, shot: value })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{["Close-up", "Medium shot", "Wide shot", "POV", "Product shot", "UGC handheld", "Cinematic tracking"].map((shot) => <SelectItem key={shot} value={shot}>{shot}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>מה רואים בפריים?</Label><Textarea className="mt-1 min-h-24" value={frameDraft.visualPrompt} onChange={(event) => setFrameDraft({ ...frameDraft, visualPrompt: event.target.value })} /></div>
                <div><Label>טקסט על המסך</Label><Textarea className="mt-1 min-h-16" value={frameDraft.overlayText} onChange={(event) => setFrameDraft({ ...frameDraft, overlayText: event.target.value })} /></div>
                <div><Label>קריינות / דיאלוג</Label><Textarea className="mt-1 min-h-20" value={frameDraft.voiceover} onChange={(event) => setFrameDraft({ ...frameDraft, voiceover: event.target.value })} /></div>
                <div><Label>משך בשניות</Label><Input className="mt-1" type="number" min={1} max={30} value={frameDraft.duration} onChange={(event) => setFrameDraft({ ...frameDraft, duration: Number(event.target.value) || 1 })} /></div>
                <Button variant="outline" className="w-full gap-2" onClick={saveFrameDraft}><Save className="h-4 w-4" />עדכן סצנה</Button>
                <Button
                  className="w-full gap-2 bg-gradient-to-r from-pink-600 to-violet-600"
                  onClick={() => {
                    saveFrameDraft();
                    void onGenerateFrame(frameDraft);
                  }}
                  disabled={generating || (!frameDraft.visualPrompt?.trim() && !frameDraft.voiceover?.trim())}
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                  {frameDraft.imageUrl ? "צור וריאציה" : "צור פריים"}
                </Button>
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  פריים 1 קובע את הסגנון (אנשים, תאורה, פלטה). פריימים הבאים נוצרים מולו כדי לשמור עקביות — לא קולאז׳ ולא איור. תאר רק מה משתנה בסצנה.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={duplicateFrame}><Copy className="h-3.5 w-3.5" />שכפל</Button>
                  <Button variant="outline" size="sm" className="gap-1 text-destructive" onClick={removeFrame}><Trash2 className="h-3.5 w-3.5" />מחק</Button>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">בחר סצנה לעריכה</div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  type Node,
  type Edge,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Lightbulb,
  PenLine,
  Image as ImageIcon,
  Megaphone,
  Search,
  Share2,
  BarChart3,
  Bot,
  CheckCircle2,
  Settings,
} from "lucide-react";
import { StageConfigDialog } from "./StageConfigDialog";

const STAGE_ICONS: Record<string, any> = {
  strategy: Lightbulb,
  copy: PenLine,
  creative: ImageIcon,
  target_paid: Megaphone,
  target_seo: Search,
  target_organic: Share2,
  measurement: BarChart3,
};

const STAGE_COLORS: Record<string, string> = {
  strategy: "from-amber-500/20 to-amber-500/5 border-amber-500/40",
  copy: "from-sky-500/20 to-sky-500/5 border-sky-500/40",
  creative: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/40",
  target_paid: "from-rose-500/20 to-rose-500/5 border-rose-500/40",
  target_seo: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40",
  target_organic: "from-violet-500/20 to-violet-500/5 border-violet-500/40",
  measurement: "from-blue-500/20 to-blue-500/5 border-blue-500/40",
};

function StageNode({ data }: { data: any }) {
  const Icon = STAGE_ICONS[data.stage_type] ?? Lightbulb;
  const color = STAGE_COLORS[data.stage_type] ?? "from-muted to-muted/40 border-border";
  const configured = !!data.agentName || !!data.hasInstructions;
  return (
    <Card
      dir="rtl"
      className={`min-w-[220px] cursor-pointer border-2 bg-gradient-to-br ${color} p-3 shadow-md transition-all hover:shadow-lg`}
      onClick={data.onClick}
    >
      <Handle type="source" position={Position.Left} />
      <div className="flex items-start gap-2">
        <div className="rounded-md bg-background/60 p-1.5">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1 text-sm font-semibold">
            {data.name}
            {configured && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Bot className="h-3 w-3" />
            {data.agentName ?? "ללא אייג'נט"}
          </div>
        </div>
        <Settings className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Badge variant="outline" className="text-[10px]">
          {data.itemCount ?? 0} פריטים
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          {data.approvalLabel}
        </Badge>
      </div>
      <Handle type="target" position={Position.Right} />
    </Card>
  );
}

const nodeTypes = { stage: StageNode };

interface Props {
  pipelineId: string;
  tenantId: string;
  clientId: string;
  track?: string;
  onSelectItem: (id: string) => void;
}

const APPROVAL_LABELS: Record<string, string> = {
  manual: "ידני",
  auto: "אוטומטי",
  hybrid: "היברידי",
};

export function PipelineCanvas({ pipelineId, tenantId, clientId, track, onSelectItem }: Props) {
  const queryClient = useQueryClient();
  const [openStageId, setOpenStageId] = useState<string | null>(null);

  const { data: stages, refetch: refetchStages } = useQuery({
    queryKey: ["marketing-stages", pipelineId],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_pipeline_stages")
        .select("*, ai_agents(name)")
        .eq("pipeline_id", pipelineId)
        .order("sort_order");
      return data ?? [];
    },
  });

  const { data: items } = useQuery({
    queryKey: ["marketing-items", pipelineId],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_work_items")
        .select("id, title, status, current_stage_id, scheduled_date, payload")
        .eq("pipeline_id", pipelineId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const itemCounts: Record<string, number> = useMemo(() => {
    const counts: Record<string, number> = {};
    (items ?? []).forEach((row: any) => {
      if (row.current_stage_id) counts[row.current_stage_id] = (counts[row.current_stage_id] ?? 0) + 1;
    });
    return counts;
  }, [items]);

  const nodes: Node[] = useMemo(() => {
    return (stages ?? []).map((s: any) => ({
      id: s.id,
      type: "stage",
      position: { x: s.position_x, y: s.position_y },
      data: {
        name: s.name,
        stage_type: s.stage_type,
        agentName: s.ai_agents?.name,
        hasInstructions: !!s.configuration?.instructions,
        approvalLabel: APPROVAL_LABELS[s.approval_mode] ?? s.approval_mode,
        itemCount: itemCounts[s.id] ?? 0,
        onClick: () => setOpenStageId(s.id),
      },
      draggable: true,
    }));
  }, [stages, itemCounts]);

  const edges: Edge[] = useMemo(() => {
    if (!stages) return [];
    const sorted = [...stages].sort((a: any, b: any) => a.sort_order - b.sort_order);
    const out: Edge[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      out.push({
        id: `${sorted[i].id}-${sorted[i + 1].id}`,
        source: sorted[i].id,
        target: sorted[i + 1].id,
        animated: true,
      });
    }
    return out;
  }, [stages]);

  const openStage = (stages ?? []).find((s: any) => s.id === openStageId) ?? null;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex-1 min-h-0" dir="ltr">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
        </ReactFlow>
      </div>

      {(items ?? []).length > 0 && (
        <div className="border-t bg-card/40 px-4 py-2" dir="rtl">
          <div className="mb-1 text-xs font-medium text-muted-foreground">פריטי תוכן ({items?.length})</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(items ?? []).map((it: any) => (
              <button
                key={it.id}
                onClick={() => onSelectItem(it.id)}
                className="shrink-0 rounded-md border bg-background px-3 py-1.5 text-right text-xs hover:bg-muted/60"
              >
                <div className="font-medium">{it.title ?? "ללא כותרת"}</div>
                <div className="text-[10px] text-muted-foreground">
                  {it.scheduled_date ?? "לא תוזמן"} · {it.status}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <StageConfigDialog
        stage={openStage as any}
        tenantId={tenantId}
        clientId={clientId}
        track={track}
        onClose={() => setOpenStageId(null)}
        onSaved={() => {
          refetchStages();
          queryClient.invalidateQueries({ queryKey: ["marketing-stages", pipelineId] });
        }}
      />
    </div>
  );
}

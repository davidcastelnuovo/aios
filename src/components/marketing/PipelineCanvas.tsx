import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb,
  PenLine,
  Image as ImageIcon,
  Megaphone,
  Search,
  Share2,
  BarChart3,
  Bot,
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
  return (
    <Card
      dir="rtl"
      className={`min-w-[220px] cursor-pointer border-2 bg-gradient-to-br ${color} p-3 shadow-md transition-all hover:shadow-lg`}
      onClick={data.onClick}
    >
      {/* RTL: source on the left (output), target on the right (input) */}
      <Handle type="source" position={Position.Left} />
      <div className="flex items-start gap-2">
        <div className="rounded-md bg-background/60 p-1.5">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">{data.name}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Bot className="h-3 w-3" />
            {data.agentName ?? "ללא אייג'נט"}
          </div>
        </div>
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
  onSelectItem: (id: string) => void;
}

const APPROVAL_LABELS: Record<string, string> = {
  manual: "ידני",
  auto: "אוטומטי",
  hybrid: "היברידי",
};

export function PipelineCanvas({ pipelineId, tenantId, clientId }: Props) {
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

  const { data: itemCounts } = useQuery({
    queryKey: ["marketing-item-counts", pipelineId],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_work_items")
        .select("current_stage_id")
        .eq("pipeline_id", pipelineId);
      const counts: Record<string, number> = {};
      (data ?? []).forEach((row: any) => {
        if (row.current_stage_id) counts[row.current_stage_id] = (counts[row.current_stage_id] ?? 0) + 1;
      });
      return counts;
    },
  });

  const nodes: Node[] = useMemo(() => {
    return (stages ?? []).map((s: any) => ({
      id: s.id,
      type: "stage",
      position: { x: s.position_x, y: s.position_y },
      data: {
        name: s.name,
        stage_type: s.stage_type,
        agentName: s.ai_agents?.name,
        approvalLabel: APPROVAL_LABELS[s.approval_mode] ?? s.approval_mode,
        itemCount: itemCounts?.[s.id] ?? 0,
        onClick: () => setOpenStageId(s.id),
      },
      draggable: true,
    }));
  }, [stages, itemCounts]);

  const edges: Edge[] = useMemo(() => {
    if (!stages) return [];
    const byType: Record<string, any> = {};
    stages.forEach((s: any) => (byType[s.stage_type] = s));
    const out: Edge[] = [];
    const link = (a: string, b: string) => {
      if (byType[a] && byType[b]) {
        out.push({
          id: `${byType[a].id}-${byType[b].id}`,
          source: byType[a].id,
          target: byType[b].id,
          animated: true,
        });
      }
    };
    link("strategy", "copy");
    link("copy", "creative");
    link("creative", "target_paid");
    link("creative", "target_seo");
    link("creative", "target_organic");
    link("target_paid", "measurement");
    link("target_seo", "measurement");
    link("target_organic", "measurement");
    return out;
  }, [stages]);

  const openStage = (stages ?? []).find((s: any) => s.id === openStageId) ?? null;

  return (
    <div className="h-full w-full" dir="ltr">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>

      <StageConfigDialog
        stage={openStage}
        tenantId={tenantId}
        clientId={clientId}
        onClose={() => setOpenStageId(null)}
        onSaved={() => {
          refetchStages();
        }}
      />
    </div>
  );
}

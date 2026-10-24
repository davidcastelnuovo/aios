import { useEffect } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";
import { workshopFlow, type FlowNode } from "./workshopBoard";

type WorkshopNodeData = FlowNode["data"];

function WorkshopNode({ data }: NodeProps<Node<WorkshopNodeData>>) {
  return (
    <div
      className={cn(
        "w-[220px] rounded-xl border bg-card px-3 py-2.5 shadow-sm",
        data.kind === "project" && "border-pink-400/70 shadow-md",
        data.ready && "border-emerald-500/60",
      )}
    >
      {data.kind === "step" && (
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-slate-400"
        />
      )}
      <div className="text-sm font-medium">{data.label}</div>
      {data.kind === "step" && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          {data.ready ? "התחיל" : "עדיין לא"}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-slate-400"
      />
    </div>
  );
}

const nodeTypes = { workshop: WorkshopNode };

function FitView({ fitKey }: { fitKey: string }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      fitView({ padding: 0.35, duration: 240 });
    });
    return () => cancelAnimationFrame(frame);
  }, [fitKey, fitView]);
  return null;
}

/** A full-size board you can pan, zoom, and drag, like the automations canvas. */
export function WorkshopCanvas({
  title,
  payload,
  blank,
  quiet = false,
}: {
  title: string | null;
  payload: Record<string, unknown> | null;
  blank: boolean;
  /** Empty canvas with no invitation, used while projects are still loading. */
  quiet?: boolean;
}) {
  const flow = blank
    ? { nodes: [] as FlowNode[], edges: [] }
    : workshopFlow(title, payload);
  const [nodes, setNodes, onNodesChange] = useNodesState(flow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flow.edges);
  const fitKey = blank
    ? "blank"
    : `${title ?? ""}:${flow.nodes.map((node) => node.id).join()}`;

  useEffect(() => {
    const next = blank
      ? { nodes: [] as FlowNode[], edges: [] }
      : workshopFlow(title, payload);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [blank, title, payload, setNodes, setEdges]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        panOnDrag
        panOnScroll
        nodesDraggable
        minZoom={0.15}
        maxZoom={1.75}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
        <Controls />
        <MiniMap />
        <FitView fitKey={fitKey} />
        {blank && !quiet ? (
          <Panel position="top-center">
            <p className="max-w-[calc(100vw-2rem)] rounded-full border bg-background/90 px-3 py-1.5 text-center text-xs text-muted-foreground shadow-sm sm:px-4 sm:py-2 sm:text-sm">
              לוח חדש. דברו עם כרמן והיא מתחילה.
            </p>
          </Panel>
        ) : null}
      </ReactFlow>
    </div>
  );
}

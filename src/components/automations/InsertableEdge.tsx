import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InsertableEdgeData {
  onInsert?: (sourceId: string, targetId: string) => void;
}

export function InsertableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  source,
  target,
  data,
}: EdgeProps & { data?: InsertableEdgeData }) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6 rounded-full bg-background border-border shadow-md hover:bg-primary hover:text-primary-foreground transition-all opacity-60 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              data?.onInsert?.(source, target);
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
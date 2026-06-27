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
            className="h-5 w-5 rounded-full bg-background border-primary/40 shadow-md hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              data?.onInsert?.(source, target);
            }}
            title="הוסף צעד כאן"
          >
            <Plus className="h-2.5 w-2.5" />
          </Button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
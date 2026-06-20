import { useDraggable } from "@dnd-kit/core";
import { GlassPanel } from "./GlassPanel";
import { AgentAvatar } from "./AgentAvatar";
import { ISLAND_TOKENS, STATUS_DOT } from "../utils/glassTokens";
import type { IslandSummary, LayoutItem } from "../types/visualWorkspaceTypes";
import { Maximize2, GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  island: IslandSummary;
  layout: LayoutItem;
  onOpen: () => void;
}

export function DepartmentIsland({ island, layout, onOpen }: Props) {
  const tokens = ISLAND_TOKENS[island.id] ?? ISLAND_TOKENS.management;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: island.id,
  });

  const style: React.CSSProperties = {
    position: "absolute",
    left: layout.x_position,
    top: layout.y_position,
    width: layout.width,
    height: layout.height,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 50 : 1,
    cursor: isDragging ? "grabbing" : "default",
  };

  return (
    <div ref={setNodeRef} style={style} className="touch-none">
      <GlassPanel
        className={cn(
          "h-full w-full overflow-hidden flex flex-col bg-gradient-to-br",
          tokens.from,
          tokens.to,
          "transition-shadow hover:shadow-[0_16px_48px_-8px_rgba(15,23,42,0.18)]",
          isDragging && "shadow-[0_20px_60px_-10px_rgba(15,23,42,0.25)]",
        )}
      >
        {/* drag handle bar */}
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-between px-4 pt-3 pb-1 cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[island.status])} />
            <h3 className={cn("text-sm font-bold", tokens.label)}>{island.name}</h3>
          </div>
          <GripHorizontal className="h-4 w-4 text-slate-400" />
        </div>

        <div className="px-4 text-[11px] text-slate-500 truncate">{island.description}</div>

        <div className="flex items-start gap-3 px-4 mt-2 flex-1 min-h-0">
          <div className="shrink-0">
            <AgentAvatar role={island.agentRole} state={island.alerts > 0 ? "waiting" : "idle"} size={56} />
            <div className="text-[10px] text-center text-slate-500 mt-0.5 truncate w-14">{island.agentName}</div>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            {island.kpis.slice(0, 3).map((k, i) => (
              <div key={i} className="flex items-center justify-between text-xs gap-2">
                <span className="text-slate-500 truncate">{k.label}</span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    k.tone === "danger" && "text-rose-600",
                    k.tone === "warning" && "text-amber-600",
                    k.tone === "success" && "text-emerald-600",
                    !k.tone && "text-slate-800"
                  )}
                >
                  {k.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="m-3 mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-white/70 hover:bg-white border border-white/80 py-1.5 text-xs font-medium text-slate-700 transition"
        >
          <Maximize2 className="h-3 w-3" />
          פתיחת המחלקה
        </button>
      </GlassPanel>
    </div>
  );
}

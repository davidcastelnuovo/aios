import { useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useVisualWorkspaceData } from "../hooks/useVisualWorkspaceData";
import { useWorkspaceLayout } from "../hooks/useWorkspaceLayout";
import { BusinessCore } from "./BusinessCore";
import { DepartmentIsland } from "./DepartmentIsland";
import { IslandPanel } from "./IslandPanel";
import { CustomerSheet } from "./CustomerSheet";
import { TaskSheet } from "./TaskSheet";
import { AgentSheet } from "./AgentSheet";
import { DEFAULT_LAYOUTS, snapTo, clampToCanvas } from "../utils/layoutUtils";
import type { IslandSummary, IslandId } from "../types/visualWorkspaceTypes";
import { Sparkles, Loader2 } from "lucide-react";

const CANVAS_W = 1800;
const CANVAS_H = 1000;

export function WorkspaceCanvas() {
  const { data, isLoading } = useVisualWorkspaceData();
  const { layout, updateItem, loaded } = useWorkspaceLayout();
  const [openIsland, setOpenIsland] = useState<IslandSummary | null>(null);
  const [sheet, setSheet] = useState<{ kind: "client" | "task" | "agent"; id: string } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const item = layout[id] ?? DEFAULT_LAYOUTS[id as IslandId];
    if (!item) return;
    const newX = snapTo(item.x_position + e.delta.x);
    const newY = snapTo(item.y_position + e.delta.y);
    const clamped = clampToCanvas(newX, newY, item.width, item.height, CANVAS_W, CANVAS_H);
    updateItem(id, { x_position: clamped.x, y_position: clamped.y });
  };

  const coreLayout = layout.core ?? DEFAULT_LAYOUTS.core;

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-auto bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(220 15% 85%) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="sticky top-0 z-30 flex items-center gap-2 px-6 py-3 bg-white/70 backdrop-blur-xl border-b border-white/60">
        <Sparkles className="h-5 w-5 text-indigo-600" />
        <h1 className="text-lg font-bold text-slate-900">Visual Workspace</h1>
        <span className="text-xs text-slate-500">— מרחב ניהול ויזואלי</span>
      </div>

      {(isLoading || !loaded || !data) ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>
            {/* Business Core fixed at center, not draggable */}
            <div style={{ position: "absolute", left: coreLayout.x_position, top: coreLayout.y_position }}>
              <BusinessCore data={data.core} width={coreLayout.width} height={coreLayout.height} />
            </div>

            {data.islands.map((island) => {
              const lay = layout[island.id] ?? DEFAULT_LAYOUTS[island.id];
              return (
                <DepartmentIsland
                  key={island.id}
                  island={island}
                  layout={lay}
                  onOpen={() => setOpenIsland(island)}
                />
              );
            })}
          </div>
        </DndContext>
      )}

      <IslandPanel
        island={openIsland}
        onClose={() => setOpenIsland(null)}
        onOpenSheet={(kind, id) => setSheet({ kind, id })}
      />

      <CustomerSheet clientId={sheet?.kind === "client" ? sheet.id : null} onClose={() => setSheet(null)} />
      <TaskSheet taskId={sheet?.kind === "task" ? sheet.id : null} onClose={() => setSheet(null)} />
      <AgentSheet agentId={sheet?.kind === "agent" ? sheet.id : null} onClose={() => setSheet(null)} />
    </div>
  );
}

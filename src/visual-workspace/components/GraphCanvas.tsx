import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphifyNode, GraphifyEdge } from "../hooks/useGraphify";

const TYPE_COLORS: Record<string, string> = {
  component: "#6366f1",
  hook: "#8b5cf6",
  page: "#0ea5e9",
  edge_function: "#f59e0b",
  sql_table: "#10b981",
  sql_function: "#14b8a6",
  module: "#64748b",
  other: "#94a3b8",
};

function colorFor(fileType: string | null): string {
  return TYPE_COLORS[fileType || "other"] || TYPE_COLORS.other;
}

type SimNode = GraphifyNode & { x: number; y: number; vx: number; vy: number };

/**
 * Dependency-free force layout: runs a bounded number of ticks off-screen,
 * then renders a static SVG (pan/zoom via viewBox). Good for up to ~400 nodes.
 */
export function GraphCanvas({
  nodes,
  edges,
  onSelect,
  selectedId,
}: {
  nodes: GraphifyNode[];
  edges: GraphifyEdge[];
  onSelect?: (node: GraphifyNode | null) => void;
  selectedId?: string | null;
}) {
  const [layout, setLayout] = useState<SimNode[] | null>(null);
  const [viewBox, setViewBox] = useState("0 0 1000 700");
  const dragRef = useRef<{ startX: number; startY: number; vb: number[] } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const nodeIndex = useMemo(() => new Map(nodes.map((n, i) => [n.id, i])), [nodes]);

  useEffect(() => {
    if (!nodes.length) { setLayout(null); return; }
    const W = 1000, H = 700;
    // Seed on a phyllotaxis spiral for stable, overlap-free starting positions.
    const sim: SimNode[] = nodes.map((n, i) => {
      const r = 14 * Math.sqrt(i + 1);
      const a = i * 2.399963;
      return { ...n, x: W / 2 + r * Math.cos(a), y: H / 2 + r * Math.sin(a), vx: 0, vy: 0 };
    });
    const links = edges
      .map((e) => ({ s: nodeIndex.get(e.source), t: nodeIndex.get(e.target) }))
      .filter((l): l is { s: number; t: number } => l.s !== undefined && l.t !== undefined);

    const ticks = Math.min(150, 4000 / Math.max(nodes.length, 1) + 60);
    for (let tick = 0; tick < ticks; tick++) {
      const alpha = 1 - tick / ticks;
      // Repulsion (sampled for large graphs to stay O(n·k))
      for (let i = 0; i < sim.length; i++) {
        const a = sim[i];
        const step = sim.length > 200 ? 3 : 1;
        for (let j = i + 1; j < sim.length; j += step) {
          const b = sim[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
          if (d2 > 40000) continue;
          const f = (900 * alpha) / d2;
          a.vx += dx * f; a.vy += dy * f;
          b.vx -= dx * f; b.vy -= dy * f;
        }
      }
      // Springs
      for (const { s, t } of links) {
        const a = sim[s], b = sim[t];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = ((d - 60) / d) * 0.04 * alpha;
        a.vx += dx * f; a.vy += dy * f;
        b.vx -= dx * f; b.vy -= dy * f;
      }
      // Gravity + integrate
      for (const n of sim) {
        n.vx += (W / 2 - n.x) * 0.002 * alpha;
        n.vy += (H / 2 - n.y) * 0.002 * alpha;
        n.x += n.vx *= 0.85;
        n.y += n.vy *= 0.85;
      }
    }
    setLayout(sim);
    // Fit viewBox to content
    const xs = sim.map(n => n.x), ys = sim.map(n => n.y);
    const pad = 60;
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
    setViewBox(`${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
  }, [nodes, edges, nodeIndex]);

  const positioned = useMemo(() => {
    if (!layout) return { byId: new Map<string, SimNode>(), list: [] as SimNode[] };
    return { byId: new Map(layout.map(n => [n.id, n])), list: layout };
  }, [layout]);

  const handleWheel = (e: React.WheelEvent) => {
    const [x, y, w, h] = viewBox.split(" ").map(Number);
    const factor = e.deltaY > 0 ? 1.15 : 0.87;
    const nw = w * factor, nh = h * factor;
    setViewBox(`${x + (w - nw) / 2} ${y + (h - nh) / 2} ${nw} ${nh}`);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, vb: viewBox.split(" ").map(Number) };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !svgRef.current) return;
    const { startX, startY, vb } = dragRef.current;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = vb[2] / rect.width, scaleY = vb[3] / rect.height;
    setViewBox(`${vb[0] - (e.clientX - startX) * scaleX} ${vb[1] - (e.clientY - startY) * scaleY} ${vb[2]} ${vb[3]}`);
  };
  const handlePointerUp = () => { dragRef.current = null; };

  if (!layout) {
    return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">אין נתונים להצגה</div>;
  }

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={() => onSelect?.(null)}
    >
      <g stroke="currentColor" strokeOpacity={0.12}>
        {edges.map((e, i) => {
          const s = positioned.byId.get(e.source), t = positioned.byId.get(e.target);
          if (!s || !t) return null;
          return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} strokeWidth={1} />;
        })}
      </g>
      {positioned.list.map((n) => {
        const r = Math.min(4 + Math.sqrt(n.degree || 1) * 1.6, 18);
        const isSelected = n.id === selectedId;
        return (
          <g
            key={n.id}
            transform={`translate(${n.x},${n.y})`}
            className="cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onSelect?.(n); }}
          >
            <circle
              r={r}
              fill={colorFor(n.file_type)}
              fillOpacity={isSelected ? 1 : 0.8}
              stroke={isSelected ? "#0f172a" : "white"}
              strokeWidth={isSelected ? 2.5 : 1}
            />
            {(r > 9 || isSelected) && (
              <text y={r + 11} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.75}>
                {n.label.length > 28 ? n.label.slice(0, 26) + "…" : n.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function GraphLegend() {
  const entries: [string, string][] = [
    ["component", "קומפוננטה"],
    ["hook", "Hook"],
    ["page", "עמוד"],
    ["edge_function", "Edge Function"],
    ["sql_table", "טבלת SQL"],
    ["sql_function", "פונקציית SQL"],
  ];
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground" dir="rtl">
      {entries.map(([key, label]) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[key] }} />
          {label}
        </span>
      ))}
    </div>
  );
}

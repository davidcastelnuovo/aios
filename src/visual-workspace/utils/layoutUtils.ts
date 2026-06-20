import type { IslandId, LayoutItem } from "../types/visualWorkspaceTypes";

// Default layout in a circle around the central core
export const DEFAULT_LAYOUTS: Record<IslandId, LayoutItem> = {
  core:             { module_id: "core",             x_position: 720, y_position: 360, width: 360, height: 280, is_open: false },
  management:       { module_id: "management",       x_position: 360, y_position: 80,  width: 300, height: 220, is_open: false },
  marketing:        { module_id: "marketing",        x_position: 1100, y_position: 80,  width: 300, height: 220, is_open: false },
  sales:            { module_id: "sales",            x_position: 1380, y_position: 360, width: 300, height: 220, is_open: false },
  creative:         { module_id: "creative",         x_position: 1100, y_position: 660, width: 300, height: 220, is_open: false },
  finance:          { module_id: "finance",          x_position: 720,  y_position: 720, width: 300, height: 220, is_open: false },
  development:      { module_id: "development",      x_position: 360,  y_position: 660, width: 300, height: 220, is_open: false },
  customer_success: { module_id: "customer_success", x_position: 80,   y_position: 360, width: 300, height: 220, is_open: false },
  system:           { module_id: "system",           x_position: 80,   y_position: 80,  width: 300, height: 220, is_open: false },
  agents:           { module_id: "agents",           x_position: 1380, y_position: 80,  width: 300, height: 220, is_open: false },
};

export const ISLAND_IDS: IslandId[] = [
  "management",
  "marketing",
  "sales",
  "creative",
  "finance",
  "development",
  "customer_success",
  "system",
  "agents",
];

export const SNAP = 16;

export function snapTo(value: number, grid = SNAP): number {
  return Math.round(value / grid) * grid;
}

export function clampToCanvas(x: number, y: number, w: number, h: number, canvasW: number, canvasH: number) {
  return {
    x: Math.max(0, Math.min(x, canvasW - w)),
    y: Math.max(0, Math.min(y, canvasH - h)),
  };
}

import type { IslandId } from "../types/visualWorkspaceTypes";

export const ISLAND_TOKENS: Record<IslandId, { from: string; to: string; ring: string; label: string }> = {
  core:             { from: "from-slate-50",     to: "to-white",          ring: "ring-slate-200",     label: "text-slate-900" },
  management:       { from: "from-indigo-50",    to: "to-white",          ring: "ring-indigo-200",    label: "text-indigo-900" },
  marketing:        { from: "from-violet-50",    to: "to-blue-50",        ring: "ring-violet-200",    label: "text-violet-900" },
  sales:            { from: "from-orange-50",    to: "to-amber-50",       ring: "ring-orange-200",    label: "text-orange-900" },
  creative:         { from: "from-pink-50",      to: "to-emerald-50",     ring: "ring-pink-200",      label: "text-pink-900" },
  finance:          { from: "from-emerald-50",   to: "to-white",          ring: "ring-emerald-200",   label: "text-emerald-900" },
  development:      { from: "from-sky-50",       to: "to-cyan-50",        ring: "ring-sky-200",       label: "text-sky-900" },
  customer_success: { from: "from-teal-50",      to: "to-white",          ring: "ring-teal-200",      label: "text-teal-900" },
  system:           { from: "from-slate-100",    to: "to-zinc-50",        ring: "ring-slate-300",     label: "text-slate-800" },
  agents:           { from: "from-amber-50",     to: "to-yellow-50",      ring: "ring-amber-200",     label: "text-amber-900" },
};

export const STATUS_DOT: Record<"good" | "watch" | "alert", string> = {
  good: "bg-emerald-500",
  watch: "bg-amber-500",
  alert: "bg-rose-500",
};

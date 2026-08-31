import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CoreOverviewPanel, HealthPanel, IntelFeedPanel, QuickCommandsPanel,
  TasksPanel, TimelinePanel,
} from "./panels";
import { UsagePanel } from "./UsagePanel";
import { CarmenFace, type CarmenFaceState } from "./CarmenFace";

export type HudWindowId = "tasks" | "timeline" | "core" | "intel" | "commands" | "health" | "usage" | "face";

const HUD_ITEMS: Array<{ id: HudWindowId; label: string }> = [
  { id: "tasks", label: "משימות" },
  { id: "timeline", label: "ציר זמן" },
  { id: "core", label: "סקירה" },
  { id: "intel", label: "פיד" },
  { id: "commands", label: "פקודות" },
  { id: "health", label: "בריאות" },
  { id: "usage", label: "שימוש API" },
  { id: "face", label: "דיוקן כרמן" },
];

interface HudMenuProps {
  tenantId: string | null;
  faceState: CarmenFaceState;
  audioLevelRef: React.MutableRefObject<number>;
  onPrefill: (text: string) => void;
  onVoice: () => void;
  onHealthCheck: () => void;
}

export function HudMenu({
  tenantId,
  faceState,
  audioLevelRef,
  onPrefill,
  onVoice,
  onHealthCheck,
}: HudMenuProps) {
  const [open, setOpen] = useState<HudWindowId | null>(null);
  const current = HUD_ITEMS.find((i) => i.id === open);

  let body: ReactNode = null;
  if (open === "tasks") body = <TasksPanel tenantId={tenantId} className="max-h-[min(60dvh,28rem)]" />;
  if (open === "timeline") body = <TimelinePanel tenantId={tenantId} className="max-h-[min(60dvh,24rem)]" />;
  if (open === "core") body = <CoreOverviewPanel tenantId={tenantId} />;
  if (open === "intel") body = <IntelFeedPanel tenantId={tenantId} className="max-h-[min(60dvh,28rem)]" />;
  if (open === "commands") {
    body = (
      <QuickCommandsPanel
        onCommand={(text) => { onPrefill(text); setOpen(null); }}
        onVoice={() => { onVoice(); setOpen(null); }}
        onHealthCheck={onHealthCheck}
      />
    );
  }
  if (open === "health") body = <HealthPanel tenantId={tenantId} />;
  if (open === "usage") body = <UsagePanel tenantId={tenantId} />;
  if (open === "face") {
    body = (
      <div className="relative h-[min(55dvh,22rem)] overflow-hidden rounded-lg">
        <CarmenFace state={faceState} audioLevelRef={audioLevelRef} className="absolute inset-0 h-full w-full" />
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="cc-header-btn flex items-center gap-1 rounded-md border border-[var(--cc-line)] px-2 text-xs text-[var(--cc-accent)] hover:border-[var(--cc-line-strong)]"
          >
            לוח
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="cc-root z-[80] min-w-[10rem] border-[var(--cc-line)] bg-[rgba(8,16,34,0.96)] text-[var(--cc-text)]"
        >
          {HUD_ITEMS.map((item) => (
            <DropdownMenuItem
              key={item.id}
              className="cursor-pointer text-right"
              onSelect={() => setOpen(item.id)}
            >
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {open && typeof document !== "undefined" && createPortal(
        <div className="cc-hud-window cc-hud-window--portal" role="dialog" aria-label={current?.label}>
          <header className="mb-2 flex items-center justify-between gap-2">
            <h2 className="cc-panel-title">{current?.label}</h2>
            <button type="button" onClick={() => setOpen(null)} className="text-[var(--cc-text-dim)] hover:text-[var(--cc-accent)]" title="סגור">
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="cc-scroll min-h-0 flex-1 overflow-y-auto">{body}</div>
        </div>,
        document.body,
      )}
    </>
  );
}

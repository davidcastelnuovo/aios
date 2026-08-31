import { useEffect, useRef, useState } from "react";
import { History, PanelRightClose, X } from "lucide-react";
import { CarmenChatBar, CarmenChatBarHandle } from "./CarmenChatBar";
import { useBrainChannel } from "./useBrainChannel";
import { useSystemFixContext } from "@/hooks/useSystemFixContext";
import type { CarmenFaceState } from "./CarmenFace";
import "@/components/carmen-command/command-center.css";

interface CommandCenterSidecarProps {
  onClose?: () => void;
  className?: string;
}

/**
 * Persistent sidecar panel: Carmen text chat with live screen context for system fixes.
 */
export function CommandCenterSidecar({ onClose, className }: CommandCenterSidecarProps) {
  const contextMetadata = useSystemFixContext();
  const tenantId = contextMetadata.tenant_id ?? null;
  const brain = useBrainChannel(tenantId);
  const chatRef = useRef<CarmenChatBarHandle>(null);
  const [faceState, setFaceState] = useState<CarmenFaceState>("idle");
  const audioLevelRef = useRef(0);

  useEffect(() => {
    const internal = brain.routes.find((r) => r.slug === "internal");
    if (internal && brain.selected.slug !== "internal") {
      brain.selectRoute(internal, null);
    }
  }, [brain.routes, brain.selected.slug, brain]);

  return (
    <div
      dir="rtl"
      className={`cc-sidecar cc-root flex h-full min-h-0 flex-col overflow-hidden font-heebo ${className ?? ""}`}
    >
      <header className="cc-sidecar-header flex shrink-0 items-center justify-between gap-2 border-b border-[var(--cc-line)] px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--cc-accent)]">כרמן · תיקון מערכת</p>
          <p className="truncate text-[10px] text-[var(--cc-text-dim)]" title={contextMetadata.path}>
            {contextMetadata.path}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            title="שיחה חדשה"
            onClick={() => chatRef.current?.toggleHistory()}
            className="cc-header-btn flex h-8 w-8 items-center justify-center rounded-md border border-[var(--cc-line)] text-[var(--cc-text-dim)] hover:border-[var(--cc-line-strong)] hover:text-[var(--cc-accent)]"
          >
            <History className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              type="button"
              title="סגור סיידבר"
              onClick={onClose}
              className="cc-header-btn flex h-8 w-8 items-center justify-center rounded-md border border-[var(--cc-line)] text-[var(--cc-text-dim)] hover:border-[var(--cc-line-strong)] hover:text-[var(--cc-accent)]"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
        <CarmenChatBar
          ref={chatRef}
          tenantId={tenantId}
          brain={brain}
          onFaceState={setFaceState}
          audioLevelRef={audioLevelRef}
          mode="sidecar"
          contextMetadata={contextMetadata}
          sidecarPlaceholder="תארי תיקון / בקשה למסך הזה… (שלחי לפיתוח → Cursor)"
        />
      </div>
      <span className="sr-only" aria-live="polite">
        {faceState}
      </span>
    </div>
  );
}

/** Compact close control for mobile sheet header. */
export function CommandCenterSidecarSheetHeader({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="absolute left-3 top-3 rounded-sm opacity-70 hover:opacity-100"
      aria-label="סגור"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

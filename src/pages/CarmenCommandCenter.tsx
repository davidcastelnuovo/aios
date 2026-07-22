import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { CarmenFace, CarmenFaceState } from "@/components/carmen-command/CarmenFace";
import {
  CoreOverviewPanel, HealthPanel, IntelFeedPanel, QuickCommandsPanel,
  TasksPanel, TimelinePanel,
} from "@/components/carmen-command/panels";
import { UsagePanel } from "@/components/carmen-command/UsagePanel";
import { CarmenChatBar, CarmenChatBarHandle } from "@/components/carmen-command/CarmenChatBar";
import { useCommandRealtime } from "@/components/carmen-command/useCommandData";
import "@/components/carmen-command/command-center.css";

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-left leading-tight">
      <p className="cc-num text-lg font-bold">{now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
      <p className="text-[11px] text-[var(--cc-text-dim)]">{now.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</p>
    </div>
  );
}

/**
 * Carmen Command Center — full-screen sci-fi HUD dashboard.
 * Opened from the Carmen button in the app header. Read-only layer over
 * existing data sources + the existing chat/voice edge functions.
 */
export default function CarmenCommandCenter() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenantId } = useCurrentTenant();
  const qc = useQueryClient();
  const [faceState, setFaceState] = useState<CarmenFaceState>("idle");
  const audioLevelRef = useRef(0);
  const chatRef = useRef<CarmenChatBarHandle>(null);
  const alertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Critical alert → brief face flash (unless she's mid-conversation)
  const flashAlert = useCallback(() => {
    setFaceState(prev => {
      if (prev === "speaking" || prev === "listening") return prev;
      if (alertTimer.current) clearTimeout(alertTimer.current);
      alertTimer.current = setTimeout(() => setFaceState(p => (p === "alert" ? "idle" : p)), 4000);
      return "alert";
    });
  }, []);
  useCommandRealtime(tenantId, flashAlert);
  useEffect(() => () => { if (alertTimer.current) clearTimeout(alertTimer.current); }, []);

  const healthCheck = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["cc-health", tenantId] });
    qc.invalidateQueries({ queryKey: ["cc-feed", tenantId] });
  }, [qc, tenantId]);

  return (
    <div dir="rtl" className="cc-root flex h-dvh flex-col overflow-hidden font-heebo">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--cc-line)] px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            to={tenantSlug ? `/t/${tenantSlug}` : "/"}
            title="חזרה לאפליקציה"
            className="flex items-center gap-1 rounded-md border border-[var(--cc-line)] px-2 py-1 text-xs text-[var(--cc-text-dim)] hover:border-[var(--cc-line-strong)] hover:text-[var(--cc-text)]"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            חזרה
          </Link>
          <h1 className="cc-title text-lg font-bold text-[var(--cc-accent)]">CARMEN</h1>
          <span className="hidden text-xs tracking-[0.15em] text-[var(--cc-text-dim)] sm:inline">COMMAND CENTER · מרכז פיקוד</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="cc-chip text-xs">
            <span className="cc-live-dot inline-block h-2 w-2 rounded-full bg-[var(--cc-ok)]" />
            <span className="text-[var(--cc-text-dim)]">סטטוס מערכת</span>
            <span className="font-bold text-[var(--cc-ok)]">תקין</span>
          </span>
          <Clock />
        </div>
      </header>

      {/* Main grid */}
      <main className="cc-scroll grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-12 lg:grid-rows-[minmax(0,7fr)_minmax(0,5fr)] lg:overflow-hidden">
        {/* Center — face + core overview */}
        <div className="order-1 flex min-h-0 flex-col gap-3 lg:order-2 lg:col-span-6">
          <div className="cc-panel relative min-h-[220px] flex-1 overflow-hidden">
            <CarmenFace state={faceState} audioLevelRef={audioLevelRef} className="absolute inset-0 h-full w-full" />
            <span className="absolute right-3 top-2 text-[10px] tracking-[0.2em] text-[var(--cc-text-dim)]">
              CARMEN AI CORE · {faceState === "listening" ? "מקשיבה…" : faceState === "speaking" ? "מדברת…" : faceState === "alert" ? "התראה!" : "בהמתנה"}
            </span>
          </div>
          <CoreOverviewPanel tenantId={tenantId} />
        </div>

        {/* Right rail — tasks + timeline */}
        <div className="order-2 flex min-h-0 flex-col gap-3 lg:order-1 lg:col-span-3">
          <TasksPanel tenantId={tenantId} />
          <TimelinePanel tenantId={tenantId} />
        </div>

        {/* Left rail — intel feed + quick commands */}
        <div className="order-3 flex min-h-0 flex-col gap-3 lg:col-span-3">
          <IntelFeedPanel tenantId={tenantId} />
          <QuickCommandsPanel
            onCommand={(text) => chatRef.current?.prefill(text)}
            onVoice={() => chatRef.current?.startVoice()}
            onHealthCheck={healthCheck}
          />
        </div>

        {/* Bottom row — health + usage */}
        <div className="order-4 min-h-0 lg:col-span-6">
          <HealthPanel tenantId={tenantId} />
        </div>
        <div className="order-5 min-h-0 lg:col-span-6">
          <UsagePanel tenantId={tenantId} />
        </div>
      </main>

      {/* Talk-to-Carmen bar */}
      <footer className="shrink-0 p-3 pt-0">
        <CarmenChatBar ref={chatRef} tenantId={tenantId} onFaceState={setFaceState} audioLevelRef={audioLevelRef} />
      </footer>
    </div>
  );
}

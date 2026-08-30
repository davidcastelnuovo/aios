import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, Menu } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCommandCenterAccess } from "@/components/carmen-command/access";
import { CarmenFace, CarmenFaceState } from "@/components/carmen-command/CarmenFace";
import {
  CoreOverviewPanel, HealthPanel, IntelFeedPanel, QuickCommandsPanel,
  TasksPanel, TimelinePanel,
} from "@/components/carmen-command/panels";
import { UsagePanel } from "@/components/carmen-command/UsagePanel";
import { CarmenChatBar, CarmenChatBarHandle } from "@/components/carmen-command/CarmenChatBar";
import { useCommandRealtime } from "@/components/carmen-command/useCommandData";
import type { HudStage } from "@/lib/agentChannelRouting";
import "@/components/carmen-command/command-center.css";

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-left leading-tight">
      <p className="cc-num text-base font-bold sm:text-lg">{now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
      <p className="hidden text-[11px] text-[var(--cc-text-dim)] sm:block">{now.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</p>
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
  const access = useCommandCenterAccess();
  const qc = useQueryClient();
  const [faceState, setFaceState] = useState<CarmenFaceState>("idle");
  const audioLevelRef = useRef(0);
  const chatRef = useRef<CarmenChatBarHandle>(null);
  const alertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hudMode, setHudMode] = useState<HudStage>("table");

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

  // Allowlist gate — the Command Center is David-only until per-user API keys land
  if (access.loading) return <div className="cc-root h-dvh" />;
  if (!access.allowed) return <Navigate to={tenantSlug ? `/t/${tenantSlug}` : "/"} replace />;

  const rails: ReactNode = (
    <>
      <TasksPanel tenantId={tenantId} className="max-h-[300px] shrink-0" />
      <TimelinePanel tenantId={tenantId} className="max-h-[240px] shrink-0" />
      <CoreOverviewPanel tenantId={tenantId} className="shrink-0" />
      <IntelFeedPanel tenantId={tenantId} className="max-h-[300px] shrink-0" />
      <QuickCommandsPanel
        onCommand={(text) => { chatRef.current?.prefill(text); setMenuOpen(false); }}
        onVoice={() => { chatRef.current?.startVoice(); setMenuOpen(false); }}
        onHealthCheck={healthCheck}
        className="shrink-0"
      />
      <HealthPanel tenantId={tenantId} className="shrink-0" />
      <UsagePanel tenantId={tenantId} className="shrink-0" />
    </>
  );

  return (
    <div dir="rtl" className="cc-root flex h-dvh flex-col overflow-hidden font-heebo">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--cc-line)] px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
              type="button"
              onClick={() => setMenuOpen(true)}
              title="פרמטרים"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--cc-line)] text-[var(--cc-accent)] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          <Link
            to={tenantSlug ? `/t/${tenantSlug}` : "/"}
            title="חזרה לאפליקציה"
            className="flex items-center gap-1 rounded-md border border-[var(--cc-line)] px-2 py-1 text-xs text-[var(--cc-text-dim)] hover:border-[var(--cc-line-strong)] hover:text-[var(--cc-text)]"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">חזרה</span>
          </Link>
          <h1 className="cc-title text-base font-bold text-[var(--cc-accent)] sm:text-lg">CARMEN</h1>
        </div>
        <Clock />
      </header>

      <main className={`min-h-0 flex-1 grid-cols-12 gap-3 overflow-hidden p-3 ${hudMode === "direct" ? "hidden" : "hidden lg:grid"}`}>
        <div className="hidden min-h-0 flex-col gap-3 overflow-y-auto lg:order-1 lg:col-span-3 lg:flex">
          <TasksPanel tenantId={tenantId} className="max-h-[300px] shrink-0" />
          <TimelinePanel tenantId={tenantId} className="max-h-[240px] shrink-0" />
          <CoreOverviewPanel tenantId={tenantId} className="shrink-0" />
        </div>

        <div className="hidden min-h-0 lg:order-2 lg:col-span-6 lg:flex">
          <div className="cc-panel relative flex-1 overflow-hidden">
            <CarmenFace state={faceState} audioLevelRef={audioLevelRef} className="absolute inset-0 h-full w-full" />
            <span className="absolute right-3 top-2 text-[10px] tracking-[0.2em] text-[var(--cc-text-dim)]">
              {faceState === "listening" ? "מקשיבה…" : faceState === "speaking" ? "מדברת…" : faceState === "alert" ? "התראה" : "בהמתנה"}
            </span>
          </div>
        </div>

        <div className="hidden min-h-0 flex-col gap-3 overflow-y-auto lg:col-span-3 lg:flex">
          <IntelFeedPanel tenantId={tenantId} className="max-h-[300px] shrink-0" />
          <QuickCommandsPanel
            onCommand={(text) => chatRef.current?.prefill(text)}
            onVoice={() => chatRef.current?.startVoice()}
            onHealthCheck={healthCheck}
            className="shrink-0"
          />
          <HealthPanel tenantId={tenantId} className="shrink-0" />
          <UsagePanel tenantId={tenantId} className="shrink-0" />
        </div>
      </main>

      <footer className={`flex min-h-0 flex-1 flex-col overflow-hidden p-2 pt-0 sm:p-3 sm:pt-0 ${hudMode === "direct" ? "" : "lg:flex-none lg:max-h-[48dvh]"}`}>
        <CarmenChatBar
          ref={chatRef}
          tenantId={tenantId}
          onFaceState={setFaceState}
          audioLevelRef={audioLevelRef}
          menuOpen={menuOpen}
          onMenuOpenChange={setMenuOpen}
          menuPanels={rails}
          onHudModeChange={setHudMode}
        />
      </footer>
    </div>
  );
}

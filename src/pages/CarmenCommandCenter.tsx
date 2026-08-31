import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, History, LayoutDashboard, PanelRightOpen, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCommandCenterAccess } from "@/components/carmen-command/access";
import type { CarmenFaceState } from "@/components/carmen-command/CarmenFace";
import { CarmenDashboardView } from "@/components/carmen-command/CarmenDashboardView";
import { HudMenu } from "@/components/carmen-command/HudMenu";
import { AgentSeatRail, AgentSeatStatus } from "@/components/carmen-command/AgentSeatRail";
import { CarmenChatBar, CarmenChatBarHandle } from "@/components/carmen-command/CarmenChatBar";
import { useCommandRealtime } from "@/components/carmen-command/useCommandData";
import { useBrainChannel } from "@/components/carmen-command/useBrainChannel";
import { CommandCenterSidecarShell } from "@/components/carmen-command/CommandCenterSidecarShell";
import { useCommandCenterSidecar } from "@/contexts/CommandCenterSidecarContext";
import { useToast } from "@/hooks/use-toast";
import type { HudStage } from "@/lib/agentChannelRouting";
import "@/components/carmen-command/command-center.css";

export type CommandCenterViewMode = "agents" | "dashboard";

const VIEW_MODE_KEY = "aios:cc-view-mode";

function readViewMode(): CommandCenterViewMode {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    return v === "dashboard" ? "dashboard" : "agents";
  } catch {
    return "agents";
  }
}

function Clock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className={`cc-header-clock text-left leading-tight${compact ? " cc-header-clock--compact" : ""}`}>
      <p className="cc-num text-sm font-bold sm:text-base">
        {now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </p>
      {!compact && (
        <p className="hidden text-[10px] text-[var(--cc-text-dim)] sm:block">
          {now.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      )}
    </div>
  );
}

/**
 * Carmen Command Center — two modes:
 * - dashboard: Carmen only, all HUD panels open, face in center
 * - agents: multi-agent seat rail + full-height chat
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
  const [, setHudMode] = useState<HudStage>("direct");
  const [chatsOpen, setChatsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<CommandCenterViewMode>(readViewMode);
  const brain = useBrainChannel(tenantId);
  const sidecar = useCommandCenterSidecar();
  const { toast } = useToast();

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

  const switchViewMode = useCallback((mode: CommandCenterViewMode) => {
    setViewMode(mode);
    try { localStorage.setItem(VIEW_MODE_KEY, mode); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (viewMode !== "dashboard") return;
    const internal = brain.routes.find((r) => r.slug === "internal");
    if (internal && brain.selected.slug !== "internal") {
      brain.selectRoute(internal, conversationId);
    }
  }, [viewMode, brain.routes, brain.selected.slug, brain, conversationId]);

  const onCancelParliament = conversationId
    ? () => brain.cancelParliament(conversationId)
    : undefined;
  const onContinueParliament = conversationId
    ? () => brain.parliamentAction("parliament_continue", conversationId).catch((e) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }))
    : undefined;
  const onSynthesizeParliament = conversationId
    ? () => brain.parliamentAction("parliament_synthesize", conversationId).catch((e) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }))
    : undefined;

  if (access.loading) return <div className="cc-root h-full" />;
  if (!access.allowed) return <Navigate to={tenantSlug ? `/t/${tenantSlug}` : "/"} replace />;

  const isDashboard = viewMode === "dashboard";

  return (
    <div dir="rtl" className={`cc-root relative flex flex-col overflow-hidden font-heebo${isDashboard ? " is-dashboard" : ""}`}>
      <header className="cc-header-bar shrink-0">
        <div className="cc-header-bar__brand flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Link
            to={tenantSlug ? `/t/${tenantSlug}` : "/"}
            title="חזרה לאפליקציה"
            className="cc-header-btn flex items-center gap-1 rounded-md border border-[var(--cc-line)] px-2 text-xs text-[var(--cc-text-dim)] hover:border-[var(--cc-line-strong)] hover:text-[var(--cc-text)]"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">חזרה</span>
          </Link>
          <h1 className="cc-title hidden text-sm font-bold text-[var(--cc-accent)] sm:block sm:text-base">CARMEN</h1>
          {isDashboard && (
            <span className="hidden text-[10px] tracking-[0.12em] text-[var(--cc-text-dim)] md:inline">
              מרכז פיקוד · כרמן בלבד
            </span>
          )}
        </div>

        {!isDashboard && (
          <AgentSeatRail
            embedded
            routes={brain.routes}
            selected={brain.selected}
            status={brain.status}
            externalUrl={brain.externalUrl}
            debating={brain.status === "debating"}
            onSelect={(route) => brain.selectRoute(route, conversationId)}
          />
        )}

        <div className="cc-header-bar__tools flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            title={isDashboard ? "מצב סוכנים — Cursor, Grok, מועצה" : "מרכז בקרה — כרמן בלבד, כל הלוחות פתוחים"}
            onClick={() => switchViewMode(isDashboard ? "agents" : "dashboard")}
            className={`cc-header-btn flex items-center gap-1 rounded-md border px-2 text-xs ${
              isDashboard
                ? "border-[var(--cc-accent)] text-[var(--cc-accent)]"
                : "border-[var(--cc-line)] text-[var(--cc-text-dim)] hover:border-[var(--cc-line-strong)]"
            }`}
          >
            {isDashboard ? <Users className="h-4 w-4" /> : <LayoutDashboard className="h-4 w-4" />}
            <span className="hidden sm:inline">{isDashboard ? "סוכנים" : "מרכז בקרה"}</span>
          </button>

          <button
            type="button"
            title={sidecar.open ? "סגור סיידבר תיקון" : "סיידבר תיקון — כרמן + הקשר מסך"}
            onClick={sidecar.toggle}
            className={`cc-header-btn flex items-center gap-1 rounded-md border px-2 text-xs ${
              sidecar.open
                ? "border-[var(--cc-accent)] text-[var(--cc-accent)]"
                : "border-[var(--cc-line)] text-[var(--cc-text-dim)] hover:border-[var(--cc-line-strong)]"
            }`}
          >
            <PanelRightOpen className="h-4 w-4" />
            <span className="hidden sm:inline">תיקון</span>
          </button>

          {!isDashboard && (
            <>
              <HudMenu
                tenantId={tenantId}
                faceState={faceState}
                audioLevelRef={audioLevelRef}
                onPrefill={(text) => chatRef.current?.prefill(text)}
                onVoice={() => chatRef.current?.startVoice()}
                onHealthCheck={healthCheck}
              />
              <button
                type="button"
                onClick={() => setChatsOpen((v) => !v)}
                title="צ׳אטים"
                className={`cc-header-btn flex items-center gap-1 rounded-md border px-2 text-xs ${chatsOpen ? "border-[var(--cc-line-strong)] text-[var(--cc-accent)]" : "border-[var(--cc-line)] text-[var(--cc-text-dim)]"}`}
              >
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">צ׳אטים</span>
              </button>
            </>
          )}

          <Clock compact />
        </div>
      </header>

      {!isDashboard && (
        <AgentSeatStatus
          selected={brain.selected}
          status={brain.status}
          externalUrl={brain.externalUrl}
          debating={brain.status === "debating"}
          onCancel={onCancelParliament}
          onContinue={onContinueParliament}
          onSynthesize={onSynthesizeParliament}
        />
      )}

      {isDashboard ? (
        <CommandCenterSidecarShell embedded open={sidecar.open} onOpenChange={sidecar.setOpen}>
          <CarmenDashboardView
            tenantId={tenantId}
            faceState={faceState}
            audioLevelRef={audioLevelRef}
            chatRef={chatRef}
            onHealthCheck={healthCheck}
          />
        </CommandCenterSidecarShell>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
          <CarmenChatBar
            ref={chatRef}
            tenantId={tenantId}
            brain={brain}
            onConversationIdChange={setConversationId}
            onFaceState={setFaceState}
            audioLevelRef={audioLevelRef}
            historyOpen={chatsOpen}
            onHistoryOpenChange={setChatsOpen}
            onHudModeChange={setHudMode}
          />
        </div>
      )}

      {isDashboard && !sidecar.open && (
        <footer className="cc-dashboard-footer shrink-0 p-2 pt-0 sm:p-3 sm:pt-0">
          <CarmenChatBar
            ref={chatRef}
            tenantId={tenantId}
            brain={brain}
            onConversationIdChange={setConversationId}
            onFaceState={setFaceState}
            audioLevelRef={audioLevelRef}
            onHudModeChange={setHudMode}
          />
        </footer>
      )}
    </div>
  );
}

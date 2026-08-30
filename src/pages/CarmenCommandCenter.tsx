import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, History } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCommandCenterAccess } from "@/components/carmen-command/access";
import type { CarmenFaceState } from "@/components/carmen-command/CarmenFace";
import { HudMenu } from "@/components/carmen-command/HudMenu";
import { AgentSeatRail, AgentSeatStatus } from "@/components/carmen-command/AgentSeatRail";
import { CarmenChatBar, CarmenChatBarHandle } from "@/components/carmen-command/CarmenChatBar";
import { useCommandRealtime } from "@/components/carmen-command/useCommandData";
import { useBrainChannel } from "@/components/carmen-command/useBrainChannel";
import { useToast } from "@/hooks/use-toast";
import type { HudStage } from "@/lib/agentChannelRouting";
import "@/components/carmen-command/command-center.css";

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
 * Carmen Command Center — chat-first: single-row HUD + full-height thread.
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
  const brain = useBrainChannel(tenantId);
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

  return (
    <div dir="rtl" className="cc-root relative flex flex-col overflow-hidden font-heebo">
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
        </div>

        <AgentSeatRail
          embedded
          routes={brain.routes}
          selected={brain.selected}
          status={brain.status}
          externalUrl={brain.externalUrl}
          debating={brain.status === "debating"}
          onSelect={(route) => brain.selectRoute(route, conversationId)}
        />

        <div className="cc-header-bar__tools flex shrink-0 items-center gap-1.5 sm:gap-2">
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
          <Clock compact />
        </div>
      </header>

      <AgentSeatStatus
        selected={brain.selected}
        status={brain.status}
        externalUrl={brain.externalUrl}
        debating={brain.status === "debating"}
        onCancel={onCancelParliament}
        onContinue={onContinueParliament}
        onSynthesize={onSynthesizeParliament}
      />

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
    </div>
  );
}

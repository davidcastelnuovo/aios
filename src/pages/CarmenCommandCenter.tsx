import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, History } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCommandCenterAccess } from "@/components/carmen-command/access";
import type { CarmenFaceState } from "@/components/carmen-command/CarmenFace";
import { HudMenu } from "@/components/carmen-command/HudMenu";
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
 * Carmen Command Center — one stage at a time.
 * Knights table = only the table. Direct chat = only that seat.
 * HUD widgets open from the לוח dropdown, not as always-on columns.
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

  if (access.loading) return <div className="cc-root h-full" />;
  if (!access.allowed) return <Navigate to={tenantSlug ? `/t/${tenantSlug}` : "/"} replace />;

  return (
    <div dir="rtl" className="cc-root relative flex flex-col overflow-hidden font-heebo">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--cc-line)] px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to={tenantSlug ? `/t/${tenantSlug}` : "/"}
            title="חזרה לאפליקציה"
            className="flex items-center gap-1 rounded-md border border-[var(--cc-line)] px-2 py-1 text-xs text-[var(--cc-text-dim)] hover:border-[var(--cc-line-strong)] hover:text-[var(--cc-text)]"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">חזרה</span>
          </Link>
          <h1 className="cc-title text-base font-bold text-[var(--cc-accent)] sm:text-lg">CARMEN</h1>
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
            className={`flex h-10 items-center gap-1 rounded-md border px-2 text-xs ${chatsOpen ? "border-[var(--cc-line-strong)] text-[var(--cc-accent)]" : "border-[var(--cc-line)] text-[var(--cc-text-dim)]"}`}
          >
            <History className="h-4 w-4" />
            צ׳אטים
          </button>
        </div>
        <Clock />
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
        <CarmenChatBar
          ref={chatRef}
          tenantId={tenantId}
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

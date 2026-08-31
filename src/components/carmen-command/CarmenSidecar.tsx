import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Loader2, PanelRightClose, Send, Wrench } from "lucide-react";
import { CarmenComposerMicButton } from "@/components/carmen-shared/CarmenComposerMicButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ChatMessageRow } from "./ChatMessageRow";
import { ThinkingGalaxy } from "./ThinkingGalaxy";
import {
  collectCarmenUiContext,
  formatUiContextForPrompt,
  type CarmenUiContext,
} from "@/lib/carmenPageContext";
import { canDispatchDevTask, getDevEscalationTier } from "@/lib/devEscalationAccess";
import type { CommandCenterViewMode } from "@/pages/CarmenCommandCenter";

type SidecarMessage = {
  role: "user" | "assistant";
  content: string;
  dev_dispatch?: boolean;
};

interface CarmenSidecarProps {
  tenantId: string | null;
  commandCenterView: CommandCenterViewMode;
  onClose: () => void;
  onMinimize?: () => void;
}

export function CarmenSidecar({ tenantId, commandCenterView, onClose }: CarmenSidecarProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const location = useLocation();
  const { userId, user } = useCurrentUser();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<SidecarMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const devTier = getDevEscalationTier({
    userId: userId ?? null,
    phone: user?.phone ?? null,
  });
  const mayDispatchDev = canDispatchDevTask(devTier);

  const buildUiContext = useCallback((): CarmenUiContext => {
    return collectCarmenUiContext({
      pathname: location.pathname,
      search: location.search,
      params: { tenantSlug, ...Object.fromEntries(new URLSearchParams(location.search)) },
      commandCenterView,
    });
  }, [commandCenterView, location.pathname, location.search, tenantSlug]);

  const scrollDown = () => {
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
  };

  const sendMessage = useCallback(async (rawText: string, opts?: { devDispatch?: boolean }) => {
    const trimmed = rawText.trim();
    if (!trimmed || !tenantId || isStreaming) return;

    const uiContext = buildUiContext();
    const contextBlock = formatUiContextForPrompt(uiContext);
    const devDispatch = !!opts?.devDispatch;

    if (devDispatch && !mayDispatchDev) {
      toast({
        title: "אין הרשאה",
        description: "רק משתמשים מורשים יכולים לשלוח תיקוני פיתוח ל-Cursor.",
        variant: "destructive",
      });
      return;
    }

    const userVisible = devDispatch ? `🛠️ ${trimmed}` : trimmed;
    setMessages((prev) => [...prev, { role: "user", content: userVisible, dev_dispatch: devDispatch }]);
    setInput("");
    setIsStreaming(true);
    setStreamingText("");
    scrollDown();

    const commandText = devDispatch
      ? [
          "[Carmen → Cursor · DEV TASK]",
          `Requested by user via Command Center sidecar (${devTier === "bugfix" ? "bugfix tier" : "full tier"}).`,
          "",
          "Task:",
          trimmed,
          "",
          "UI context (current screen):",
          contextBlock,
          "",
          devTier === "bugfix"
            ? "Use mcp_Cursor__request_dev_task only — BUG FIX with repro steps."
            : "Use mcp_Cursor__request_dev_task for code/system fixes on develop branch.",
        ].join("\n")
      : [
          trimmed,
          "",
          "--- UI context (Command Center sidecar) ---",
          contextBlock,
        ].join("\n");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("לא מחוברת");

      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-ai-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          command_text: commandText,
          tenant_id: tenantId,
          surface: "command_center_sidecar",
          stream: true,
          ui_context: uiContext,
          conversation_history: history,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || "שגיאה בתקשורת עם כרמן");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === "token") {
              answer += parsed.content;
              setStreamingText(answer);
              scrollDown();
            }
          } catch { /* partial */ }
        }
      }

      const finalText = answer.trim() || "לא התקבלה תשובה.";
      setMessages((prev) => [...prev, { role: "assistant", content: finalText }]);
      setStreamingText("");
      console.info("[carmen:sidecar]", {
        step: "response",
        dev_dispatch: devDispatch,
        path: uiContext.pathname,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "שגיאה";
      toast({ title: "שגיאה", description: msg, variant: "destructive" });
    } finally {
      setIsStreaming(false);
      scrollDown();
    }
  }, [buildUiContext, devTier, isStreaming, mayDispatchDev, messages, tenantId, toast]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <aside
      className="cc-sidecar flex h-full min-h-0 w-[min(100%,400px)] shrink-0 flex-col border-s border-[var(--cc-line)] bg-[var(--cc-bg-2)]"
      dir="rtl"
      aria-label="סיידבר כרמן"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--cc-line)] px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-[var(--cc-accent)]">סיידבר כרמן</h2>
          <p className="truncate text-[10px] text-[var(--cc-text-dim)]">הקשר מסך · תשובות טקסט</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="cc-header-btn flex h-8 w-8 items-center justify-center rounded-md border border-[var(--cc-line)] text-[var(--cc-text-dim)] hover:text-[var(--cc-text)]"
          title="סגור סיידבר"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </header>

      <div ref={listRef} className="cc-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && !streamingText && (
          <p className="py-6 text-center text-xs text-[var(--cc-text-dim)]">
            שאלי על מה שרואים במסך — או שלחי תיקון לפיתוח (מורשים בלבד).
          </p>
        )}
        {messages.map((m, i) => (
          <ChatMessageRow key={i} role={m.role} content={m.content} speaker={m.role === "user" ? "user" : "carmen"} />
        ))}
        {streamingText && (
          <div className="cc-msg-row is-agent">
            <div className="cc-msg-bubble">
              <div className="cc-md text-sm">{streamingText}</div>
            </div>
          </div>
        )}
        {isStreaming && !streamingText && (
          <div className="flex justify-center py-2">
            <ThinkingGalaxy size="sm" />
          </div>
        )}
      </div>

      <footer className="shrink-0 space-y-2 border-t border-[var(--cc-line)] p-3">
        {mayDispatchDev && (
          <button
            type="button"
            disabled={!input.trim() || isStreaming}
            onClick={() => sendMessage(input, { devDispatch: true })}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--cc-warn)] bg-[rgba(251,191,36,0.08)] px-3 py-2 text-xs font-medium text-[var(--cc-warn)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Wrench className="h-3.5 w-3.5" />
            שלחי תיקון לפיתוח
          </button>
        )}
        <div className="flex gap-2">
          <CarmenComposerMicButton
            value={input}
            onChange={setInput}
            onFocus={() => inputRef.current?.focus()}
            disabled={isStreaming}
            title="הקלטה לתיבת ההודעה"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--cc-line)] text-[var(--cc-accent)] hover:border-[var(--cc-line-strong)] disabled:opacity-40"
          />
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            rows={2}
            placeholder="הודעה עם הקשר המסך…"
            disabled={isStreaming}
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-[var(--cc-line)] bg-[rgba(5,10,22,0.6)] px-3 py-2 text-sm outline-none placeholder:text-[var(--cc-text-dim)] focus:border-[var(--cc-line-strong)]"
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--cc-accent-dim)] text-white disabled:opacity-40"
            title="שליחה"
          >
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </footer>
    </aside>
  );
}

export const SIDECAR_STORAGE_KEY = "aios:cc-sidecar-open";

export function readSidecarOpen(): boolean {
  try {
    return localStorage.getItem(SIDECAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSidecarOpen(open: boolean): void {
  try {
    localStorage.setItem(SIDECAR_STORAGE_KEY, open ? "1" : "0");
  } catch { /* ignore */ }
}

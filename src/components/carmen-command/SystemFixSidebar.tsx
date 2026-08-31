import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Loader2, PanelRightClose, Send, Wrench, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { useAgency } from "@/contexts/AgencyContext";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import {
  buildSystemFixPromptAddon,
  collectSystemFixContext,
  formatSystemFixContextLabel,
  type SystemFixContextPayload,
} from "@/lib/systemFixContext";
import { useSystemFixSidebar } from "@/contexts/SystemFixSidebarContext";
import { ChatMessageRow } from "./ChatMessageRow";
import { ThinkingGalaxy } from "./ThinkingGalaxy";
import "@/components/carmen-command/command-center.css";
import "./system-fix-sidebar.css";

interface SidecarMessage {
  role: "user" | "assistant" | "tool_call";
  content?: string;
  tool?: string;
}

interface SystemFixSidebarProps {
  /** Desktop: inline push panel. Mobile: full overlay drawer. */
  variant?: "inline" | "overlay";
}

export function SystemFixSidebar({ variant = "inline" }: SystemFixSidebarProps) {
  const { open, setOpen } = useSystemFixSidebar();
  const location = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenantId } = useCurrentTenant();
  const { selectedAgency } = useAgency();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<SidecarMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const viewportMode = isMobile ? "mobile" : "desktop";
  const pageContext = useMemo(
    () => collectSystemFixContext({
      location,
      tenantSlug: tenantSlug ?? null,
      selectedAgencyId: selectedAgency ?? null,
      viewportMode,
    }),
    [location, tenantSlug, selectedAgency, viewportMode],
  );

  const contextLabel = useMemo(() => formatSystemFixContextLabel(pageContext), [pageContext]);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
  }, []);

  useEffect(() => {
    if (open) scrollDown();
  }, [open, messages.length, streamingText, scrollDown]);

  const streamReply = useCallback(async (
    trimmed: string,
    history: Array<{ role: string; content: string }>,
    ctx: SystemFixContextPayload,
  ) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("לא מחובר");

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-ai-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        command_text: trimmed,
        tenant_id: tenantId,
        surface: "internal_chat",
        stream: true,
        conversation_id: conversationIdRef.current,
        conversation_history: history,
        system_prompt_addon: buildSystemFixPromptAddon(ctx),
        context_metadata: ctx,
      }),
    });

    if (!res.ok) {
      throw new Error(res.status === 429 ? "חריגה ממגבלת הקצב — נסה שוב" : "שגיאה בתקשורת עם כרמן");
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
          } else if (parsed.type === "tool_call") {
            setMessages((prev) => [...prev, { role: "tool_call", tool: parsed.tool }]);
            scrollDown();
          } else if (parsed.type === "conversation_id" && parsed.id) {
            conversationIdRef.current = parsed.id;
          }
        } catch {
          /* partial line */
        }
      }
    }

    const finalText = answer.trim() || "⚠️ לא התקבלה תשובה — נסה שוב.";
    setMessages((prev) => [...prev, { role: "assistant", content: finalText }]);
    setStreamingText("");
    scrollDown();
  }, [tenantId, scrollDown]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || !tenantId || isStreaming) return;

    const ctx = collectSystemFixContext({
      location,
      tenantSlug: tenantSlug ?? null,
      selectedAgencyId: selectedAgency ?? null,
      viewportMode: isMobile ? "mobile" : "desktop",
    });

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsStreaming(true);
    setStreamingText("");
    scrollDown();

    try {
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content ?? "" }));
      await streamReply(trimmed, history, ctx);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "שגיאה בשליחה";
      toast({ title: "שגיאה", description: message, variant: "destructive" });
    } finally {
      setIsStreaming(false);
    }
  }, [
    input,
    tenantId,
    isStreaming,
    location,
    tenantSlug,
    selectedAgency,
    isMobile,
    messages,
    streamReply,
    scrollDown,
    toast,
  ]);

  if (!open) return null;

  const panelBody = (
    <>
      <header className="sf-sidecar__header">
        <div className="flex min-w-0 items-center gap-2">
          <Wrench className="h-4 w-4 shrink-0 text-[#4cc3ff]" />
          <div className="min-w-0">
            <p className="sf-sidecar__title">תיקון מערכת · כרמן</p>
            <p className="truncate text-[10px] text-[#8fa3c4]">Sidecar — המסך נשאר גלוי</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-[rgba(76,195,255,0.2)] p-1.5 text-[#8fa3c4] hover:text-[#e3ecfa]"
          title="סגור"
          aria-label="סגור פאנל תיקון מערכת"
        >
          {variant === "overlay" ? <X className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
        </button>
      </header>

      <p className="sf-sidecar__context" title={pageContext.href}>
        <span className="text-[#4cc3ff]">הקשר: </span>
        {contextLabel}
      </p>

      <div ref={listRef} className="sf-sidecar__scroll cc-scroll">
        {messages.length === 0 && !streamingText && (
          <p className="sf-sidecar-empty">
            תאר/י מה לתקן במסך שאת/ה רואה. לדוגמה: &quot;הטבלה לא מציגה הכנסות&quot; או &quot;שלחי לקרסר&quot;.
          </p>
        )}
        {messages.map((m, i) => (
          <ChatMessageRow
            key={i}
            role={m.role}
            content={m.content}
            speaker={m.role === "assistant" ? "carmen" : "user"}
            channel="internal"
            tool={m.tool}
          />
        ))}
        {streamingText && (
          <div className="cc-msg-row is-agent">
            <div className="cc-msg-bubble">
              <div className="cc-md prose prose-invert prose-sm max-w-none [&_p]:my-1">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
        {isStreaming && !streamingText && (
          <div className="flex justify-center py-3">
            <ThinkingGalaxy size="sm" />
          </div>
        )}
      </div>

      <div className="sf-sidecar__composer">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage();
            }
          }}
          rows={2}
          placeholder="תיקון / שינוי / באג במסך הנוכחי…"
          className="sf-sidecar__input"
          disabled={isStreaming}
        />
        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={!input.trim() || isStreaming}
          className="sf-sidecar__send"
          title="שליחה לכרמן"
        >
          {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </>
  );

  if (variant === "overlay") {
    return (
      <div className="sf-sidecar sf-sidecar--overlay" role="dialog" aria-label="תיקון מערכת">
        <button
          type="button"
          className="absolute inset-0 cursor-default"
          aria-label="סגור"
          onClick={() => setOpen(false)}
        />
        <div className="sf-sidecar__panel">{panelBody}</div>
      </div>
    );
  }

  return (
    <aside className="sf-sidecar sf-sidecar--desktop" aria-label="תיקון מערכת">
      {panelBody}
    </aside>
  );
}

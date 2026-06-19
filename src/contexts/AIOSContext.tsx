import { createContext, useContext, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useQueryClient } from "@tanstack/react-query";
import type { DisplayData } from "@/components/aios/AIOSChatBar";
import { invalidateAIEntityQueries } from "@/lib/aiInvalidation";

interface AIOSState {
  isLoading: boolean;
  statusText: string;
  dataPanels: DisplayData[];
  history: { role: string; content: string }[];
  send: (text: string) => void;
  removePanel: (index: number) => void;
  resetConversation: () => void;
}

const AIOSContext = createContext<AIOSState | null>(null);

export function AIOSProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useCurrentUser();
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [dataPanels, setDataPanels] = useState<DisplayData[]>([]);
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(() => {
    try { return localStorage.getItem("aios_conversation_id"); } catch { return null; }
  });
  const activeRef = useRef(false);

  const send = useCallback(async (text: string) => {
    if (!userId || !tenantId || activeRef.current) return;

    const updatedHistory = [...history, { role: "user", content: text }];
    setHistory(updatedHistory);
    activeRef.current = true;
    setIsLoading(true);
    setStatusText("");
    setDataPanels([]);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) return;

      // Build conversation_history from prior messages (excluding the just-pushed user turn).
      const conversationHistory = history.map((h) => ({
        role: h.role === "assistant" ? "assistant" : "user",
        content: h.content,
      }));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-ai-agent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            command_text: text,
            tenant_id: tenantId,
            user_id: userId,
            surface: "aios",
            stream: true,
            conversation_history: conversationHistory,
          }),
        }
      );


      if (!response.ok) throw new Error("Failed to get AI response");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let fullContent = "";
      let textBuffer = "";

      let receivedDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);

            if (parsed.type === "display_data" && parsed.data) {
              setDataPanels((prev) => [...prev, parsed.data as DisplayData]);
              continue;
            }

            if (parsed.type === "conversation_id" && parsed.id) {
              setConversationId(parsed.id);
              try { localStorage.setItem("aios_conversation_id", parsed.id); } catch {}
              continue;
            }

            if (parsed.type === "invalidate" && parsed.entity) {
              invalidateAIEntityQueries(queryClient, parsed.entity);
              continue;
            }

            if (parsed.type === "done") {
              receivedDone = true;
            }

            if (parsed.type === "token" && parsed.content) {
              fullContent += parsed.content;
              setStatusText(fullContent);
            }
          } catch {
            // skip
          }
        }
      }

      if (fullContent) {
        setHistory((prev) => [...prev, { role: "assistant", content: fullContent }]);
      }

      if (!receivedDone && !fullContent) {
        setStatusText("⚠️ הפעולה הופסקה — ייתכן שהמשימה ארוכה מדי.");
        setHistory((prev) => [...prev, { role: "assistant", content: "⚠️ הפעולה הופסקה — ייתכן שהמשימה ארוכה מדי. נסה לפרק אותה לחלקים קטנים יותר." }]);
      } else if (!receivedDone && fullContent) {
        setStatusText(fullContent + "\n\n⚠️ החיבור נותק — ייתכן שהפעולה הופסקה באמצע.");
      }
    } catch (error) {
      console.error("AIOS error:", error);
      setStatusText("מצטער, אירעה שגיאה. נסה שוב.");
    } finally {
      activeRef.current = false;
      setIsLoading(false);
    }
  }, [userId, tenantId, history, conversationId, queryClient]);

  const removePanel = useCallback((index: number) => {
    setDataPanels((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const resetConversation = useCallback(() => {
    setConversationId(null);
    setHistory([]);
    setStatusText("");
    setDataPanels([]);
    try { localStorage.removeItem("aios_conversation_id"); } catch {}
  }, []);

  return (
    <AIOSContext.Provider value={{ isLoading, statusText, dataPanels, history, send, removePanel, resetConversation }}>
      {children}
    </AIOSContext.Provider>
  );
}

export function useAIOS() {
  const ctx = useContext(AIOSContext);
  if (!ctx) throw new Error("useAIOS must be used within AIOSProvider");
  return ctx;
}

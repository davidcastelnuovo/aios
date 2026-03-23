import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { AIOSCommandBar } from "@/components/aios/AIOSCommandBar";
import { DataCanvas } from "@/components/aios/DataCanvas";
import type { DisplayData } from "@/components/aios/AIOSChatBar";
import { useQueryClient } from "@tanstack/react-query";

export default function AIOSDashboard() {
  const { userId } = useCurrentUser();
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [dataPanels, setDataPanels] = useState<DisplayData[]>([]);
  // Keep conversation history for context but don't show it
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);

  const handleSend = useCallback(async (text: string) => {
    if (!userId || !tenantId) return;

    const updatedHistory = [...history, { role: "user", content: text }];
    setHistory(updatedHistory);
    setIsLoading(true);
    setStatusText("");
    // Clear previous panels for new request
    setDataPanels([]);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-support-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            message: text,
            tenant_id: tenantId,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to get AI response");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let fullContent = "";
      let textBuffer = "";

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

            if (parsed.type === "invalidate" && parsed.entity) {
              queryClient.invalidateQueries({ queryKey: [parsed.entity] });
              continue;
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
    } catch (error) {
      console.error("AIOS error:", error);
      setStatusText("מצטער, אירעה שגיאה. נסה שוב.");
    } finally {
      setIsLoading(false);
    }
  }, [userId, tenantId, history, queryClient]);

  const handleRemovePanel = (index: number) => {
    setDataPanels((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Command bar at top */}
      <AIOSCommandBar
        onSend={handleSend}
        isLoading={isLoading}
        statusText={statusText}
      />

      {/* Data output - full area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <DataCanvas panels={dataPanels} onRemovePanel={handleRemovePanel} />
      </div>
    </div>
  );
}

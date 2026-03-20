import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { AIOSChatBar, type AIOSMessage, type DisplayData } from "@/components/aios/AIOSChatBar";
import { DataCanvas } from "@/components/aios/DataCanvas";
import { useQueryClient } from "@tanstack/react-query";

export default function AIOSDashboard() {
  const { userId } = useCurrentUser();
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<AIOSMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [dataPanels, setDataPanels] = useState<DisplayData[]>([]);

  const handleSend = useCallback(async (text: string) => {
    if (!userId || !tenantId) return;

    const userMessage: AIOSMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);
    setStreamingContent("");

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

            // Handle display_data events
            if (parsed.type === "display_data" && parsed.data) {
              setDataPanels((prev) => [...prev, parsed.data as DisplayData]);
              continue;
            }

            // Handle invalidate events
            if (parsed.type === "invalidate" && parsed.entity) {
              queryClient.invalidateQueries({ queryKey: [parsed.entity] });
              continue;
            }

            // Handle token content
            if (parsed.type === "token" && parsed.content) {
              fullContent += parsed.content;
              setStreamingContent(fullContent);
            }
          } catch {
            // skip unparseable lines
          }
        }
      }

      if (fullContent) {
        setMessages((prev) => [...prev, { role: "assistant", content: fullContent }]);
      }
    } catch (error) {
      console.error("AIOS chat error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "מצטער, אירעה שגיאה. נסה שוב." },
      ]);
    } finally {
      setIsLoading(false);
      setStreamingContent("");
    }
  }, [userId, tenantId, messages, queryClient]);

  const handleRemovePanel = (index: number) => {
    setDataPanels((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Split layout: Chat on right, Data on left */}
      <div className="flex flex-1 min-h-0">
        {/* Data Canvas - takes most space */}
        <div className="flex-1 min-w-0 border-l border-border">
          <DataCanvas panels={dataPanels} onRemovePanel={handleRemovePanel} />
        </div>

        {/* Chat Panel - fixed width on side */}
        <div className="w-[400px] flex-shrink-0 flex flex-col bg-background border-border">
          <AIOSChatBar
            messages={messages}
            onSend={handleSend}
            isLoading={isLoading}
            streamingContent={streamingContent}
          />
        </div>
      </div>
    </div>
  );
}

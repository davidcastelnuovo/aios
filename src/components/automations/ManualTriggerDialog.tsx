import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User } from "lucide-react";

interface ManualTriggerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automationId: string;
  automationName: string;
}

interface ChatMessage {
  role: "user" | "agent";
  content: string;
  timestamp: Date;
}

export function ManualTriggerDialog({
  open,
  onOpenChange,
  automationId,
  automationName,
}: ManualTriggerDialogProps) {
  const [commandText, setCommandText] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { toast } = useToast();
  const { tenantId } = useCurrentTenant();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch flow steps to find agent step
  const { data: flowSteps } = useQuery({
    queryKey: ["automation-flow-steps-agent", automationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_flow_steps" as any)
        .select("*")
        .eq("automation_id", automationId);
      if (error) throw error;
      return data as any[];
    },
    enabled: open && !!automationId,
  });

  // Find agent step and its agent_id
  const agentStep = flowSteps?.find((s: any) => s.step_type === "agent" || s.action_type === "agent");
  const agentId = agentStep?.configuration?.agent_id;

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Reset messages when dialog opens
  useEffect(() => {
    if (open) {
      setMessages([]);
      setCommandText("");
    }
  }, [open]);

  const handleRun = async () => {
    if (!commandText.trim()) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: commandText.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    const currentCommand = commandText.trim();
    setCommandText("");
    setIsRunning(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userName = user?.email || "משתמש";

      // Always call trigger-automation which handles full flow execution
      const { data, error } = await supabase.functions.invoke("trigger-automation", {
        body: {
          automationId,
          command_text: currentCommand,
          user_name: userName,
        },
      });

      if (error) throw error;

      // Extract agent output from flow results
      const result = data?.results?.[0];
      const flowResponse = result?.response || result;
      
      if (flowResponse?.flow && flowResponse?.agent_output) {
        // Flow with agent - show agent output
        const stepsInfo = flowResponse.steps
          ?.filter((s: any) => s.action_type !== 'agent')
          ?.map((s: any) => s.success ? `✅ ${s.action_type}` : `❌ ${s.action_type}: ${s.error}`)
          ?.join('\n') || '';
        
        const agentContent = flowResponse.agent_output;
        const fullContent = stepsInfo 
          ? `${agentContent}\n\n---\n${stepsInfo}` 
          : agentContent;

        setMessages((prev) => [
          ...prev,
          {
            role: "agent",
            content: fullContent,
            timestamp: new Date(),
          },
        ]);
      } else if (flowResponse?.flow) {
        // Flow without agent
        const stepsInfo = flowResponse.steps
          ?.map((s: any) => s.success ? `✅ ${s.action_type}` : `❌ ${s.action_type}: ${s.error}`)
          ?.join('\n') || 'הפלוו הופעל בהצלחה';
        
        setMessages((prev) => [
          ...prev,
          {
            role: "agent",
            content: stepsInfo,
            timestamp: new Date(),
          },
        ]);
      } else {
        // Non-flow automation
        setMessages((prev) => [
          ...prev,
          {
            role: "agent",
            content: flowResponse?.output || "האוטומציה הופעלה בהצלחה.",
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err: any) {
      toast({
        title: "שגיאה בהפעלת הסוכן",
        description: err.message,
        variant: "destructive",
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: `❌ שגיאה: ${err.message}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle>הפעלה ידנית - {automationName}</DialogTitle>
          <DialogDescription>
            כתוב הוראות לסוכן AI והוא יבצע אותן
          </DialogDescription>
        </DialogHeader>

        {/* Chat messages area */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-[300px] max-h-[400px] overflow-y-auto space-y-3 p-3 rounded-lg border bg-muted/20"
        >
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <Bot className="h-5 w-5 ml-2 opacity-50" />
              כתוב פקודה כדי להתחיל...
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <div
                dir="rtl"
                className={`rounded-lg px-3 py-2 max-w-[80%] text-sm whitespace-pre-wrap text-right ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isRunning && (
            <div className="flex gap-2">
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-secondary text-secondary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-lg px-3 py-2 bg-card border text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="flex gap-2 items-end">
          <Textarea
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            placeholder="למשל: שלח הודעת מעקב לכל הלידים החדשים מהיום..."
            className="min-h-[60px] max-h-[120px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleRun();
              }
            }}
          />
          <Button
            size="icon"
            onClick={handleRun}
            disabled={isRunning || !commandText.trim()}
            className="flex-shrink-0 h-10 w-10"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Ctrl+Enter לשליחה מהירה
        </p>
      </DialogContent>
    </Dialog>
  );
}

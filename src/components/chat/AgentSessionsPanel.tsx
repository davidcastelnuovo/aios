import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, MessageSquare, Pause, Play, Square, Phone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "sonner";

interface CarmenSession {
  id: string;
  tenant_id: string;
  chat_id: string;
  phone: string | null;
  sender_name: string | null;
  agent_id: string;
  conversation_history: any[];
  status: string;
  last_message_at: string | null;
  created_at: string;
  ai_conversation_id: string | null;
  agent?: { name: string } | null;
}

interface UnifiedSession {
  id: string;
  source: "whatsapp" | "internal";
  title: string;
  subtitle: string;
  status: string;
  lastActivity: string;
  agentName: string;
  messages: { role: string; content: string; timestamp?: string }[];
  raw: any;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "פעיל", variant: "default" },
  paused: { label: "מושהה", variant: "secondary" },
  ended: { label: "הסתיים", variant: "outline" },
  expired: { label: "פג תוקף", variant: "outline" },
};

export default function AgentSessionsPanel() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Carmen WhatsApp sessions
  const { data: carmenSessions = [], isLoading: loadingCarmen } = useQuery({
    queryKey: ["agent-sessions-carmen", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carmen_whatsapp_sessions")
        .select("*, agent:ai_agents(name)")
        .eq("tenant_id", tenantId!)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as CarmenSession[];
    },
    enabled: !!tenantId,
  });

  // Internal AIOS conversations (only those NOT linked to a Carmen WhatsApp session)
  const { data: aiConversations = [] } = useQuery({
    queryKey: ["agent-sessions-internal", tenantId],
    queryFn: async () => {
      const linkedIds = carmenSessions
        .map((s) => s.ai_conversation_id)
        .filter((x): x is string => !!x);

      let query = supabase
        .from("ai_conversations")
        .select("id, title, messages, updated_at, created_at, user_id")
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false })
        .limit(100);

      if (linkedIds.length > 0) {
        query = query.not("id", "in", `(${linkedIds.join(",")})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Realtime updates
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`agent-sessions-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "carmen_whatsapp_sessions", filter: `tenant_id=eq.${tenantId}` },
        () => queryClient.invalidateQueries({ queryKey: ["agent-sessions-carmen", tenantId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_conversations", filter: `tenant_id=eq.${tenantId}` },
        () => queryClient.invalidateQueries({ queryKey: ["agent-sessions-internal", tenantId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  const sessions: UnifiedSession[] = useMemo(() => {
    const carmen: UnifiedSession[] = carmenSessions.map((s) => ({
      id: `carmen-${s.id}`,
      source: "whatsapp",
      title: s.sender_name || s.phone || "ללא שם",
      subtitle: s.phone || s.chat_id,
      status: s.status,
      lastActivity: s.last_message_at || s.created_at,
      agentName: s.agent?.name || "כרמן",
      messages: Array.isArray(s.conversation_history) ? s.conversation_history : [],
      raw: s,
    }));
    const internal: UnifiedSession[] = aiConversations.map((c: any) => ({
      id: `internal-${c.id}`,
      source: "internal",
      title: c.title || "שיחה פנימית",
      subtitle: "AIOS",
      status: "active",
      lastActivity: c.updated_at || c.created_at,
      agentName: "סוכן AI",
      messages: Array.isArray(c.messages) ? c.messages : [],
      raw: c,
    }));
    return [...carmen, ...internal].sort(
      (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  }, [carmenSessions, aiConversations]);

  const selected = sessions.find((s) => s.id === selectedId) || sessions[0] || null;

  const updateCarmenStatus = async (sessionId: string, newStatus: "active" | "paused" | "ended") => {
    const updates: any = { status: newStatus };
    if (newStatus === "ended") updates.ended_at = new Date().toISOString();
    const { error } = await supabase
      .from("carmen_whatsapp_sessions")
      .update(updates)
      .eq("id", sessionId);
    if (error) {
      toast.error("שגיאה בעדכון הסשן");
      console.error(error);
    } else {
      toast.success(
        newStatus === "active" ? "הסשן הופעל מחדש" : newStatus === "paused" ? "הסשן הושהה" : "הסשן נסגר"
      );
      queryClient.invalidateQueries({ queryKey: ["agent-sessions-carmen", tenantId] });
    }
  };

  return (
    <>
      {/* Sessions list */}
      <Card className="flex flex-col w-full md:w-96 h-full overflow-hidden">
        <div className="sticky top-0 z-10 bg-card p-4 border-b">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">סשנים עם סוכני AI</h2>
            <Badge variant="secondary" className="ms-auto">{sessions.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            שיחות פעילות והיסטוריה. לחץ על "השהה" כדי לעצור את הסוכן מלענות.
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loadingCarmen && <div className="p-4 text-sm text-muted-foreground">טוען...</div>}
            {!loadingCarmen && sessions.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                אין סשנים פעילים עם סוכני AI
              </div>
            )}
            {sessions.map((s) => {
              const isSelected = selected?.id === s.id;
              const statusInfo = STATUS_LABELS[s.status] || { label: s.status, variant: "outline" as const };
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full text-right p-3 rounded-md transition-colors ${
                    isSelected ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {s.source === "whatsapp" ? <Phone className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{s.title}</span>
                        <Badge variant={statusInfo.variant} className="text-[10px] py-0 px-1.5 h-4">
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {s.agentName} · {s.source === "whatsapp" ? "WhatsApp" : "פנימי"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {s.lastActivity
                          ? formatDistanceToNow(new Date(s.lastActivity), { addSuffix: true, locale: he })
                          : "—"}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </Card>

      {/* Session detail */}
      <Card className="flex-1 h-full min-h-0 overflow-hidden flex flex-col">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Bot className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">בחר סשן כדי לראות את ההיסטוריה</p>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{selected.title}</h3>
                  <Badge variant={STATUS_LABELS[selected.status]?.variant || "outline"}>
                    {STATUS_LABELS[selected.status]?.label || selected.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {selected.agentName} · {selected.source === "whatsapp" ? `WhatsApp · ${selected.subtitle}` : "שיחה פנימית"}
                </p>
              </div>
              {selected.source === "whatsapp" && (
                <div className="flex items-center gap-2">
                  {selected.status === "active" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => updateCarmenStatus(selected.raw.id, "paused")}
                    >
                      <Pause className="h-3.5 w-3.5 ms-1" />
                      השהה
                    </Button>
                  )}
                  {selected.status === "paused" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => updateCarmenStatus(selected.raw.id, "active")}
                    >
                      <Play className="h-3.5 w-3.5 ms-1" />
                      המשך
                    </Button>
                  )}
                  {(selected.status === "active" || selected.status === "paused") && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => updateCarmenStatus(selected.raw.id, "ended")}
                    >
                      <Square className="h-3.5 w-3.5 ms-1" />
                      סיים
                    </Button>
                  )}
                </div>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {selected.messages.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    אין הודעות בסשן זה
                  </div>
                ) : (
                  selected.messages.map((m, i) => {
                    const isUser = m.role === "user";
                    return (
                      <div key={i} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                            isUser
                              ? "bg-muted text-foreground"
                              : "bg-primary text-primary-foreground"
                          }`}
                        >
                          {m.content}
                          {m.timestamp && (
                            <div className={`text-[10px] mt-1 opacity-70`}>
                              {new Date(m.timestamp).toLocaleString("he-IL")}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </Card>
    </>
  );
}

/**
 * StageWorkspace
 * ──────────────
 * Full-screen "department" overlay for a single pipeline stage.
 * Left panel: Carmen chat (with stage-specific role/skin)
 * Right panel: Work items list + asset previews + run controls
 */
import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  X,
  Send,
  Play,
  Loader2,
  Bot,
  User,
  Lightbulb,
  PenLine,
  Image as ImageIcon,
  Megaphone,
  Search,
  Share2,
  BarChart3,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Stage identity ───────────────────────────────────────────────────────────
const STAGE_CONFIG: Record<string, { icon: any; label: string; agentRole: string; headerBg: string; accentColor: string; systemHint: string }> = {
  strategy: {
    icon: Lightbulb,
    label: "מחלקת אסטרטגיה",
    agentRole: "אסטרטגיסטית שיווקית",
    headerBg: "from-amber-600 to-amber-500",
    accentColor: "amber",
    systemHint: "את אסטרטגיסטית שיווקית מנוסה. תפקידך לבנות בריף שיווקי מפורט המבוסס על מידע הלקוח.",
  },
  copy: {
    icon: PenLine,
    label: "מחלקת כתיבה",
    agentRole: "קופירייטרית",
    headerBg: "from-sky-600 to-sky-500",
    accentColor: "sky",
    systemHint: "את קופירייטרית מוכשרת. תפקידך לכתוב תוכן שיווקי מרתק ומשכנע.",
  },
  creative: {
    icon: ImageIcon,
    label: "מחלקת קריאייטיב",
    agentRole: "מעצבת גרפית",
    headerBg: "from-fuchsia-600 to-fuchsia-500",
    accentColor: "fuchsia",
    systemHint: "את מעצבת גרפית יצירתית. תפקידך ליצור פרומפטים לתמונות ולתאר ויז'ואלים מרשימים.",
  },
  target_paid: {
    icon: Megaphone,
    label: "מחלקת קמפיינים",
    agentRole: "מנהלת קמפיינים",
    headerBg: "from-rose-600 to-rose-500",
    accentColor: "rose",
    systemHint: "את מנהלת קמפיינים ממומנים מנוסה ב-Meta ו-Google Ads.",
  },
  target_seo: {
    icon: Search,
    label: "מחלקת SEO",
    agentRole: "מומחית SEO/GEO",
    headerBg: "from-emerald-600 to-emerald-500",
    accentColor: "emerald",
    systemHint: "את מומחית SEO ו-GEO. תפקידך לבנות אסטרטגיית תוכן לקידום אורגני.",
  },
  target_organic: {
    icon: Share2,
    label: "מחלקת סושיאל",
    agentRole: "מנהלת מדיה חברתית",
    headerBg: "from-violet-600 to-violet-500",
    accentColor: "violet",
    systemHint: "את מנהלת מדיה חברתית מנוסה. תפקידך לתכנן ולפרסם תוכן אורגני.",
  },
  measurement: {
    icon: BarChart3,
    label: "מחלקת מדידה",
    agentRole: "אנליסטית שיווקית",
    headerBg: "from-blue-600 to-blue-500",
    accentColor: "blue",
    systemHint: "את אנליסטית שיווקית. תפקידך לנתח ביצועים ולהפיק תובנות.",
  },
};

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  draft: { label: "טיוטה", icon: Clock, color: "text-gray-500" },
  in_progress: { label: "בעבודה", icon: Loader2, color: "text-blue-500" },
  awaiting_approval: { label: "ממתין לאישור", icon: AlertCircle, color: "text-amber-500" },
  completed: { label: "הושלם", icon: CheckCircle2, color: "text-emerald-500" },
  failed: { label: "נכשל", icon: AlertCircle, color: "text-red-500" },
};

// ─── Chat Message ─────────────────────────────────────────────────────────────
function ChatMessage({ msg }: { msg: { role: "user" | "assistant"; content: string; ts: number } }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2 mb-3", isUser ? "flex-row-reverse" : "flex-row")} dir="rtl">
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold",
          isUser ? "bg-primary" : "bg-gradient-to-br from-violet-500 to-fuchsia-500"
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted/70 text-foreground rounded-tl-sm"
        )}
      >
        {msg.content}
      </div>
    </div>
  );
}

// ─── Work Item Row ────────────────────────────────────────────────────────────
function WorkItemRow({
  item,
  stage,
  onSelect,
  onRun,
  running,
}: {
  item: any;
  stage: any;
  onSelect: () => void;
  onRun: () => void;
  running: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 overflow-hidden" dir="rtl">
      <div
        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/30"
        onClick={() => setExpanded(!expanded)}
      >
        <StatusIcon className={cn("h-4 w-4 shrink-0", statusCfg.color, item.status === "in_progress" && "animate-spin")} />
        <span className="flex-1 text-sm font-medium truncate">{item.title ?? "ללא כותרת"}</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onRun();
          }}
          disabled={running}
          title="הרץ שלב"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </Button>
        <button
          className="text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>
      {expanded && (
        <div className="border-t border-border/40 p-3 space-y-2">
          {item.payload?.brief && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">בריף</div>
              <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{item.payload.brief}</p>
            </div>
          )}
          {item.payload?.copy_text && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">קופי</div>
              <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{item.payload.copy_text}</p>
            </div>
          )}
          {item.payload?.image_url && (
            <img src={item.payload.image_url} alt="" className="w-full rounded-lg object-cover max-h-40" />
          )}
          <Button size="sm" variant="outline" className="w-full text-xs" onClick={onSelect}>
            פתח פריט מלא
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  stage: any;
  pipelineId: string;
  tenantId: string;
  clientId: string;
  items: any[];
  onClose: () => void;
  onSelectItem: (id: string) => void;
  onNewItem: () => void;
}

export function StageWorkspace({
  stage,
  pipelineId,
  tenantId,
  clientId,
  items,
  onClose,
  onSelectItem,
  onNewItem,
}: Props) {
  const queryClient = useQueryClient();
  const cfg = STAGE_CONFIG[stage.stage_type] ?? STAGE_CONFIG.strategy;
  const Icon = cfg.icon;

  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string; ts: number }[]>([
    {
      role: "assistant",
      content: `שלום! אני כרמן, ${cfg.agentRole} שלך. אני כאן כדי לעזור לך עם ${cfg.label.replace("מחלקת ", "")}. איך אוכל לעזור?`,
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || chatLoading) return;
    const userMsg = { role: "user" as const, content: input.trim(), ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setChatLoading(true);

    try {
      // Build context from stage + items
      const itemsSummary = items
        .slice(0, 3)
        .map((i) => `- ${i.title}: ${i.payload?.brief ?? i.payload?.copy_text ?? ""}`)
        .join("\n");

      const systemPrompt = `${cfg.systemHint}
${stage.configuration?.instructions ? `הוראות ספציפיות לשלב: ${stage.configuration.instructions}` : ""}
${itemsSummary ? `פריטי תוכן נוכחיים:\n${itemsSummary}` : ""}
ענה תמיד בעברית, בצורה מקצועית ועניינית.`;

      const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));

      // Build conversation history as context prefix
      const historyText = history
        .map((m) => `${m.role === "user" ? "משתמש" : "כרמן"}: ${m.content}`)
        .join("\n");

      const fullCommand = historyText
        ? `${historyText}\nמשתמש: ${userMsg.content}`
        : userMsg.content;

      const { data, error } = await supabase.functions.invoke("run-ai-agent", {
        body: {
          command_text: fullCommand,
          agent_id: stage.agent_id ?? null,
          tenant_id: tenantId,
          client_id: clientId,
          task_mode: "copywriting",
          user_name: "מחלקת שיווק",
        },
      });

      if (error) throw error;
      const reply = data?.output ?? data?.reply ?? data?.message ?? "לא הצלחתי לעבד את הבקשה.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply, ts: Date.now() }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `שגיאה: ${e.message}`, ts: Date.now() },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleRun = async (itemId: string) => {
    setRunning(itemId);
    try {
      const { error } = await supabase.functions.invoke("marketing-run-stage", {
        body: { item_id: itemId, stage_id: stage.id },
      });
      if (error) throw error;
      toast({ title: "השלב הורץ בהצלחה" });
      queryClient.invalidateQueries({ queryKey: ["marketing-items", pipelineId] });
      queryClient.invalidateQueries({ queryKey: ["marketing-assets", itemId] });
    } catch (e: any) {
      toast({ title: "שגיאה בהרצה", description: e.message, variant: "destructive" });
    } finally {
      setRunning(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md"
      dir="rtl"
    >
      {/* Header */}
      <div className={cn("flex items-center gap-3 px-4 py-3 bg-gradient-to-l text-white", cfg.headerBg)}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold">{cfg.label}</h2>
          <p className="text-xs text-white/70">
            {stage.ai_agents?.name ?? "כרמן"} · {cfg.agentRole}
          </p>
        </div>
        <div className="ms-auto flex items-center gap-2">
          <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
            {items.length} פריטים
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Body: Chat (right) + Items (left) */}
      <div className="flex flex-1 min-h-0">
        {/* Chat panel (right side in RTL = visual right) */}
        <div className="flex flex-1 flex-col border-l border-border/40 min-w-0">
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.map((msg) => (
              <ChatMessage key={msg.ts} msg={msg} />
            ))}
            {chatLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3" dir="rtl">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>●</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>●</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>●</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick prompts */}
          <div className="flex gap-2 overflow-x-auto px-4 pb-2" dir="rtl">
            {["צור בריף", "כתוב קופי", "הצע רעיונות", "נתח ביצועים"].map((prompt) => (
              <button
                key={prompt}
                onClick={() => setInput(prompt)}
                className="shrink-0 flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Sparkles className="h-3 w-3" />
                {prompt}
              </button>
            ))}
          </div>

          {/* Chat input */}
          <div className="border-t border-border/40 p-3" dir="rtl">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={`שאל את כרמן (${cfg.agentRole})...`}
                className="min-h-[40px] max-h-[120px] resize-none text-sm"
                rows={1}
              />
              <Button
                size="sm"
                className="h-10 w-10 shrink-0 p-0"
                onClick={sendMessage}
                disabled={!input.trim() || chatLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Items panel (left side in RTL = visual left) */}
        <div className="w-80 shrink-0 flex flex-col border-r border-border/40 bg-muted/10">
          <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
            <span className="text-sm font-semibold">פריטי תוכן</span>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onNewItem}>
              <Plus className="h-3 w-3" />
              חדש
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Icon className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">אין פריטים בשלב זה</p>
                <Button size="sm" variant="outline" className="mt-3 text-xs" onClick={onNewItem}>
                  <Plus className="h-3 w-3 ml-1" />
                  הוסף פריט
                </Button>
              </div>
            ) : (
              items.map((item) => (
                <WorkItemRow
                  key={item.id}
                  item={item}
                  stage={stage}
                  onSelect={() => onSelectItem(item.id)}
                  onRun={() => handleRun(item.id)}
                  running={running === item.id}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

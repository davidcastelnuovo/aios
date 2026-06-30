/**
 * StageWorkspace
 * ──────────────
 * Full-screen "department" overlay for a single pipeline stage.
 * RIGHT panel (60%): Carmen chat with stage skin
 * LEFT panel (40%): Work items + assets + approval controls
 */
import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  Check,
  Zap,
  Hand,
  Edit,
} from "lucide-react";

// ─── Stage identity ───────────────────────────────────────────────────────────
const STAGE_CONFIG: Record<
  string,
  {
    icon: any;
    label: string;
    agentRole: string;
    headerBg: string;
    accentColor: string;
    systemHint: string;
    quickPrompts: string[];
  }
> = {
  strategy: {
    icon: Lightbulb,
    label: "מחלקת אסטרטגיה",
    agentRole: "אסטרטגיסטית שיווקית",
    headerBg: "from-amber-600 to-amber-500",
    accentColor: "amber",
    systemHint:
      "את אסטרטגיסטית שיווקית מנוסה. תפקידך לבנות בריף שיווקי מפורט המבוסס על מידע הלקוח.",
    quickPrompts: ["בנה בריף מלא", "ניתוח מתחרים", "הגדר קהל יעד"],
  },
  copy: {
    icon: PenLine,
    label: "מחלקת כתיבה",
    agentRole: "קופירייטרית",
    headerBg: "from-sky-600 to-sky-500",
    accentColor: "sky",
    systemHint:
      "את קופירייטרית מוכשרת. תפקידך לכתוב תוכן שיווקי מרתק ומשכנע.",
    quickPrompts: ["כתוב קופי לפייסבוק", "כתוב קופי לאינסטגרם", "3 גרסאות שונות"],
  },
  creative: {
    icon: ImageIcon,
    label: "מחלקת קריאייטיב",
    agentRole: "מעצבת גרפית",
    headerBg: "from-fuchsia-600 to-fuchsia-500",
    accentColor: "fuchsia",
    systemHint:
      "את מעצבת גרפית יצירתית. תפקידך ליצור פרומפטים לתמונות ולתאר ויז'ואלים מרשימים.",
    quickPrompts: ["תאר ויז'ואל לבאנר", "פרומפט לתמונה", "פלטת צבעים"],
  },
  target_paid: {
    icon: Megaphone,
    label: "מחלקת קמפיינים",
    agentRole: "מנהלת קמפיינים",
    headerBg: "from-rose-600 to-rose-500",
    accentColor: "rose",
    systemHint:
      "את מנהלת קמפיינים ממומנים מנוסה ב-Meta ו-Google Ads.",
    quickPrompts: ["הגדרות קמפיין Meta", "תקציב ומיקוד", "מבנה אד-סט"],
  },
  target_seo: {
    icon: Search,
    label: "מחלקת SEO",
    agentRole: "מומחית SEO/GEO",
    headerBg: "from-emerald-600 to-emerald-500",
    accentColor: "emerald",
    systemHint:
      "את מומחית SEO ו-GEO. תפקידך לבנות אסטרטגיית תוכן לקידום אורגני.",
    quickPrompts: ["מילות מפתח ראשיות", "מבנה כתבה SEO", "מטא-תיאור"],
  },
  target_organic: {
    icon: Share2,
    label: "מחלקת סושיאל",
    agentRole: "מנהלת מדיה חברתית",
    headerBg: "from-violet-600 to-violet-500",
    accentColor: "violet",
    systemHint:
      "את מנהלת מדיה חברתית מנוסה. תפקידך לתכנן ולפרסם תוכן אורגני.",
    quickPrompts: ["קפשן לאינסטגרם", "תזמון אידאלי", "האשטגים"],
  },
  measurement: {
    icon: BarChart3,
    label: "מחלקת מדידה",
    agentRole: "אנליסטית שיווקית",
    headerBg: "from-blue-600 to-blue-500",
    accentColor: "blue",
    systemHint:
      "את אנליסטית שיווקית. תפקידך לנתח ביצועים ולהפיק תובנות.",
    quickPrompts: ["סיכום ביצועים", "המלצות לשיפור", "השוואה לחודש קודם"],
  },
};

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; borderColor: string }> = {
  draft: { label: "טיוטה", icon: Clock, color: "text-gray-500", borderColor: "border-border/60" },
  in_progress: { label: "בעבודה", icon: Loader2, color: "text-blue-500", borderColor: "border-blue-400" },
  awaiting_approval: { label: "ממתין לאישור", icon: AlertCircle, color: "text-amber-500", borderColor: "border-amber-400" },
  completed: { label: "הושלם", icon: CheckCircle2, color: "text-emerald-500", borderColor: "border-emerald-400" },
  failed: { label: "נכשל", icon: AlertCircle, color: "text-red-500", borderColor: "border-red-400" },
};

// ─── Mode Toggle ──────────────────────────────────────────────────────────────
function ModeToggle({
  stage,
  onUpdate,
}: {
  stage: any;
  onUpdate: (mode: string) => void;
}) {
  const current = stage.approval_mode ?? "semi";
  const modes = [
    { key: "auto", label: "אוטומטי", icon: Zap, activeClass: "bg-emerald-500 text-white" },
    { key: "semi", label: "חצי", icon: Clock, activeClass: "bg-amber-500 text-white" },
    { key: "manual", label: "ידני", icon: Hand, activeClass: "bg-gray-500 text-white" },
  ];

  return (
    <div className="flex rounded-lg overflow-hidden border border-white/30 bg-white/10 text-xs font-medium shrink-0">
      {modes.map((m) => {
        const MIcon = m.icon;
        const active = current === m.key;
        return (
          <button
            key={m.key}
            onClick={() => onUpdate(m.key)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 transition-all",
              active ? m.activeClass : "text-white/70 hover:bg-white/10"
            )}
          >
            <MIcon className="h-3 w-3" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Chat Message ─────────────────────────────────────────────────────────────
function ChatMessage({
  msg,
}: {
  msg: { role: "user" | "assistant"; content: string; ts: number };
}) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3 mb-4", isUser ? "flex-row-reverse" : "flex-row")} dir="rtl">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold shadow-sm",
          isUser
            ? "bg-primary"
            : "bg-gradient-to-br from-violet-500 to-fuchsia-500"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-card/80 border border-border/50 text-foreground rounded-tl-sm"
        )}
      >
        {msg.content}
      </div>
    </div>
  );
}

// ─── Work Item Card ───────────────────────────────────────────────────────────
function WorkItemCard({
  item,
  stage,
  onSelect,
  onRun,
  onApprove,
  onReject,
  running,
}: {
  item: any;
  stage: any;
  onSelect: () => void;
  onRun: () => void;
  onApprove: () => void;
  onReject: () => void;
  running: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;
  const isRunning = item.status === "in_progress" || running;
  const isAwaiting = item.status === "awaiting_approval";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card/60 shadow backdrop-blur-sm overflow-hidden transition-all",
        isRunning
          ? "border-blue-400 animate-pulse"
          : isAwaiting
          ? "border-amber-400"
          : statusCfg.borderColor,
        "hover:shadow-lg hover:border-primary/30 hover:scale-[1.01]"
      )}
      dir="rtl"
    >
      {/* Thumbnail */}
      {item.payload?.image_url && (
        <img
          src={item.payload.image_url}
          alt=""
          className="w-full h-32 object-cover"
        />
      )}

      <div className="p-3 space-y-2">
        {/* Title row */}
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <StatusIcon
            className={cn(
              "h-4 w-4 shrink-0",
              statusCfg.color,
              (item.status === "in_progress" || running) && "animate-spin"
            )}
          />
          <span className="flex-1 text-sm font-bold truncate">
            {item.title ?? "ללא כותרת"}
          </span>
          <Badge
            variant="outline"
            className={cn("text-[10px] px-1.5 py-0 border-current", statusCfg.color)}
          >
            {statusCfg.label}
          </Badge>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
        </div>

        {/* Copy preview (2 lines) */}
        {(item.payload?.brief || item.payload?.copy_text) && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {item.payload?.copy_text ?? item.payload?.brief}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-xs gap-1"
            onClick={onRun}
            disabled={running}
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            הרץ שלב
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 shrink-0"
            onClick={onSelect}
            title="ערוך"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Approval buttons */}
        {isAwaiting && (
          <div className="flex gap-2 mt-1">
            <Button
              size="sm"
              onClick={onApprove}
              className="flex-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1"
            >
              <Check className="h-3.5 w-3.5" />
              אשר
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={onReject}
              className="flex-1 h-7 text-xs gap-1"
            >
              <X className="h-3.5 w-3.5" />
              דחה
            </Button>
          </div>
        )}

        {/* Expanded details */}
        {expanded && (
          <div className="border-t border-border/40 pt-2 space-y-2">
            {item.payload?.brief && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  בריף
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {item.payload.brief}
                </p>
              </div>
            )}
            {item.payload?.copy_text && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  קופי
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {item.payload.copy_text}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Payload field per stage type ────────────────────────────────────────────
const STAGE_PAYLOAD_KEY: Record<string, string> = {
  strategy: "brief",
  copy: "copy_text",
  creative: "creative_notes",
  target_paid: "campaign_notes",
  target_seo: "seo_notes",
  target_organic: "social_notes",
  measurement: "measurement_notes",
};

// Which payload keys from prior stages to inject as context
const STAGE_PRIOR_KEYS: Record<string, { key: string; label: string }[]> = {
  strategy: [],
  copy: [{ key: "brief", label: "בריף" }],
  creative: [{ key: "brief", label: "בריף" }, { key: "copy_text", label: "קופי" }],
  target_paid: [{ key: "brief", label: "בריף" }, { key: "copy_text", label: "קופי" }, { key: "creative_notes", label: "קריאייטיב" }],
  target_seo: [{ key: "brief", label: "בריף" }, { key: "copy_text", label: "קופי" }],
  target_organic: [{ key: "brief", label: "בריף" }, { key: "copy_text", label: "קופי" }],
  measurement: [{ key: "brief", label: "בריף" }, { key: "copy_text", label: "קופי" }],
};

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
  const agentName = stage.ai_agents?.name ?? "כרמן";

  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string; ts: number }[]
  >([
    {
      role: "assistant",
      content: `שלום! אני ${agentName}, ${cfg.agentRole} שלך. אני כאן כדי לעזור לך עם ${cfg.label.replace("מחלקת ", "")}. איך אוכל לעזור?`,
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(
    items.length === 1 ? items[0].id : null
  );
  const [savingPayload, setSavingPayload] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeItem = items.find((i) => i.id === activeItemId) ?? null;

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
      // Build prior-stage context from the active item's payload
      const priorKeys = STAGE_PRIOR_KEYS[stage.stage_type] ?? [];
      const priorContext = activeItem
        ? priorKeys
            .filter(({ key }) => activeItem.payload?.[key])
            .map(({ key, label }) => `=== ${label} ===\n${activeItem.payload[key]}`)
            .join("\n\n")
        : "";

      const systemPrompt = `${cfg.systemHint}
${stage.configuration?.instructions ? `הוראות ספציפיות לשלב: ${stage.configuration.instructions}` : ""}
${activeItem ? `\nאתה עובד על הפריט: "${activeItem.title}"` : ""}
${priorContext ? `\n=== הקשר משלבים קודמים ===\n${priorContext}` : ""}
ענה תמיד בעברית, בצורה מקצועית ועניינית.`;

      const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));

      const historyText = history
        .map((m) => `${m.role === "user" ? "משתמש" : "כרמן"}: ${m.content}`)
        .join("\n");

      const fullCommand = historyText
        ? `${historyText}\nמשתמש: ${userMsg.content}`
        : userMsg.content;

      const STAGE_TYPE_TO_TASK_MODE: Record<string, string> = {
        strategy: "marketing_strategy",
        copy: "marketing_copy",
        creative: "marketing_creative",
        target_paid: "marketing_paid",
        target_seo: "marketing_seo",
        target_organic: "marketing_social",
        measurement: "marketing_analytics",
      };

      const { data, error } = await supabase.functions.invoke("run-ai-agent", {
        body: {
          command_text: fullCommand,
          agent_id: stage.agent_id ?? null,
          tenant_id: tenantId,
          client_id: clientId,
          task_mode: STAGE_TYPE_TO_TASK_MODE[stage.stage_type] ?? "copywriting",
          system_prompt_addon: systemPrompt,
          user_name: "מחלקת שיווק",
        },
      });

      if (error) throw error;
      const reply =
        data?.output ?? data?.reply ?? data?.message ?? "לא הצלחתי לעבד את הבקשה.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply, ts: Date.now() }]);

      // Auto-save Carmen's output to the active item's payload
      const payloadKey = STAGE_PAYLOAD_KEY[stage.stage_type];
      if (activeItem && payloadKey) {
        const updatedPayload = { ...(activeItem.payload ?? {}), [payloadKey]: reply };
        await supabase
          .from("marketing_work_items")
          .update({ payload: updatedPayload })
          .eq("id", activeItem.id);
        queryClient.invalidateQueries({ queryKey: ["marketing-items", pipelineId] });
      }
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

  const handleApprove = async (itemId: string) => {
    try {
      await supabase
        .from("marketing_work_items")
        .update({ status: "approved" })
        .eq("id", itemId);
      queryClient.invalidateQueries({ queryKey: ["marketing-items", pipelineId] });
      toast({ title: "הפריט אושר" });
    } catch (e: any) {
      toast({ title: "שגיאה באישור", description: e.message, variant: "destructive" });
    }
  };

  const handleReject = async (itemId: string) => {
    try {
      await supabase
        .from("marketing_work_items")
        .update({ status: "draft" })
        .eq("id", itemId);
      queryClient.invalidateQueries({ queryKey: ["marketing-items", pipelineId] });
      toast({ title: "הפריט נדחה וחזר לטיוטה" });
    } catch (e: any) {
      toast({ title: "שגיאה בדחייה", description: e.message, variant: "destructive" });
    }
  };

  const handleUpdateMode = async (mode: string) => {
    try {
      await supabase
        .from("pipeline_stages")
        .update({ approval_mode: mode })
        .eq("id", stage.id);
      toast({ title: `מצב עדכן ל-${mode}` });
    } catch (e: any) {
      toast({ title: "שגיאה בעדכון מצב", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md" dir="rtl">
      {/* Header */}
      <header
        className={cn(
          "bg-gradient-to-l text-white px-6 py-4 flex items-center gap-4 shrink-0 shadow-lg",
          cfg.headerBg
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 shrink-0">
          <Icon className="h-7 w-7" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-tight">{cfg.label}</h1>
          <p className="text-sm opacity-80">
            {agentName} · {cfg.agentRole}
          </p>
        </div>
        <ModeToggle stage={stage} onUpdate={handleUpdateMode} />
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 transition-colors shrink-0"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* RIGHT panel: Carmen Chat (60%) */}
        <div className="flex flex-[3] flex-col border-l border-border/40 min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-1">
            {messages.map((msg) => (
              <ChatMessage key={msg.ts} msg={msg} />
            ))}
            {chatLoading && (
              <div className="flex items-center gap-3 mb-3" dir="rtl">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-sm">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="flex gap-1 items-center bg-card/80 border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3">
                  <span className="animate-bounce text-muted-foreground" style={{ animationDelay: "0ms" }}>●</span>
                  <span className="animate-bounce text-muted-foreground" style={{ animationDelay: "150ms" }}>●</span>
                  <span className="animate-bounce text-muted-foreground" style={{ animationDelay: "300ms" }}>●</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick prompt chips */}
          <div className="flex gap-2 overflow-x-auto px-5 pb-2 shrink-0" dir="rtl">
            {cfg.quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => setInput(prompt)}
                className="shrink-0 flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Sparkles className="h-3 w-3" />
                {prompt}
              </button>
            ))}
          </div>

          {/* Input area */}
          <div className="border-t border-border/40 p-4 shrink-0" dir="rtl">
            <div className="flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={`שאל את ${agentName} (${cfg.agentRole})...`}
                className="min-h-[44px] max-h-[140px] resize-none text-sm"
                rows={1}
              />
              <Button
                className="h-11 w-24 shrink-0 gap-1.5 text-xs"
                onClick={sendMessage}
                disabled={!input.trim() || chatLoading}
              >
                <Send className="h-3.5 w-3.5" />
                שלח
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 text-left opacity-60">
              Ctrl+Enter לשליחה מהירה
            </p>
          </div>
        </div>

        {/* LEFT panel: Work Items (40%) */}
        <div className="flex-[2] shrink-0 flex flex-col border-r border-border/40 bg-muted/10 min-w-0">
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3 shrink-0">
            <span className="text-sm font-bold">פריטי תוכן</span>
            <Badge variant="outline" className="text-xs">
              {items.length} פריטים
            </Badge>
          </div>

          {/* Active item indicator */}
          {activeItem && (
            <div className="px-4 py-2 shrink-0 border-b border-border/30 bg-primary/5">
              <p className="text-[11px] text-primary font-semibold">
                עובד על: {activeItem.title}
              </p>
              {(STAGE_PRIOR_KEYS[stage.stage_type] ?? []).some(({ key }) => activeItem.payload?.[key]) && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  ✓ הקשר משלבים קודמים הוזרק לכרמן
                </p>
              )}
            </div>
          )}

          {/* Items list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 mb-3">
                  <Icon className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1">אין פריטים בשלב זה</p>
                <p className="text-xs text-muted-foreground/60 mb-4">לחץ להוספת פריט חדש</p>
                <Button size="sm" variant="outline" className="text-xs gap-1" onClick={onNewItem}>
                  <Plus className="h-3.5 w-3.5" />
                  הוסף פריט
                </Button>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-2xl ring-2 transition-all cursor-pointer",
                    activeItemId === item.id
                      ? "ring-primary"
                      : "ring-transparent hover:ring-primary/30"
                  )}
                  onClick={() => setActiveItemId(item.id === activeItemId ? null : item.id)}
                >
                  <WorkItemCard
                    item={item}
                    stage={stage}
                    onSelect={() => setActiveItemId(item.id)}
                    onRun={() => handleRun(item.id)}
                    onApprove={() => handleApprove(item.id)}
                    onReject={() => handleReject(item.id)}
                    running={running === item.id}
                  />
                </div>
              ))
            )}
          </div>

          {/* New item button */}
          <div className="border-t border-border/40 p-3 shrink-0">
            <Button
              variant="outline"
              className="w-full text-sm gap-2 h-10"
              onClick={onNewItem}
            >
              <Plus className="h-4 w-4" />
              פריט חדש
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

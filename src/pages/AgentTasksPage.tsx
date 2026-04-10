import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, Play, CheckCircle2, XCircle, Clock, Loader2, ArrowRight,
  Image, ExternalLink, Calendar, Repeat, Zap, GitFork, ChevronDown,
  ChevronUp, Trash2, ToggleLeft, ToggleRight, Timer, ListTodo, Target,
  Settings, Bot, AlertTriangle, Sparkles, Heart, Pencil, RotateCcw
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { GoalTree } from "@/components/tasks/GoalTree";
import { format } from "date-fns";
import agentGeneral from "@/assets/agents/agent-general.png";
import agentCreative from "@/assets/agents/agent-creative.png";
import agentCeo from "@/assets/agents/agent-ceo.png";
import agentSeo from "@/assets/agents/agent-seo.png";

const CARMEN_AVATAR = "https://d2xsxph8kpxj0f.cloudfront.net/310419663030948028/XGJWpzb5zh76ZdoV37Q3K8/carmen-agents-avatar_17945787.png";

const AGENT_AVATARS: Record<string, string> = {
  "כרמן": CARMEN_AVATAR,
  "carmen": CARMEN_AVATAR,
  "Carmen": CARMEN_AVATAR,
  "סוכן כללי": agentGeneral,
  "סוכן קריאייטיב": agentCreative,
  "ceo": agentCeo,
  "CEO": agentCeo,
  "SEO": agentSeo,
  "seo": agentSeo,
};
const DEFAULT_AVATAR = agentGeneral;

// ─── Skills & Modes ────────────────────────────────────────────────────────────
const BUILT_IN_SKILLS = [
  { id: "lead-qualifier",      icon: "🎯", name: "הסמכת לידים",           description: "מדרג אוטומטי של לידים" },
  { id: "follow-up",           icon: "🔄", name: "פולואפ אוטומטי",         description: "הודעות מעקב בזמנים הנכונים" },
  { id: "proposal-writer",     icon: "📝", name: "כתיבת הצעות",            description: "הצעות מותאמות אישית" },
  { id: "meeting-prep",        icon: "🤝", name: "הכנה לפגישות",           description: "סיכום ונקודות דיון" },
  { id: "objection-handler",   icon: "🛡️", name: "טיפול בהתנגדויות",      description: "עונה להתנגדויות" },
  { id: "task-manager",        icon: "✅", name: "ניהול משימות",            description: "יוצר ומעדכן משימות" },
  { id: "whatsapp-responder",  icon: "💬", name: "מענה WhatsApp",           description: "תבניות תגובה לוואטסאפ" },
  { id: "data-enricher",       icon: "🔍", name: "העשרת נתונים",           description: "משלים פרטים חסרים" },
  { id: "report-generator",    icon: "📈", name: "יצירת דוחות",            description: "דוחות סיכום וניתוח" },
  { id: "email-drafter",       icon: "📧", name: "כתיבת אימיילים",         description: "מנסח אימיילים מקצועיים" },
  { id: "social-planner",      icon: "📱", name: "תכנון סושיאל",           description: "תוכן לרשתות חברתיות" },
  { id: "price-calculator",    icon: "💵", name: "חישוב מחירים",           description: "הצעות מחיר והנחות" },
  { id: "competitor-analyzer", icon: "🔭", name: "ניתוח מתחרים",           description: "מנתח שוק ומתחרים" },
  { id: "sentiment-analyzer",  icon: "🧠", name: "ניתוח סנטימנט",          description: "מזהה טון ורגש" },
  { id: "faq-responder",       icon: "❓", name: "מענה שאלות נפוצות",      description: "לפי בסיס ידע" },
  { id: "upsell-advisor",      icon: "📈", name: "ייעוץ אפסליינג",         description: "הזדמנויות להרחבת עסקאות" },
  { id: "churn-predictor",     icon: "⚠️", name: "זיהוי נטישה",            description: "לקוחות בסיכון נטישה" },
  { id: "campaign-optimizer",  icon: "🎯", name: "אופטימיזציית קמפיינים",  description: "מנתח ומשפר קמפיינים" },
  { id: "smart-summarizer",    icon: "📚", name: "סיכום חכם",              description: "מסכם שיחות ומסמכים" },
  { id: "facebook-account-setup", icon: "📘", name: "חיבור חשבונות פייסבוק", description: "מחבר חשבונות מודעות ללקוחות" },
];

const CARMEN_MODES = [
  { id: "sales",       icon: "💰", name: "מכירות" },
  { id: "support",     icon: "🌟", name: "שירות לקוחות" },
  { id: "copywriting", icon: "✏️", name: "קופיראיטינג" },
  { id: "analyst",     icon: "📊", name: "ניתוח נתונים" },
  { id: "scheduler",   icon: "📅", name: "ניהול לוח זמנים" },
  { id: "onboarding",  icon: "🚀", name: "קליטת לקוחות" },
];

// ─── Cron presets ──────────────────────────────────────────────────────────────
const CRON_PRESETS = [
  { label: "כל יום ב-07:00",   value: "0 7 * * *" },
  { label: "כל יום ב-09:00",   value: "0 9 * * *" },
  { label: "כל יום ב-12:00",   value: "0 12 * * *" },
  { label: "כל יום ב-18:00",   value: "0 18 * * *" },
  { label: "כל ראשון ב-08:00", value: "0 8 * * 1" },
  { label: "כל שישי ב-14:00",  value: "0 14 * * 5" },
  { label: "כל שעה",            value: "0 * * * *" },
  { label: "כל 6 שעות",         value: "0 */6 * * *" },
  { label: "מותאם אישית...",    value: "custom" },
];

function describeCron(expr: string): string {
  const p = CRON_PRESETS.find(x => x.value === expr);
  if (p && p.value !== "custom") return p.label;
  return `Cron: ${expr}`;
}

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: "ממתין",  color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <Clock className="h-3.5 w-3.5" /> },
  running:   { label: "רץ",     color: "bg-blue-100 text-blue-800 border-blue-200",       icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  completed: { label: "הושלם", color: "bg-green-100 text-green-800 border-green-200",    icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  failed:    { label: "נכשל",  color: "bg-red-100 text-red-800 border-red-200",          icon: <XCircle className="h-3.5 w-3.5" /> },
  scheduled: { label: "מתוזמן", color: "bg-purple-100 text-purple-800 border-purple-200", icon: <Timer className="h-3.5 w-3.5" /> },
};

// ─── TaskResultDisplay ─────────────────────────────────────────────────────────
function TaskResultDisplay({ result }: { result: any }) {
  const toolLog = result?.tool_log || [];
  const output = result?.output || "";
  const images: string[] = [];
  const socialPosts: any[] = [];
  for (const log of toolLog) {
    if (log.tool === "generate_ad_image" && log.result?.image_url) images.push(log.result.image_url);
    if (log.tool === "create_social_post" && log.result?.success) socialPosts.push(log.result);
  }
  const hasVisualContent = images.length > 0 || socialPosts.length > 0;
  return (
    <div className="mt-3 space-y-3">
      {images.length > 0 && (
        <div className="space-y-2">
          {images.map((url, i) => (
            <div key={i} className="rounded-xl overflow-hidden border shadow-sm">
              <img src={url} alt="תמונה שנוצרה" className="w-full max-h-64 object-cover" />
              <div className="p-2 bg-muted/30 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Image className="h-3 w-3" /> נוצר ע״י AI</span>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary flex items-center gap-1 hover:underline">פתח <ExternalLink className="h-3 w-3" /></a>
              </div>
            </div>
          ))}
        </div>
      )}
      {socialPosts.length > 0 && (
        <div className="space-y-2">
          {socialPosts.map((post, i) => (
            <div key={i} className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-800">פוסט נוצר במודול סושיאל</span>
                </div>
                <a href={`/t/marketingcaptain/social-media`} className="text-xs text-primary hover:underline flex items-center gap-1">צפה בפוסטים <ExternalLink className="h-3 w-3" /></a>
              </div>
              {post.title && <p className="text-sm font-semibold text-emerald-900 mb-1">{post.title}</p>}
              <p className="text-xs text-emerald-800 whitespace-pre-wrap line-clamp-4">{post.content}</p>
            </div>
          ))}
        </div>
      )}
      {output && (
        <div className={`p-3 rounded-xl text-xs whitespace-pre-wrap ${hasVisualContent ? "bg-muted/40 text-foreground" : "bg-green-50 text-green-900"}`}>
          <div className="prose prose-xs prose-green max-w-none">
            <ReactMarkdown>{output}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ParallelSubtaskEditor ─────────────────────────────────────────────────────
function ParallelSubtaskEditor({
  subtasks,
  onChange,
}: {
  subtasks: { title: string; description: string }[];
  onChange: (s: { title: string; description: string }[]) => void;
}) {
  const add = () => onChange([...subtasks, { title: "", description: "" }]);
  const remove = (i: number) => onChange(subtasks.filter((_, idx) => idx !== i));
  const update = (i: number, field: "title" | "description", val: string) =>
    onChange(subtasks.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)));
  return (
    <div className="space-y-2">
      {subtasks.map((s, i) => (
        <div key={i} className="border rounded-lg p-3 bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">תת-משימה {i + 1}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(i)}>
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          </div>
          <Input placeholder="כותרת תת-משימה" value={s.title} onChange={e => update(i, "title", e.target.value)} className="h-7 text-xs" />
          <Input placeholder="תיאור (אופציונלי)" value={s.description} onChange={e => update(i, "description", e.target.value)} className="h-7 text-xs" />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1 text-xs" onClick={add}>
        <Plus className="h-3 w-3" /> הוסף תת-משימה
      </Button>
    </div>
  );
}

// ─── SkillPicker ───────────────────────────────────────────────────────────────
function SkillPicker({ selected, onChange }: { selected: string[]; onChange: (s: string[]) => void }) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  return (
    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
      {BUILT_IN_SKILLS.map(skill => (
        <button
          key={skill.id}
          type="button"
          onClick={() => toggle(skill.id)}
          className={`flex items-center gap-2 p-2 rounded-lg border text-xs text-right transition-all ${
            selected.includes(skill.id)
              ? "border-[#36d399] bg-[#36d399]/10 text-foreground"
              : "border-border bg-background text-muted-foreground hover:border-[#36d399]/50"
          }`}
        >
          <span className="text-base shrink-0">{skill.icon}</span>
          <span className="truncate font-medium">{skill.name}</span>
        </button>
      ))}
    </div>
  );
}

// ─── TaskCard ──────────────────────────────────────────────────────────────────
function TaskCard({
  task,
  avatarFor,
  onRun,
  onDelete,
  onToggleEnabled,
  onEdit,
  onRerun,
  isRunning,
}: {
  task: any;
  avatarFor: (name: string) => string;
  onRun: (task: any) => void;
  onDelete: (id: string) => void;
  onToggleEnabled: (task: any) => void;
  onEdit: (task: any) => void;
  onRerun: (task: any) => void;
  isRunning: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const agentName = task.ai_agents?.name || "—";
  const isRecurring = task.schedule_type === "recurring";
  const isScheduled = task.schedule_type === "scheduled";
  const taskSkills = (task.task_skills || []) as string[];
  const skillNames = taskSkills
    .map((id: string) => BUILT_IN_SKILLS.find(s => s.id === id))
    .filter(Boolean)
    .map((s: any) => `${s.icon} ${s.name}`);
  const taskMode = CARMEN_MODES.find(m => m.id === task.task_mode);

  return (
    <div className={`bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow ${!task.enabled && isRecurring ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <img src={avatarFor(agentName)} className="w-9 h-9 rounded-lg object-cover shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">{task.title}</h3>
              {isRecurring && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-purple-50 text-purple-700 border-purple-200">
                  <Repeat className="h-2.5 w-2.5" /> חוזר
                </Badge>
              )}
              {isScheduled && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-blue-50 text-blue-700 border-blue-200">
                  <Calendar className="h-2.5 w-2.5" /> מתוזמן
                </Badge>
              )}
              {task.parallel_execution && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-orange-50 text-orange-700 border-orange-200">
                  <GitFork className="h-2.5 w-2.5" /> מקבילי
                </Badge>
              )}
              {task.assigned_agent && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-violet-50 text-violet-700 border-violet-200">
                  <Bot className="h-2.5 w-2.5" /> כרמן עובדת
                </Badge>
              )}
            </div>
            {task.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
            )}
            {isRecurring && task.cron_expression && (
              <div className="flex items-center gap-1 mt-1 text-[11px] text-purple-600">
                <Repeat className="h-3 w-3" />
                <span>{describeCron(task.cron_expression)}</span>
                {task.last_run && (
                  <span className="text-muted-foreground">· הרצה אחרונה: {format(new Date(task.last_run), "dd/MM HH:mm")}</span>
                )}
              </div>
            )}
            {isScheduled && task.scheduled_at && (
              <div className="flex items-center gap-1 mt-1 text-[11px] text-blue-600">
                <Calendar className="h-3 w-3" />
                <span>{format(new Date(task.scheduled_at), "dd/MM/yyyy HH:mm")}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-1 mt-2">
              {taskMode && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5">
                  {taskMode.icon} {taskMode.name}
                </span>
              )}
              {skillNames.slice(0, 3).map((s: string, i: number) => (
                <span key={i} className="inline-flex items-center text-[10px] bg-[#36d399]/10 text-[#1a9e6e] border border-[#36d399]/30 rounded-full px-2 py-0.5">
                  {s}
                </span>
              ))}
              {skillNames.length > 3 && (
                <span className="inline-flex items-center text-[10px] bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                  +{skillNames.length - 3}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>{agentName}</span>
              <span>·</span>
              <span>{format(new Date(task.created_at), "dd/MM HH:mm")}</span>
              {task.run_count > 0 && <><span>·</span><span>הורץ {task.run_count} פעמים</span></>}
              {task.completed_at && <><span>·</span><span>הסתיים {format(new Date(task.completed_at), "HH:mm")}</span></>}
            </div>
            {task.status === "completed" && task.result && (
              <div>
                <button
                  className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
                  onClick={() => setExpanded(e => !e)}
                >
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {expanded ? "הסתר תוצאה" : "הצג תוצאה"}
                </button>
                {expanded && <TaskResultDisplay result={task.result} />}
              </div>
            )}
            {task.status === "failed" && task.result?.error && (
              <div className="mt-2 p-2 bg-red-50 rounded-lg text-xs text-red-900">{task.result.error}</div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Badge variant="outline" className={`${status.color} text-xs gap-1`}>
            {status.icon}
            {status.label}
          </Badge>
          <div className="flex items-center gap-1">
            {isRecurring && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onToggleEnabled(task)}
                      className={`p-1 rounded transition-colors ${task.enabled ? "text-green-600 hover:text-green-700" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {task.enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{task.enabled ? "השבת משימה" : "הפעל משימה"}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {(task.status === "pending" || isRecurring) && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-7 text-xs"
                onClick={() => onRun(task)}
                disabled={isRunning}
              >
                {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                הרץ
              </Button>
            )}
            {(task.status === "completed" || task.status === "failed") && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-7 text-xs"
                  onClick={() => onEdit(task)}
                >
                  <Pencil className="h-3 w-3" />
                  ערוך
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-7 text-xs"
                  onClick={() => onRerun(task)}
                  disabled={isRunning}
                >
                  {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                  הרץ שוב
                </Button>
              </>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-red-500"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Default form ──────────────────────────────────────────────────────────────
const defaultForm = {
  title: "",
  description: "",
  agent_id: "",
  priority: 5,
  schedule_type: "once" as "once" | "scheduled" | "recurring",
  cron_preset: "0 7 * * *",
  custom_cron: "",
  task_skills: [] as string[],
  task_mode: "",
  parallel_execution: false,
  parallel_subtasks: [] as { title: string; description: string }[],
  scheduled_at: "",
};

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function AgentTasksPage() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [form, setForm] = useState({ ...defaultForm });
  const [activeTab, setActiveTab] = useState("tasks");

  // Heartbeat settings
  const { data: heartbeatSettings } = useQuery({
    queryKey: ["heartbeat_settings", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenant_heartbeat_settings")
        .select("*")
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  // Heartbeat logs
  const { data: heartbeatLogs = [] } = useQuery({
    queryKey: ["heartbeat_logs", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("heartbeat_logs")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("triggered_at", { ascending: false })
        .limit(10);
      return (data as any[]) || [];
    },
    enabled: !!tenantId && activeTab === "heartbeat",
  });




  const saveHeartbeatSettings = useMutation({
    mutationFn: async (settings: { enabled: boolean; interval_hours: number; active_hours_start: number; active_hours_end: number; allowed_actions: string[] }) => {
      const { error } = await supabase
        .from("tenant_heartbeat_settings")
        .upsert({ tenant_id: tenantId!, ...settings, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["heartbeat_settings"] });
      toast.success("הגדרות Heartbeat נשמרו");
    },
    onError: () => toast.error("שגיאה בשמירת הגדרות"),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["ai_agents", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("ai_agents").select("*").eq("tenant_id", tenantId!).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["agent_tasks", tenantId, filterAgent, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("agent_tasks")
        .select("*, ai_agents(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (filterAgent !== "all") query = query.eq("agent_id", filterAgent);
      if (filterStatus !== "all") query = query.eq("status", filterStatus);
      const { data } = await query;
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
    refetchInterval: 5000,
  });

  const createTask = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const cronExpr =
        form.schedule_type === "recurring"
          ? form.cron_preset === "custom"
            ? form.custom_cron
            : form.cron_preset
          : null;
      const scheduledAt =
        form.schedule_type === "scheduled" && form.scheduled_at
          ? new Date(form.scheduled_at).toISOString()
          : null;
      const { error } = await supabase.from("agent_tasks").insert({
        tenant_id: tenantId!,
        agent_id: form.agent_id,
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        created_by: user?.id,
        status: form.schedule_type === "once" ? "pending" : "scheduled",
        schedule_type: form.schedule_type,
        cron_expression: cronExpr,
        task_skills: form.task_skills,
        task_mode: form.task_mode || null,
        parallel_execution: form.parallel_execution,
        parallel_subtasks:
          form.parallel_execution && form.parallel_subtasks.length > 0
            ? form.parallel_subtasks
            : null,
        enabled: true,
        scheduled_at: scheduledAt,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_tasks"] });
      setDialogOpen(false);
      setForm({ ...defaultForm });
      toast.success("משימה נוצרה בהצלחה");
    },
    onError: (e: any) => toast.error("שגיאה ביצירת משימה: " + e.message),
  });

  const runTask = useMutation({
    mutationFn: async (task: any) => {
      await supabase
        .from("agent_tasks")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", task.id);

      const taskSkills = (task.task_skills || []) as string[];
      const skillNames = taskSkills
        .map((id: string) => BUILT_IN_SKILLS.find(s => s.id === id)?.name)
        .filter(Boolean)
        .join(", ");
      const commandText = [
        task.title,
        task.description || "",
        skillNames ? `\n[סקילז פעילים: ${skillNames}]` : "",
        task.task_mode
          ? `\n[מוד: ${CARMEN_MODES.find(m => m.id === task.task_mode)?.name || task.task_mode}]`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      if (task.parallel_execution && task.parallel_subtasks?.length > 0) {
        const results = await Promise.all(
          task.parallel_subtasks.map(async (sub: any) => {
            const { data } = await supabase.functions.invoke("run-ai-agent", {
              body: {
                agent_id: task.agent_id,
                command_text: `=== משימה ראשית ===\n${task.title}\n${task.description || ""}\n\n=== תת-משימה נוכחית ===\n${sub.title}\n${sub.description || ""}`,
                tenant_id: tenantId,
                task_skills: task.task_skills,
                task_mode: task.task_mode,
              },
            });
            return { subtask: sub.title, result: data };
          })
        );
        await supabase
          .from("agent_tasks")
          .update({
            status: "completed",
            result: {
              output: results
                .map(r => `**${r.subtask}**\n${r.result?.output || ""}`)
                .join("\n\n"),
              parallel_results: results,
            },
            completed_at: new Date().toISOString(),
            last_run: new Date().toISOString(),
            run_count: (task.run_count || 0) + 1,
          })
          .eq("id", task.id);
        return results;
      }

      const { data, error } = await supabase.functions.invoke("run-ai-agent", {
        body: {
          agent_id: task.agent_id,
          command_text: commandText,
          tenant_id: tenantId,
          task_skills: task.task_skills,
          task_mode: task.task_mode,
        },
      });
      if (error) throw error;
      await supabase
        .from("agent_tasks")
        .update({
          status: data?.success ? "completed" : "failed",
          result: data,
          completed_at: new Date().toISOString(),
          last_run: new Date().toISOString(),
          run_count: (task.run_count || 0) + 1,
        })
        .eq("id", task.id);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_tasks"] });
      toast.success("המשימה הושלמה");
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ["agent_tasks"] });
      toast.error("שגיאה בהרצת המשימה: " + err.message);
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agent_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_tasks"] });
      toast.success("משימה נמחקה");
    },
    onError: () => toast.error("שגיאה במחיקת משימה"),
  });

  const toggleEnabled = useMutation({
    mutationFn: async (task: any) => {
      const newStatus = task.status === 'active' ? 'paused' : 'active';
      const { error } = await supabase
        .from("agent_tasks")
        .update({ status: newStatus })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent_tasks"] }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from("agent_tasks").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_tasks"] });
      setEditingTask(null);
      toast.success("המשימה עודכנה");
    },
    onError: () => toast.error("שגיאה בעדכון המשימה"),
  });

  const handleEdit = (task: any) => {
    setEditingTask(task);
  };

  const handleRerun = async (task: any) => {
    const { error } = await supabase.from("agent_tasks")
      .update({ status: "pending", result: null, completed_at: null, started_at: null })
      .eq("id", task.id);
    if (error) {
      toast.error("שגיאה באיפוס המשימה");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["agent_tasks"] });
    runTask.mutate({ ...task, status: "pending" });
  };

  const agentStats = agents.map(agent => {
    const agentTasks = tasks.filter(t => t.agent_id === agent.id);
    return {
      ...agent,
      total: agentTasks.length,
      completed: agentTasks.filter(t => t.status === "completed").length,
      failed: agentTasks.filter(t => t.status === "failed").length,
      running: agentTasks.filter(t => t.status === "running").length,
      recurring: agentTasks.filter(t => t.schedule_type === "recurring").length,
    };
  });

  const avatarFor = (name: string) => AGENT_AVATARS[name] || DEFAULT_AVATAR;
  const recurringTasks = tasks.filter(t => t.schedule_type === "recurring");

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(buildPath("agents"))}>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">ניהול משימות סוכנים</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 bg-[#36d399] hover:bg-[#2fbf87] text-black">
          <Plus className="h-4 w-4" />
          משימה חדשה
        </Button>
      </div>



            {/* Cron */}
            {form.schedule_type === "recurring" && (
              <div className="space-y-3 border rounded-xl p-4 bg-purple-50/50">
                <div className="flex items-center gap-2 mb-1">
                  <Repeat className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-semibold text-purple-800">הגדרת תדירות</span>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">בחר תדירות</Label>
                  <Select
                    value={form.cron_preset}
                    onValueChange={v => setForm(f => ({ ...f, cron_preset: v }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CRON_PRESETS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.cron_preset === "custom" && (
                  <div>
                    <Label className="text-xs text-muted-foreground">ביטוי Cron מותאם</Label>
                    <Input
                      className="mt-1 font-mono text-sm"
                      value={form.custom_cron}
                      onChange={e => setForm(f => ({ ...f, custom_cron: e.target.value }))}
                      placeholder="0 7 * * * (כל יום ב-07:00)"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">פורמט: דקות שעות יום-בחודש חודש יום-בשבוע</p>
                  </div>
                )}
              </div>
            )}

            {/* Parallel execution */}
            <div className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <GitFork className="h-4 w-4 text-orange-500" />
                    ביצוע מקבילי
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">פצל את המשימה לתת-משימות שירוצו במקביל</p>
                </div>
                <Switch
                  checked={form.parallel_execution}
                  onCheckedChange={v => setForm(f => ({ ...f, parallel_execution: v }))}
                />
              </div>
              {form.parallel_execution && (
                <ParallelSubtaskEditor
                  subtasks={form.parallel_subtasks}
                  onChange={s => setForm(f => ({ ...f, parallel_subtasks: s }))}
                />
              )}
            </div>

            {/* Priority */}
            <div>
              <Label className="text-sm font-semibold">עדיפות (1-10)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                className="mt-1 w-24"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 5 }))}
              />
            </div>

            {/* Submit */}
            <Button
              className="w-full bg-[#36d399] hover:bg-[#2fbf87] text-black font-semibold"
              disabled={!form.agent_id || !form.title || createTask.isPending}
              onClick={() => createTask.mutate()}
            >
              {createTask.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-1" />
                  {form.schedule_type === "once"
                    ? "צור משימה"
                    : form.schedule_type === "recurring"
                    ? "צור משימה חוזרת"
                    : "תזמן משימה"}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת משימה</DialogTitle>
          </DialogHeader>
          {editingTask && (
            <div className="space-y-4">
              <div>
                <Label>כותרת</Label>
                <Input
                  value={editingTask.title}
                  onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
                />
              </div>
              <div>
                <Label>תיאור</Label>
                <Textarea
                  value={editingTask.description || ""}
                  onChange={e => setEditingTask({ ...editingTask, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label>עדיפות (1-10)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={editingTask.priority}
                  onChange={e => setEditingTask({ ...editingTask, priority: Number(e.target.value) })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingTask(null)}>ביטול</Button>
                <Button
                  onClick={() => updateTask.mutate({
                    id: editingTask.id,
                    updates: {
                      title: editingTask.title,
                      description: editingTask.description,
                      priority: editingTask.priority,
                    },
                  })}
                  disabled={updateTask.isPending}
                >
                  {updateTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "שמור"}
                </Button>
                <Button
                  variant="default"
                  className="gap-1"
                  onClick={() => {
                    updateTask.mutate({
                      id: editingTask.id,
                      updates: {
                        title: editingTask.title,
                        description: editingTask.description,
                        priority: editingTask.priority,
                      },
                    }, {
                      onSuccess: () => handleRerun(editingTask),
                    });
                  }}
                  disabled={updateTask.isPending}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  שמור והרץ שוב
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

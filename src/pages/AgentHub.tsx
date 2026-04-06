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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Bot, Zap, Brain, Heart, Sparkles, ChevronDown, ChevronUp, PenLine, Settings, Eye, Edit3, Shield, Send, Users, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { toast } from "sonner";

import agentGeneral from "@/assets/agents/agent-general.png";
import agentCreative from "@/assets/agents/agent-creative.png";
import agentCeo from "@/assets/agents/agent-ceo.png";
import agentSeo from "@/assets/agents/agent-seo.png";
import agentGithub from "@/assets/agents/agent-github.png";

const CARMEN_AVATAR = "https://d2xsxph8kpxj0f.cloudfront.net/310419663030948028/XGJWpzb5zh76ZdoV37Q3K8/carmen-agents-avatar_17945787.png";

const AGENT_AVATARS: Record<string, string> = {
  "סוכן כללי": agentGeneral,
  "סוכן קריאייטיב": agentCreative,
  "ceo": agentCeo,
  "CEO": agentCeo,
  "SEO": agentSeo,
  "seo": agentSeo,
};
const DEFAULT_AVATAR = agentGeneral;

const ALL_TOOLS = [
  { name: "create_lead", label: "יצירת ליד", group: "לידים" },
  { name: "list_leads", label: "צפייה בלידים", group: "לידים" },
  { name: "update_lead_status", label: "עדכון סטטוס ליד", group: "לידים" },
  { name: "add_lead_update", label: "הוספת עדכון לליד", group: "לידים" },
  { name: "create_task", label: "יצירת משימה", group: "משימות" },
  { name: "list_tasks", label: "צפייה במשימות", group: "משימות" },
  { name: "update_task_status", label: "עדכון סטטוס משימה", group: "משימות" },
  { name: "list_clients", label: "צפייה בלקוחות", group: "לקוחות" },
  { name: "get_client_info", label: "מידע על לקוח", group: "לקוחות" },
  { name: "add_client_update", label: "הוספת עדכון ללקוח", group: "לקוחות" },
  { name: "send_message", label: "שליחת WhatsApp", group: "תקשורת" },
  { name: "search_entities", label: "חיפוש", group: "כללי" },
  { name: "create_social_post", label: "יצירת פוסט סושיאל", group: "סושיאל" },
  { name: "generate_ad_image", label: "יצירת תמונה למודעה (AI)", group: "סושיאל" },
  { name: "delegate_to_manus", label: "האצלת משימה ל-Manus AI", group: "AI" },
  { name: "get_facebook_campaign_data", label: "נתוני קמפיינים פייסבוק", group: "AI" },
  { name: "manage_agents", label: "ניהול סוכנים", group: "ניהול" },
  { name: "create_agent", label: "יצירת סוכן חדש", group: "ניהול" },
  { name: "assign_task_to_agent", label: "הקצאת משימה לסוכן", group: "ניהול" },
];

const TOOL_GROUPS = ["לידים", "משימות", "לקוחות", "תקשורת", "סושיאל", "AI", "ניהול", "כללי"];

// Module access definitions for Carmen
const MODULE_PERMISSIONS = [
  { key: "leads", label: "לידים", icon: "🎯" },
  { key: "clients", label: "לקוחות", icon: "👥" },
  { key: "tasks", label: "משימות", icon: "✅" },
  { key: "sales_dashboard", label: "דשבורד מכירות", icon: "📊" },
  { key: "sales_people", label: "אנשי מכירות", icon: "💼" },
  { key: "campaigners", label: "קמפיינרים", icon: "📣" },
  { key: "social_media", label: "ניהול סושיאל", icon: "📱" },
  { key: "reports", label: "דוחות", icon: "📈" },
  { key: "dynamic_tables", label: "דשבורדים", icon: "🗂️" },
  { key: "chat", label: "צ'אט", icon: "💬" },
  { key: "gmail", label: "Gmail", icon: "📧" },
  { key: "automations", label: "אוטומציות", icon: "⚡" },
  { key: "agents", label: "סוכני AI", icon: "🤖" },
  { key: "users", label: "משתמשים", icon: "👤" },
  { key: "agencies", label: "סוכנויות", icon: "🏢" },
  { key: "tenants", label: "ארגונים", icon: "🏛️" },
  { key: "suppliers", label: "ספקים", icon: "🚚" },
  { key: "integrations", label: "אינטגרציות", icon: "🔌" },
];

const ENGINES = [
  { value: "manus-1.6", label: "Manus 1.6 (ברירת מחדל)", badge: "🧠 Manus", recommended: true },
  { value: "manus-1.6-max", label: "Manus 1.6 Max (עוצמתי)", badge: "🧠 Manus" },
  { value: "manus-1.6-lite", label: "Manus 1.6 Lite (מהיר)", badge: "🧠 Manus" },
  { value: "claude-sonnet", label: "Claude Sonnet 4", badge: "🟠 Anthropic" },
  { value: "gemini-3-pro", label: "Gemini 3 Pro", badge: "🔵 Google" },
  { value: "gemini-3-flash", label: "Gemini 3 Flash (מהיר)", badge: "🔵 Google" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", badge: "🔵 Google" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", badge: "🔵 Google" },
  { value: "gpt-5", label: "GPT-5", badge: "🟢 OpenAI" },
  { value: "gpt-5-mini", label: "GPT-5 Mini (מהיר)", badge: "🟢 OpenAI" },
];

interface Agent {
  id: string;
  name: string;
  description?: string;
  personality?: string;
  soul?: string;
  talent?: string;
  engine: string;
  active: boolean;
  allowed_tools?: string[];
  created_at: string;
}

interface AgentFormData {
  name: string;
  description: string;
  personality: string;
  soul: string;
  talent: string;
  engine: string;
  active: boolean;
  allowed_tools: string[];
  avatar: string;
}

const defaultForm: AgentFormData = {
  name: "",
  description: "",
  personality: "",
  soul: "",
  talent: "",
  engine: "gemini-3-flash",
  active: true,
  allowed_tools: [],
  avatar: "🤖",
};

// Carmen's default module access (all modules, edit level)
const CARMEN_MODES = [
  {
    id: 'sales',
    icon: '💰',
    name: 'מכירות',
    description: 'מתמקדת בהבשלת לידים, סגירת עסקאות ומעקב פיפלאינ',
    prompt: 'את מומחית מכירות. את מזהה הזדמנויות בלידים, מעקבת אחרי פיפלאיים, מסייעת בסגירת עסקאות ויוצרת הצעות מותאמות אישית. תמיד תשאלי שאלות בירור לפני שתיצרי פעולות.',
  },
  {
    id: 'support',
    icon: '🌟',
    name: 'שירות לקוחות',
    description: 'מתמקדת בפתרון בעיות, אמפתיה ושיפור חוויית לקוח',
    prompt: 'את מומחית שירות לקוחות. את אמפתית, סבלנית ופותרת בעיות. תמיד תוודאי שהלקוח הבין את הפתרון לפני שתסגרי את השיחה. תיעדי ביצירת משימות מעקב לאחר כל פנייה.',
  },
  {
    id: 'copywriting',
    icon: '✏️',
    name: 'קופיראיטינג',
    description: 'כתיבת תוכן, פוסטים והודעות שיווק משכנעות',
    prompt: 'את מומחית קופיראיטינג. את כותבת בצורה משכנעת, יצירתית ומותאמת לקהל יעד. תמיד תשאלי על הטון, הפלטפורמה וקהל היעד לפני שתתחילי לכתוב.',
  },
  {
    id: 'analyst',
    icon: '📊',
    name: 'ניתוח נתונים',
    description: 'מנתחת נתונים, דוחות ותובנות עסקיות',
    prompt: 'את מנתחת נתונים. את שולפת נתונים מהמערכת, מזהה דפוסים ומסיקה תובנות עסקיות ברורות. תמיד תציגי נתונים בצורה מסודרת וברורה.',
  },
  {
    id: 'scheduler',
    icon: '📅',
    name: 'ניהול לוח זמנים',
    description: 'תיאום פגישות, תזכורות ומשימות זמניות',
    prompt: 'את מומחית ניהול לוח זמנים. את מתאמת פגישות, יוצרת תזכורות ומנהלת משימות זמניות בצורה יעילה. תמיד תאשרי פרטי תאריך ושעה לפני שתיצרי אירוע.',
  },
  {
    id: 'onboarding',
    icon: '🚀',
    name: 'קליטת לקוחות',
    description: 'מדריכה לקוחות חדשים בתהליך הקליטה',
    prompt: 'את מומחית קליטת לקוחות. את מדריכה לקוחות חדשים בצורה חמה ומקצועית, מודיעה אותם על המערכת ומסייעת בהגדרת הפרופיל שלהם. תמיד תיצרי תהליך קליטה מובנה ללקוחות חדשים.',
  },
];

const BUILT_IN_SKILLS = [
  { id: 'lead-qualifier', icon: '🎯', name: 'הסמכת לידים', description: 'מדרג אוטומטי של לידים לפי פרמטרים', prompt: 'כשמתבקשת להעריך ליד, תשאלי על תקציב, גודל עסק, צורך ולוח זמנים. דרגי 0-10 וספקי הסבר.' },
  { id: 'follow-up', icon: '🔄', name: 'פולואפ אוטומטי', description: 'יוצר הודעות מעקב בזמנים הנכונים', prompt: 'כשמתבקשת לעקוב אחרי ליד או לקוח, צרי משימות מעקב בזמנים אסטרטגיים (3 ימים, שבוע, חודש).' },
  { id: 'proposal-writer', icon: '📝', name: 'כתיבת הצעות', description: 'יוצר הצעות מותאמות אישית', prompt: 'כשמתבקשת לכתוב הצעה, שאלי על צרכי הלקוח, תקציב ודדליין. צרי הצעה מותאמת אישית עם הדגשת הערך ללקוח.' },
  { id: 'meeting-prep', icon: '🤝', name: 'הכנה לפגישות', description: 'מכין סיכום פגישה ונקודות דיון', prompt: 'לפני פגישה, שלוף את היסטוריית הלקוח/ליד, הצע נקודות דיון ושאלות רלוונטיות.' },
  { id: 'objection-handler', icon: '🛡️', name: 'טיפול בהתנגדויות', description: 'עונה להתנגדויות בצורה משכנעת', prompt: 'כשלקוח מתנגד, הביני את החשש האמיתי מאחוריו ועני בצורה אמפתית ומשכנעת. אל תוויתרי אותומטית במחיר.' },
  { id: 'task-manager', icon: '✅', name: 'ניהול משימות', description: 'יוצר ומעדכן משימות באופן אוטומטי', prompt: 'כשמתבקשת לנהל משימות, תמיד חפשי קודם אם המשימה קיימת. צרי משימות עם תאריך יעד ושייוך לאדם הנכון.' },
  { id: 'whatsapp-responder', icon: '💬', name: 'מענה WhatsApp', description: 'מנסח תבניות תגובה לוואטסאפ', prompt: 'כשעונה להודעות WhatsApp, כתוב בסגנון קצר, ישיר וחברותי. הימנע מטקסט ארוך מדי.' },
  { id: 'data-enricher', icon: '🔍', name: 'העשרת נתונים', description: 'משלים פרטים חסרים על לידים ולקוחות', prompt: 'כשנתקלת על ליד/לקוח עם פרטים חסרים, שאלי שאלות משלימות באופן טבעי ועדכני את הפרופיל.' },
  { id: 'report-generator', icon: '📈', name: 'יצירת דוחות', description: 'יוצר דוחות סיכום וניתוח', prompt: 'כשמתבקשת דוח, שלוף נתונים מהמערכת, זהה דפוסים והצג תובנות ברורות עם מסקנות עסקיות.' },
  { id: 'email-drafter', icon: '📧', name: 'כתיבת אימיילים', description: 'מנסח אימיילים מקצועיים', prompt: 'כשמתבקשת לכתוב אימייל, שאלי על הנמען, הטון והמטרה. צרי אימייל מקצועי עם שורת נושא משכנעת.' },
  { id: 'social-planner', icon: '📱', name: 'תכנון סושיאל', description: 'מתכנן תוכן לרשתות חברתיות', prompt: 'כשמתבקשת תוכן לסושיאל, שאלי על הפלטפורמה, קהל היעד והמסר. צרי תוכן משכנע עם השתמש בסיפור וקריאה לפעולה.' },
  { id: 'price-calculator', icon: '💵', name: 'חישוב מחירים', description: 'מחשב הצעות מחיר והנחות', prompt: 'כשמתבקשת מחיר, שאלי על השירות/מוצר, כמות ופרטי לקוח. הצג מחיר סופי עם פירוט ואפשרות הנחה.' },
  { id: 'competitor-analyzer', icon: '🔭', name: 'ניתוח מתחרים', description: 'מנתח שוק ומתחרים', prompt: 'כשמתבקשת ניתוח מתחרים, שלוף נתונים מהמערכת, זהה דפוסים והצג השוואה מול מתחרים.' },
  { id: 'sentiment-analyzer', icon: '🧠', name: 'ניתוח סנטימנט', description: 'מזהה טון ורגש בהודעות', prompt: 'בכל הודעה שמקבלת, נתחי את הטון הרגשי (חיובי/שלילי/נייטרלי) והתאם את התגובה בהתאם.' },
  { id: 'faq-responder', icon: '❓', name: 'מענה שאלות נפוצות', description: 'עונה לשאלות נפוצות לפי בסיס ידע', prompt: 'כשעונה לשאלות, שלוף קודם את הנתונים הקיימים במערכת וענה לפי המידע הקיים.' },
  { id: 'upsell-advisor', icon: '📈', name: 'ייעוץ אפסליינג', description: 'מזהה הזדמנויות להרחבת עסקאות', prompt: 'כשמתבקשת לנתח לקוח, זהה הזדמנויות לאפסליינג וקרוס-סלינג לפי היסטוריית הקניות.' },
  { id: 'churn-predictor', icon: '⚠️', name: 'זיהוי נטישה', description: 'מזהה לקוחות בסיכון נטישה', prompt: 'נתח את דפוסי הלקוחות וזהה סימני אזהרה לנטישה פוטנציאלית. הצע פעולות שימור מתאימות.' },
  { id: 'campaign-optimizer', icon: '🎯', name: 'אופטימיזציית קמפיינים', description: 'מנתח ומשפר קמפייני פרסום', prompt: 'נתח נתוני קמפיינים מהמערכת, זהה מה עובד ומה לא, והצע שיפורים קונקרטיים.' },
  { id: 'smart-summarizer', icon: '📚', name: 'סיכום חכם', description: 'מסכם שיחות, מסמכים ונתונים', prompt: 'כשמתבקשת סיכום, שלוף את כל המידע הרלוונטי והצג את העיקריות בצורה קצרה וברורה.' },
];

const DEFAULT_CARMEN_ACCESS: Record<string, "none" | "view" | "edit"> = Object.fromEntries(
  MODULE_PERMISSIONS.map(m => [m.key, "edit"])
);

export default function AgentHub() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [form, setForm] = useState<AgentFormData>(defaultForm);
  const [showInactive, setShowInactive] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [carmenDialogOpen, setCarmenDialogOpen] = useState(false);
  const [carmenAccess, setCarmenAccess] = useState<Record<string, "none" | "view" | "edit">>(DEFAULT_CARMEN_ACCESS);
  const [carmenEngine, setCarmenEngine] = useState("manus-1.6");
  const [carmenSystemPrompt, setCarmenSystemPrompt] = useState("");
  const [carmenWritingStyle, setCarmenWritingStyle] = useState("professional");
  const [carmenResponseLength, setCarmenResponseLength] = useState("medium");
  const [carmenLanguage, setCarmenLanguage] = useState("he");
  const [carmenTask, setCarmenTask] = useState("");
  const [carmenTaskDialogOpen, setCarmenTaskDialogOpen] = useState(false);
  const [carmenSaving, setCarmenSaving] = useState(false);
  const [sendingTask, setSendingTask] = useState(false);
  const [carmenActiveModes, setCarmenActiveModes] = useState<string[]>([]);
  const [carmenActiveSkills, setCarmenActiveSkills] = useState<string[]>([]);
  const [deleteConfirmAgent, setDeleteConfirmAgent] = useState<Agent | null>(null);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["ai_agents", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Agent[];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: AgentFormData) => {
      const payload = {
        name: data.name,
        description: data.description,
        personality: data.personality,
        soul: data.soul,
        talent: data.talent,
        engine: data.engine,
        active: data.active,
        allowed_tools: data.allowed_tools,
        tenant_id: tenantId,
      };
      if (editingAgent) {
        const { error } = await supabase.from("ai_agents").update(payload).eq("id", editingAgent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ai_agents").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_agents"] });
      setDialogOpen(false);
      toast.success(editingAgent ? "הסוכן עודכן" : "הסוכן נוצר");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_agents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_agents"] });
      setDialogOpen(false);
      toast.success("הסוכן נמחק");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("ai_agents").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai_agents"] }),
  });

  const openNew = () => {
    setEditingAgent(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setForm({
      name: agent.name,
      description: agent.description || "",
      personality: agent.personality || "",
      soul: agent.soul || "",
      talent: agent.talent || "",
      engine: agent.engine || "gemini-3-flash",
      active: agent.active,
      allowed_tools: agent.allowed_tools || [],
      avatar: "🤖",
    });
    setDialogOpen(true);
  };

  const toggleTool = (toolName: string) => {
    setForm(prev => ({
      ...prev,
      allowed_tools: prev.allowed_tools.includes(toolName)
        ? prev.allowed_tools.filter(t => t !== toolName)
        : [...prev.allowed_tools, toolName],
    }));
  };

  const toggleAllTools = () => {
    setForm(prev => ({
      ...prev,
      allowed_tools: prev.allowed_tools.length === ALL_TOOLS.length ? [] : ALL_TOOLS.map(t => t.name),
    }));
  };

  const toggleExpandGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const handleSendCarmenTask = async () => {
    if (!carmenTask.trim()) return;
    setSendingTask(true);
    try {
      const { error } = await supabase.functions.invoke("run-ai-agent", {
        body: {
          agentId: "carmen",
          message: carmenTask,
          tenantId,
          engine: carmenEngine,
        },
      });
      if (error) throw error;
      toast.success("המשימה נשלחה לכרמן!");
      setCarmenTask("");
      setCarmenTaskDialogOpen(false);
    } catch (e: any) {
      toast.error("שגיאה בשליחת המשימה: " + e.message);
    } finally {
      setSendingTask(false);
    }
  };

  const activeAgents = agents.filter(a => a.active);
  const inactiveAgents = agents.filter(a => !a.active);

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-7 w-7 text-[#36d399]" />
            סוכני AI
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            כרמן מנהלת את כל הסוכנים — הגדר, הפעל, ותן משימות
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(buildPath("agent-tasks"))} className="gap-2">
            <Zap className="h-4 w-4" />
            ניהול משימות
          </Button>
          <Button onClick={openNew} className="gap-2 bg-[#36d399] hover:bg-[#2fbf87] text-black">
            <Plus className="h-4 w-4" />
            סוכן חדש
          </Button>
        </div>
      </div>

      {/* ─── CARMEN CARD ─────────────────────────────────────────── */}
      <div className="relative mb-10 rounded-2xl overflow-hidden border border-red-500/40 shadow-2xl" style={{background: 'linear-gradient(135deg, #1a0a0a 0%, #2d0f0f 30%, #1a1a2e 100%)'}}>
        {/* Subtle red glow overlay */}
        <div className="absolute inset-0 bg-gradient-to-l from-red-900/30 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-stretch gap-0">
          {/* Avatar section */}
          <div className="relative w-52 shrink-0 hidden md:block">
            <img
              src={CARMEN_AVATAR}
              alt="Carmen"
              className="w-full h-full object-cover object-top"
              style={{ minHeight: "200px", maxHeight: "240px" }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#1a0a0a]/80" />
          </div>

          {/* Content */}
          <div className="flex-1 p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-red-500/30 text-red-300 border-red-400/50 text-xs font-semibold">מנהלת ראשית</Badge>
                  <span className="flex items-center gap-1 text-xs text-emerald-300 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                    פעילה
                  </span>
                </div>
                <h2 className="text-3xl font-bold text-white tracking-wide">כרמן</h2>
                <p className="text-sm text-gray-300 mt-1">עוזרת AI ראשית — מנהלת ומתאמת את כל הסוכנים</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={() => setCarmenDialogOpen(true)}
                >
                  <Settings className="h-3.5 w-3.5" />
                  הגדרות
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 bg-red-500 hover:bg-red-600 text-white"
                  onClick={() => setCarmenTaskDialogOpen(true)}
                >
                  <Send className="h-3.5 w-3.5" />
                  תן משימה
                </Button>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex gap-6 mt-4">
              <div className="text-center">
                <div className="text-xl font-bold text-white">{agents.length + 3}</div>
                <div className="text-xs text-gray-400 mt-0.5">סוכנים תחתיה</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white">{MODULE_PERMISSIONS.length}</div>
                <div className="text-xs text-gray-400 mt-0.5">מודולים בגישה</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white">{ALL_TOOLS.length}</div>
                <div className="text-xs text-gray-400 mt-0.5">כלים זמינים</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-red-300">🧠 Manus 1.6</div>
                <div className="text-xs text-gray-400 mt-0.5">מנוע ברירת מחדל</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── AGENTS GRID ─────────────────────────────────────────── */}
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-[#36d399]" />
        <span className="font-semibold text-sm">סוכנים פעילים</span>
        <Badge variant="secondary" className="text-xs">{activeAgents.length + 3}</Badge>
        <span className="text-xs text-muted-foreground mr-1">תחת ניהול כרמן</span>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">טוען...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {/* Built-in agents */}
            <GithubAgentCard />
            <SocialCreativeAgentCard />
            <SocialCopyAgentCard />
            {activeAgents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onEdit={() => openEdit(agent)}
                onToggleActive={() => toggleActiveMutation.mutate({ id: agent.id, active: false })}
                onDelete={() => setDeleteConfirmAgent(agent)}
              />
            ))}
            {activeAgents.length === 0 && (
              <div
                className="border border-dashed rounded-xl p-8 text-center text-muted-foreground col-span-full cursor-pointer hover:border-primary/40 transition-colors"
                onClick={openNew}
              >
                <Bot className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">הוסף סוכן חדש תחת כרמן</p>
              </div>
            )}
          </div>

          {/* Inactive */}
          {inactiveAgents.length > 0 && (
            <div>
              <button
                onClick={() => setShowInactive(v => !v)}
                className="flex items-center gap-2 mb-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showInactive ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span>מושהים ({inactiveAgents.length})</span>
              </button>
              {showInactive && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                  {inactiveAgents.map(agent => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      onEdit={() => openEdit(agent)}
                      onToggleActive={() => toggleActiveMutation.mutate({ id: agent.id, active: true })}
                      onDelete={() => setDeleteConfirmAgent(agent)}
                      inactive
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── CARMEN SETTINGS DIALOG ──────────────────────────────── */}
      <Dialog open={carmenDialogOpen} onOpenChange={setCarmenDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <img src={CARMEN_AVATAR} alt="Carmen" className="w-8 h-8 rounded-full object-cover object-top" />
              הגדרות כרמן
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="instructions" dir="rtl">
            <TabsList className="w-full mb-4 flex flex-wrap gap-1 h-auto">
              <TabsTrigger value="instructions" className="flex-1 min-w-[80px]">✍️ הנחיות</TabsTrigger>
              <TabsTrigger value="modes" className="flex-1 min-w-[80px]">🎯 מצבים</TabsTrigger>
              <TabsTrigger value="skills" className="flex-1 min-w-[80px]">⚡ סקילז</TabsTrigger>
              <TabsTrigger value="engine" className="flex-1 min-w-[80px]">מנוע AI</TabsTrigger>
              <TabsTrigger value="permissions" className="flex-1 min-w-[80px]">גישות</TabsTrigger>
              <TabsTrigger value="tools" className="flex-1 min-w-[80px]">כלים</TabsTrigger>
            </TabsList>

            {/* Instructions Tab */}
            <TabsContent value="instructions" className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <span>📝</span> הנחיות מרכזיות (System Prompt)
                </Label>
                <p className="text-xs text-muted-foreground">כתוב כאן את ההנחיות המלאות לכרמן — אופי, סגנון, דרך התנהגות, גבולות. אם ריק — ישתמש בברירת המחדל.</p>
                <Textarea
                  value={carmenSystemPrompt}
                  onChange={e => setCarmenSystemPrompt(e.target.value)}
                  placeholder="לדוגמא: את כרמן, עוזרת אישית חכמה ומקצועית. את מדברת בעברית בלבד. את תמיד מנסחת לאשר פעולות לפני שמבצעת אותן..."
                  className="min-h-[140px] text-sm font-mono resize-y text-right"
                  dir="rtl"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">🎭 סגנון כתיבה</Label>
                  <Select value={carmenWritingStyle} onValueChange={setCarmenWritingStyle}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">מקצועי</SelectItem>
                      <SelectItem value="friendly">חברותי</SelectItem>
                      <SelectItem value="formal">פורמלי</SelectItem>
                      <SelectItem value="casual">קזואלי</SelectItem>
                      <SelectItem value="empathetic">אמפתי</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">📰 אורך תשובות</Label>
                  <Select value={carmenResponseLength} onValueChange={setCarmenResponseLength}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">קצר</SelectItem>
                      <SelectItem value="medium">בינוני</SelectItem>
                      <SelectItem value="detailed">מפורט</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">🌐 שפה</Label>
                  <Select value={carmenLanguage} onValueChange={setCarmenLanguage}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="he">עברית</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ar">ערבית</SelectItem>
                      <SelectItem value="auto">אוטומטי</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Modes Tab */}
            <TabsContent value="modes" className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-1 block">🎯 מצבי פעולה של כרמן</Label>
                <p className="text-xs text-muted-foreground mb-3">בחר מצב מוכן מראש שמוסיף הנחיות ייחודיות לכרמן. ניתן להפעיל מספר מצבים במקביל.</p>
                <div className="grid grid-cols-2 gap-3">
                  {CARMEN_MODES.map(mode => (
                    <div
                      key={mode.id}
                      onClick={() => {
                        setCarmenActiveModes(prev =>
                          prev.includes(mode.id) ? prev.filter(m => m !== mode.id) : [...prev, mode.id]
                        );
                      }}
                      className={`border rounded-xl p-3 cursor-pointer transition-all ${
                        carmenActiveModes.includes(mode.id)
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{mode.icon}</span>
                        <span className="font-medium text-sm">{mode.name}</span>
                        {carmenActiveModes.includes(mode.id) && (
                          <span className="mr-auto text-xs bg-primary text-white rounded-full px-2 py-0.5">פעיל</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{mode.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            {/* Skills Tab */}
            <TabsContent value="skills" className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-1 block">⚡ סקילז פעילים</Label>
                <p className="text-xs text-muted-foreground mb-3">סקילז הם יכולות מודולריות שמרחיבות את כרמן. ניתן לנהל את ספריית הסקילז המלאה בדף הסקילז.</p>
                <div className="grid grid-cols-2 gap-2">
                  {BUILT_IN_SKILLS.map(skill => (
                    <div
                      key={skill.id}
                      onClick={() => {
                        setCarmenActiveSkills(prev =>
                          prev.includes(skill.id) ? prev.filter(s => s !== skill.id) : [...prev, skill.id]
                        );
                      }}
                      className={`border rounded-lg p-2.5 cursor-pointer transition-all ${
                        carmenActiveSkills.includes(skill.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{skill.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{skill.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{skill.description}</div>
                        </div>
                        {carmenActiveSkills.includes(skill.id) && (
                          <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            {/* Engine Tab */}
            <TabsContent value="engine" className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-3 block">מנוע ברירת מחדל לכרמן</Label>
                <div className="grid grid-cols-1 gap-2">
                  {ENGINES.map(engine => (
                    <button
                      key={engine.value}
                      onClick={() => setCarmenEngine(engine.value)}
                      className={`flex items-center justify-between p-3 rounded-lg border text-sm transition-all ${
                        carmenEngine === engine.value
                          ? "border-red-500/50 bg-red-500/10 text-foreground"
                          : "border-border hover:border-border/80 hover:bg-muted/50"
                      }`}
                    >
                      <span className="font-medium">{engine.label}</span>
                      <div className="flex items-center gap-2">
                        {engine.recommended && <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">מומלץ</Badge>}
                        <span className="text-xs text-muted-foreground">{engine.badge}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Permissions Tab */}
            <TabsContent value="permissions" className="space-y-3">
              <p className="text-xs text-muted-foreground mb-3">הגדר לכרמן גישת צפייה או עריכה לכל מודול</p>
              <div className="space-y-2">
                {MODULE_PERMISSIONS.map(mod => (
                  <div key={mod.key} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{mod.icon}</span>
                      <span className="text-sm font-medium">{mod.label}</span>
                    </div>
                    <div className="flex gap-1">
                      {(["none", "view", "edit"] as const).map(level => (
                        <button
                          key={level}
                          onClick={() => setCarmenAccess(prev => ({ ...prev, [mod.key]: level }))}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                            carmenAccess[mod.key] === level
                              ? level === "edit"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                : level === "view"
                                ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                                : "bg-muted text-muted-foreground border border-border"
                              : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50"
                          }`}
                        >
                          {level === "edit" ? <><Edit3 className="h-3 w-3" />עריכה</> :
                           level === "view" ? <><Eye className="h-3 w-3" />צפייה</> :
                           <><Shield className="h-3 w-3" />ללא</>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Tools Tab */}
            <TabsContent value="tools" className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">לכרמן יש גישה לכל הכלים כברירת מחדל</p>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                  {ALL_TOOLS.length} כלים פעילים
                </Badge>
              </div>
              {TOOL_GROUPS.map(group => (
                <div key={group} className="border border-border/50 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 text-sm font-medium"
                    onClick={() => toggleExpandGroup(group)}
                  >
                    <span>{group}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {ALL_TOOLS.filter(t => t.group === group).length}
                      </Badge>
                      {expandedGroups[group] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </div>
                  </button>
                  {expandedGroups[group] && (
                    <div className="p-2 space-y-1">
                      {ALL_TOOLS.filter(t => t.group === group).map(tool => (
                        <div key={tool.name} className="flex items-center gap-2 px-2 py-1.5 rounded text-sm">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                          {tool.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setCarmenDialogOpen(false)}>ביטול</Button>
            <Button
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={carmenSaving}
              onClick={async () => {
                setCarmenSaving(true);
                try {
                  // Build system prompt with style/length/language appended
                  const styleMap: Record<string, string> = { professional: 'מקצועי', friendly: 'חברותי', formal: 'פורמלי', casual: 'קזואלי', empathetic: 'אמפתי' };
                  const lengthMap: Record<string, string> = { short: 'קצרות', medium: 'בינוניות', detailed: 'מפורטות' };
                  const langMap: Record<string, string> = { he: 'עברית בלבד', en: 'English only', ar: 'ערבית בלבד', auto: 'בשפת המשתמש' };
                  const styleNote = `סגנון כתיבה: ${styleMap[carmenWritingStyle] || carmenWritingStyle}. אורך תשובות: ${lengthMap[carmenResponseLength] || carmenResponseLength}. שפה: ${langMap[carmenLanguage] || carmenLanguage}.`;
                  const finalPrompt = [carmenSystemPrompt.trim(), styleNote].filter(Boolean).join('\n\n');
                  // Find or upsert carmen agent
                  const { data: existing } = await supabase
                    .from('ai_agents')
                    .select('id')
                    .eq('tenant_id', tenantId)
                    .ilike('name', '%כרמן%')
                    .maybeSingle();
                  const agentData = {
                    engine: carmenEngine,
                    system_prompt: finalPrompt || null,
                    active_modes: carmenActiveModes,
                    active_skills: carmenActiveSkills,
                    writing_style: carmenWritingStyle,
                    response_length: carmenResponseLength,
                    language: carmenLanguage,
                  };
                  if (existing?.id) {
                    const { error } = await supabase.from('ai_agents').update(agentData).eq('id', existing.id);
                    if (error) throw error;
                  } else {
                    const { error } = await supabase.from('ai_agents').insert({
                      tenant_id: tenantId,
                      name: 'כרמן',
                      active: true,
                      ...agentData,
                    });
                    if (error) throw error;
                  }
                  toast.success('הגדרות כרמן נשמרו בהצלחה!');
                  setCarmenDialogOpen(false);
                } catch (e: any) {
                  toast.error('שגיאה בשמירה: ' + e.message);
                } finally {
                  setCarmenSaving(false);
                }
              }}
            >
              {carmenSaving ? 'שומר...' : 'שמור הגדרות'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── CARMEN TASK DIALOG ──────────────────────────────────── */}
      <Dialog open={carmenTaskDialogOpen} onOpenChange={setCarmenTaskDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <img src={CARMEN_AVATAR} alt="Carmen" className="w-8 h-8 rounded-full object-cover object-top" />
              תן משימה לכרמן
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-2 block">בחר מנוע</Label>
              <Select value={carmenEngine} onValueChange={setCarmenEngine}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENGINES.map(e => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.badge} {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm mb-2 block">תיאור המשימה</Label>
              <Textarea
                value={carmenTask}
                onChange={e => setCarmenTask(e.target.value)}
                placeholder="לדוגמה: צור סוכן חדש שמתמחה בניתוח קמפיינים פייסבוק..."
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                כרמן תבצע את המשימה ותחזיר תוצאות — ניתן לעקוב ב"ניהול משימות"
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setCarmenTaskDialogOpen(false)}>ביטול</Button>
            <Button
              className="bg-red-500 hover:bg-red-600 text-white gap-2"
              onClick={handleSendCarmenTask}
              disabled={!carmenTask.trim() || sendingTask}
            >
              <Send className="h-4 w-4" />
              {sendingTask ? "שולח..." : "שלח לכרמן"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── AGENT CREATE/EDIT DIALOG ────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingAgent ? "עריכת סוכן" : "סוכן חדש"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm mb-1.5 block">שם הסוכן *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="לדוגמה: סוכן לידים"
                />
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">מנוע AI</Label>
                <Select value={form.engine} onValueChange={v => setForm(p => ({ ...p, engine: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENGINES.map(e => (
                      <SelectItem key={e.value} value={e.value}>
                        {e.badge} {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-sm mb-1.5 block">תיאור</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="מה הסוכן הזה עושה?"
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs mb-1 block text-yellow-500 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> כישרון
                </Label>
                <Input
                  value={form.talent}
                  onChange={e => setForm(p => ({ ...p, talent: e.target.value }))}
                  placeholder="מה הוא מצטיין בו?"
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block text-red-400 flex items-center gap-1">
                  <Heart className="h-3 w-3" /> נשמה
                </Label>
                <Input
                  value={form.soul}
                  onChange={e => setForm(p => ({ ...p, soul: e.target.value }))}
                  placeholder="הערכים שלו"
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block text-purple-400 flex items-center gap-1">
                  <Brain className="h-3 w-3" /> אישיות
                </Label>
                <Input
                  value={form.personality}
                  onChange={e => setForm(p => ({ ...p, personality: e.target.value }))}
                  placeholder="איך הוא מתנהג?"
                  className="text-sm"
                />
              </div>
            </div>

            {/* Tools */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">כלים מורשים</Label>
                <button
                  onClick={toggleAllTools}
                  className="text-xs text-primary hover:underline"
                >
                  {form.allowed_tools.length === ALL_TOOLS.length ? "נקה הכל" : "בחר הכל"}
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                {TOOL_GROUPS.map(group => {
                  const groupTools = ALL_TOOLS.filter(t => t.group === group);
                  const isOpen = expandedGroups[group];
                  return (
                    <div key={group}>
                      <button
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50 text-sm font-medium"
                        onClick={() => toggleExpandGroup(group)}
                      >
                        <span>{group}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            {groupTools.filter(t => form.allowed_tools.includes(t.name)).length}/{groupTools.length}
                          </span>
                          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="pr-3 space-y-1">
                          {groupTools.map(tool => (
                            <label key={tool.name} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/30 cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                checked={form.allowed_tools.includes(tool.name)}
                                onChange={() => toggleTool(tool.name)}
                                className="rounded"
                              />
                              {tool.label}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.active}
                onCheckedChange={v => setForm(p => ({ ...p, active: v }))}
              />
              <Label className="text-sm">סוכן פעיל</Label>
            </div>
          </div>

          <div className="flex justify-between pt-2 border-t">
            <div>
              {editingAgent && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate(editingAgent.id)}
                >
                  מחק סוכן
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={!form.name.trim() || saveMutation.isPending}
                className="bg-[#36d399] hover:bg-[#2fbf87] text-black"
              >
                {saveMutation.isPending ? "שומר..." : editingAgent ? "עדכן" : "צור סוכן"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE CONFIRM DIALOG ──────────────────────────────── */}
      <Dialog open={!!deleteConfirmAgent} onOpenChange={(open) => !open && setDeleteConfirmAgent(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              מחיקת סוכן
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <p className="text-sm text-muted-foreground">
              האם אתה בטוח שברצונך למחוק את הסוכן{" "}
              <span className="font-semibold text-foreground">{deleteConfirmAgent?.name}</span>?
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              פעולה זו אינה ניתנת לביטול.
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirmAgent(null)}>ביטול</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirmAgent) {
                  deleteMutation.mutate(deleteConfirmAgent.id);
                  setDeleteConfirmAgent(null);
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "מוחק..." : "מחק סוכן"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Built-in Agent Cards ─────────────────────────────────────────────────────

function SocialCreativeAgentCard() {
  const { buildPath } = useTenantPath();
  const navigate = useNavigate();
  return (
    <div
      className="border rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all bg-gradient-to-br from-purple-50 to-white dark:from-purple-950 dark:to-gray-800"
      onClick={() => navigate(buildPath("social-media"))}
    >
      <div className="flex items-start justify-between mb-3">
        <Badge className="bg-purple-500 text-white text-xs">מובנה</Badge>
        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white">
          <Sparkles className="h-5 w-5" />
        </div>
      </div>
      <h3 className="font-bold text-lg mb-1">סוכן קריאייטיב</h3>
      <p className="text-sm text-muted-foreground mb-3">יוצר תמונות ותוכן ויזואלי לקמפיינים ופוסטים</p>
      <div className="flex gap-1 flex-wrap">
        <Badge variant="outline" className="text-xs">תמונות AI</Badge>
        <Badge variant="outline" className="text-xs">עיצוב</Badge>
        <Badge variant="outline" className="text-xs">ויזואל</Badge>
      </div>
    </div>
  );
}

function SocialCopyAgentCard() {
  const { buildPath } = useTenantPath();
  const navigate = useNavigate();
  return (
    <div
      className="border rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all bg-gradient-to-br from-blue-50 to-white dark:from-blue-950 dark:to-gray-800"
      onClick={() => navigate(buildPath("social-gantt"))}
    >
      <div className="flex items-start justify-between mb-3">
        <Badge className="bg-blue-500 text-white text-xs">מובנה</Badge>
        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <PenLine className="h-5 w-5" />
        </div>
      </div>
      <h3 className="font-bold text-lg mb-1">סוכן קופי</h3>
      <p className="text-sm text-muted-foreground mb-3">כותב קופי לסושיאל מדיה עם התאמת טון, קהל יעד וקריאה לפעולה</p>
      <div className="flex gap-1 flex-wrap">
        <Badge variant="outline" className="text-xs">קופי סושיאל</Badge>
        <Badge variant="outline" className="text-xs">טונים</Badge>
        <Badge variant="outline" className="text-xs">האשטגים</Badge>
      </div>
    </div>
  );
}

function GithubAgentCard() {
  const { buildPath } = useTenantPath();
  const navigate = useNavigate();
  return (
    <div
      className="bg-white dark:bg-gray-900 border border-border/60 rounded-2xl p-5 cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all"
      onClick={() => navigate(buildPath("github-agent"))}
    >
      <div className="flex items-start justify-between mb-4">
        <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 text-xs">מובנה</Badge>
        <img src={agentGithub} alt="GitHub Agent" className="w-12 h-12 rounded-xl object-cover" loading="lazy" />
      </div>
      <h3 className="font-bold text-base mb-1">GitHub Agent</h3>
      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">סוכן אוטומטי לניתוח שגיאות, תיקון קוד ותמיכה טכנית עם אישורים</p>
      <div className="flex gap-1.5 flex-wrap">
        <Badge variant="outline" className="text-[10px] font-normal">תיקון קוד</Badge>
        <Badge variant="outline" className="text-[10px] font-normal">ניתוח שגיאות</Badge>
        <Badge variant="outline" className="text-[10px] font-normal">PR אוטומטי</Badge>
      </div>
    </div>
  );
}

function AgentCard({ agent, onEdit, onToggleActive, onDelete, inactive = false }: {
  agent: Agent;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  inactive?: boolean;
}) {
  const toolCount = (agent.allowed_tools || []).length;
  const avatarSrc = AGENT_AVATARS[agent.name] || DEFAULT_AVATAR;
  const engineInfo = ENGINES.find(e => e.value === agent.engine);

  return (
    <div
      className={`bg-white dark:bg-gray-900 border rounded-2xl p-5 transition-all hover:shadow-lg cursor-pointer group ${
        inactive ? "border-border/30 opacity-60" : "border-border/60 hover:border-primary/40"
      }`}
      onClick={onEdit}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <button
            onClick={e => { e.stopPropagation(); onToggleActive(); }}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
              inactive
                ? "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                : "bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive"
            }`}
          >
            {inactive ? "הפעל" : "השהה"}
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="text-xs p-1.5 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
            title="מחק סוכן"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <img
          src={avatarSrc}
          alt={agent.name}
          className="w-12 h-12 rounded-xl object-cover"
          loading="lazy"
        />
      </div>
      <h3 className="font-bold text-base mb-1">{agent.name}</h3>
      <div className="space-y-1.5 mb-3">
        {agent.talent && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-yellow-500 shrink-0" />
            <span className="line-clamp-1">{agent.talent}</span>
          </div>
        )}
        {agent.soul && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Heart className="h-3 w-3 text-red-400 shrink-0" />
            <span className="line-clamp-1">{agent.soul}</span>
          </div>
        )}
        {agent.personality && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Brain className="h-3 w-3 text-purple-400 shrink-0" />
            <span className="line-clamp-1">{agent.personality}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2.5 mt-auto">
        <span>{toolCount === 0 ? "כל הכלים" : `${toolCount} כלים`}</span>
        <span className="opacity-70">{engineInfo?.badge || agent.engine}</span>
      </div>
    </div>
  );
}

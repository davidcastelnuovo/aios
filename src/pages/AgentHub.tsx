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
import { Plus, Bot, Zap, Brain, Heart, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

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
];

const TOOL_GROUPS = ["לידים", "משימות", "לקוחות", "תקשורת", "כללי"];

const ENGINES = [
  { value: "gemini-3-flash", label: "Gemini 3 Flash (מהיר)" },
  { value: "gemini-3-pro", label: "Gemini 3 Pro (חכם)" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "claude-sonnet", label: "Claude Sonnet (מומלץ)" },
  { value: "gpt-5-mini", label: "GPT-5 Mini" },
];

const AVATAR_EMOJIS = ["🤖", "🦾", "🧠", "⚡", "🎯", "🔥", "💡", "🌟", "🦅", "🐺", "🦊", "🐉"];

interface Agent {
  id: string;
  name: string;
  description?: string;
  personality?: string;
  soul?: string;
  talent?: string;
  engine: string;
  active: boolean;
  allowed_tools: string[];
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

export default function AgentHub() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [form, setForm] = useState<AgentFormData>(defaultForm);
  const [showInactive, setShowInactive] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

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
        description: data.description || null,
        personality: data.personality || null,
        soul: data.soul || null,
        talent: data.talent || null,
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
      toast.success(editingAgent ? "סוכן עודכן" : "סוכן נוצר");
      setDialogOpen(false);
      setEditingAgent(null);
      setForm(defaultForm);
    },
    onError: (e: any) => toast.error(e.message),
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

  const activeAgents = agents.filter(a => a.active);
  const inactiveAgents = agents.filter(a => !a.active);

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-7 w-7 text-[#36d399]" />
            סוכנים
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            הגדר סוכני AI שפועלים בשמך בתוך המערכת
          </p>
        </div>
        <Button onClick={openNew} className="gap-2 bg-[#36d399] hover:bg-[#2fbf87] text-black">
          <Plus className="h-4 w-4" />
          סוכן חדש
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">טוען...</div>
      ) : (
        <>
          {/* Active Agents */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-[#36d399]" />
              <span className="font-semibold text-sm">פעילים</span>
              <Badge variant="secondary" className="text-xs">{activeAgents.length}</Badge>
            </div>

            {activeAgents.length === 0 ? (
              <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground">
                <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">אין סוכנים פעילים עדיין</p>
                <Button variant="link" onClick={openNew} className="mt-2 text-[#36d399]">
                  צור סוכן ראשון
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeAgents.map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onEdit={() => openEdit(agent)}
                    onToggleActive={() => toggleActiveMutation.mutate({ id: agent.id, active: false })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Inactive Agents */}
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
                      inactive
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-[#36d399]" />
              {editingAgent ? "עריכת סוכן" : "סוכן חדש"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Avatar + Name */}
            <div className="flex gap-3 items-start">
              <div className="flex flex-wrap gap-1 w-32">
                {AVATAR_EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => setForm(p => ({ ...p, avatar: e }))}
                    className={`text-xl p-1 rounded-lg transition-all ${form.avatar === e ? "bg-[#36d399]/20 ring-1 ring-[#36d399]" : "hover:bg-muted"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <Label>שם הסוכן *</Label>
                  <Input
                    placeholder="למשל: סוכן לידים, מלכה"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>תיאור קצר</Label>
                  <Input
                    placeholder="מה הסוכן עושה בקצרה"
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* 3 Layers */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#36d399] border-b border-[#36d399]/20 pb-2">
                <Sparkles className="h-4 w-4" />
                שלוש שכבות הסוכן
              </div>

              <div className="space-y-1">
                <Label className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-yellow-400" />
                  כישורים (Skills)
                </Label>
                <Textarea
                  placeholder="מה הסוכן יודע לעשות? למשל: מתמחה בסגירת עסקאות, מנהל לידים נכנסים, שולח הודעות פולואפ..."
                  value={form.talent}
                  onChange={e => setForm(p => ({ ...p, talent: e.target.value }))}
                  rows={2}
                  className="mt-1 resize-none"
                />
              </div>

              <div className="space-y-1">
                <Label className="flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-red-400" />
                  נשמה (Soul)
                </Label>
                <Textarea
                  placeholder="מה מניע את הסוכן? למשל: אוהב אנשים, רוצה שכל ליד יקבל מענה מהיר, מאמין בשירות אמיתי..."
                  value={form.soul}
                  onChange={e => setForm(p => ({ ...p, soul: e.target.value }))}
                  rows={2}
                  className="mt-1 resize-none"
                />
              </div>

              <div className="space-y-1">
                <Label className="flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-purple-400" />
                  אופי (Personality)
                </Label>
                <Textarea
                  placeholder="איך הסוכן מתנהג? למשל: ישיר ותכליתי, חם וסבלני, מקצועי ורשמי..."
                  value={form.personality}
                  onChange={e => setForm(p => ({ ...p, personality: e.target.value }))}
                  rows={2}
                  className="mt-1 resize-none"
                />
              </div>
            </div>

            {/* Tools */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">כלים (מה הסוכן יכול לעשות)</Label>
                <button
                  onClick={toggleAllTools}
                  className="text-xs text-[#36d399] hover:underline"
                >
                  {form.allowed_tools.length === ALL_TOOLS.length ? "בטל הכל" : "בחר הכל"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {form.allowed_tools.length === 0 ? "ריק = גישה לכל הכלים" : `${form.allowed_tools.length} כלים נבחרו`}
              </p>

              {TOOL_GROUPS.map(group => {
                const groupTools = ALL_TOOLS.filter(t => t.group === group);
                const isExpanded = expandedGroups[group] !== false;
                return (
                  <div key={group} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedGroups(p => ({ ...p, [group]: !isExpanded }))}
                      className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted text-sm font-medium"
                    >
                      <span>{group}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {groupTools.filter(t => form.allowed_tools.includes(t.name)).length}/{groupTools.length}
                        </span>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="p-2 grid grid-cols-2 gap-1">
                        {groupTools.map(tool => (
                          <button
                            key={tool.name}
                            onClick={() => toggleTool(tool.name)}
                            className={`text-xs text-right px-2 py-1.5 rounded-md transition-all ${
                              form.allowed_tools.includes(tool.name)
                                ? "bg-[#36d399]/20 text-[#36d399] ring-1 ring-[#36d399]/40"
                                : "bg-muted/30 text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {tool.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Engine + Active */}
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label>מנוע AI</Label>
                <Select value={form.engine} onValueChange={v => setForm(p => ({ ...p, engine: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENGINES.map(e => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-1">
                <Switch
                  checked={form.active}
                  onCheckedChange={v => setForm(p => ({ ...p, active: v }))}
                />
                <Label>{form.active ? "פעיל" : "מושהה"}</Label>
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={!form.name || saveMutation.isPending}
                className="bg-[#36d399] hover:bg-[#2fbf87] text-black"
              >
                {saveMutation.isPending ? "שומר..." : editingAgent ? "שמור שינויים" : "צור סוכן"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgentCard({ agent, onEdit, onToggleActive, inactive = false }: {
  agent: Agent;
  onEdit: () => void;
  onToggleActive: () => void;
  inactive?: boolean;
}) {
  const toolCount = (agent.allowed_tools || []).length;

  return (
    <div
      className={`border rounded-xl p-4 transition-all hover:shadow-md cursor-pointer group ${
        inactive ? "border-border/40" : "border-border hover:border-[#36d399]/40"
      }`}
      onClick={onEdit}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
            inactive ? "bg-muted/50" : "bg-[#36d399]/10"
          }`}>
            🤖
          </div>
          <div>
            <div className="font-semibold text-sm">{agent.name}</div>
            {agent.description && (
              <div className="text-xs text-muted-foreground line-clamp-1">{agent.description}</div>
            )}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onToggleActive(); }}
          className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
            inactive
              ? "bg-muted text-muted-foreground hover:bg-[#36d399]/20 hover:text-[#36d399]"
              : "bg-[#36d399]/10 text-[#36d399] hover:bg-red-500/10 hover:text-red-500"
          }`}
        >
          {inactive ? "הפעל" : "השהה"}
        </button>
      </div>

      {/* Layers preview */}
      <div className="space-y-1 mb-3">
        {agent.talent && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Zap className="h-3 w-3 text-yellow-400 shrink-0" />
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

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
        <span>{toolCount === 0 ? "כל הכלים" : `${toolCount} כלים`}</span>
        <span className="opacity-60">{agent.engine?.replace("gemini-", "G").replace("gpt-", "GPT-").replace("claude-", "C-")}</span>
      </div>
    </div>
  );
}

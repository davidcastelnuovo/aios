import { useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Zap, Activity, Trash2, Edit, TestTube, Workflow, MessageCircle, Bot, Share2, Copy, Building2, ArrowRight } from "lucide-react";
import { NodeIconDisplay } from "@/components/automations/nodeIcons";
import { useToast } from "@/hooks/use-toast";
import { AddAutomationForm } from "@/components/forms/AddAutomationForm";
import { EditAutomationDialog } from "@/components/forms/EditAutomationDialog";
import { TestAutomationDialog } from "@/components/forms/TestAutomationDialog";
import { ShareAutomationDialog } from "@/components/automations/ShareAutomationDialog";
import { CloneToOrgDialog } from "@/components/sharing/CloneToOrgDialog";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTenantPath } from "@/hooks/useTenantPath";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TRIGGER_LABELS: Record<string, string> = {
  carmen_whatsapp_session: "שיחת כרמן ב-WhatsApp",
  task_assigned: "משימה שוייכה",
  task_status_changed: "סטטוס משימה השתנה",
  lead_status_changed: "סטטוס ליד השתנה",
  lead_created: "ליד נוצר",
  client_created: "לקוח נוצר",
  client_status_changed: "סטטוס לקוח השתנה",
  onboarding_status_changed: "סטטוס קליטה השתנה",
  meeting_created: "נוצרה פגישה",
  task_overdue: "משימה לא הושלמה בזמן",
  inbound_webhook_task: "קבלת משימה מ-Webhook",
  inbound_webhook_lead: "קליטת ליד מ-Webhook",
};

const ACTION_LABELS: Record<string, string> = {
  webhook: "Webhook",
  email: "אימייל",
  notification: "התראה",
  update_status: "שינוי סטטוס",
  send_whatsapp: "שלח WhatsApp (ManyChat)",
  create_manychat_subscriber: "צור subscriber ב-ManyChat",
  send_greenapi_message: "שלח WhatsApp (Green API)",
  add_lead_update: "הוסף עדכון לליד",
  add_client_update: "הוסף עדכון ללקוח",
  create_task: "צור משימה",
};

export default function Automations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [selectedAutomationId, setSelectedAutomationId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [cloneOrgOpen, setCloneOrgOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<any>(null);
  const { tenantId, isActiveTenantSynced } = useCurrentTenant();
  const { buildPath } = useTenantPath();

  // Fetch automations (own + shared mirrors from other tenants)
  const { data: automations, isLoading } = useQuery({
    queryKey: ["automations", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data: own, error: ownErr } = await supabase
        .from("automations")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (ownErr) throw ownErr;

      const { data: shareRows, error: shareErr } = await supabase
        .from("automation_shared_tenants")
        .select("automation_id")
        .eq("tenant_id", tenantId);
      if (shareErr) throw shareErr;

      const sharedIds = (shareRows || []).map((r: any) => r.automation_id);
      let shared: any[] = [];
      if (sharedIds.length > 0) {
        const { data: sharedAutos, error: sharedErr } = await supabase
          .from("automations")
          .select("*")
          .in("id", sharedIds);
        if (sharedErr) throw sharedErr;
        shared = (sharedAutos || []).map((a: any) => ({ ...a, _isSharedMirror: true }));
      }

      return [...(own || []), ...shared];
    },
    enabled: !!tenantId && isActiveTenantSynced,
  });

  // Fetch logs for selected automation
  const { data: logs } = useQuery({
    queryKey: ["automation-logs", selectedAutomationId],
    queryFn: async () => {
      if (!selectedAutomationId) return [];
      
      const { data, error } = await supabase
        .from("automation_logs")
        .select("*")
        .eq("automation_id", selectedAutomationId)
        .order("triggered_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAutomationId,
  });

  // Toggle automation active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      if (!tenantId) throw new Error("Missing tenant");
      const { error } = await supabase
        .from("automations")
        .update({ active })
        .eq("id", id)
        .eq("tenant_id", tenantId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({
        title: "אוטומציה עודכנה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete automation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("automations")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({
        title: "אוטומציה נמחקה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Duplicate automation (including flow steps)
  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error("No tenant");

      // 1. Load source automation
      const { data: src, error: srcErr } = await supabase
        .from("automations")
        .select("*")
        .eq("id", id)
        .single();
      if (srcErr) throw srcErr;

      // 2. Insert clone
      const { id: _id, created_at, updated_at, source_automation_id, source_tenant_id, ...rest } = src as any;
      const { data: clone, error: insErr } = await supabase
        .from("automations")
        .insert({
          ...rest,
          tenant_id: tenantId,
          name: `${src.name} (העתק)`,
          active: false,
        })
        .select()
        .single();
      if (insErr) throw insErr;

      // 3. Clone flow steps if any (preserving parent_step_id mapping)
      const { data: steps, error: stepsErr } = await supabase
        .from("automation_flow_steps")
        .select("*")
        .eq("automation_id", id);
      if (stepsErr) throw stepsErr;

      if (steps && steps.length > 0) {
        const idMap = new Map<string, string>();
        steps.forEach((s: any) => idMap.set(s.id, crypto.randomUUID()));

        const newSteps = steps.map((s: any) => ({
          id: idMap.get(s.id)!,
          automation_id: clone.id,
          tenant_id: tenantId,
          parent_step_id: s.parent_step_id ? idMap.get(s.parent_step_id) ?? null : null,
          step_type: s.step_type,
          action_type: s.action_type,
          condition_branch: s.condition_branch,
          configuration: s.configuration,
          label: s.label,
          position_x: s.position_x,
          position_y: s.position_y,
          sort_order: s.sort_order,
        }));

        const { error: stepInsErr } = await supabase.from("automation_flow_steps").insert(newSteps);
        if (stepInsErr) throw stepInsErr;
      }

      return clone;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({ title: "האוטומציה שוכפלה", description: "נוצר עותק כבוי. הפעל אותו לאחר העריכה." });
    },
    onError: (error: any) => {
      toast({ title: "שגיאה בשכפול", description: error.message, variant: "destructive" });
    },
  });

  // Create new Carmen WhatsApp session automation
  const createCarmenFlowMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const { data, error } = await supabase
        .from("automations")
        .insert({
          name: "שיחת כרמן ב-WhatsApp",
          description: "שיחה אינטראקטיבית עם כרמן ב-WhatsApp - מתחילה במילת \"כרמן\", מסתיימת ב\"סיימנו כרמן\"",
          tenant_id: tenantId,
          trigger_type: "whatsapp_message_received",
          action_type: "send_greenapi_message",
          configuration: {
            carmen_session_mode: true,
            trigger_keyword: "כרמן",
            end_keyword: "סיימנו כרמן",
          },
          is_flow: true,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      navigate(buildPath(`automations/flow/${data.id}`));
    },
    onError: (err: any) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });
  // Create the "Campaign Pulse" template — a daily skinned-agent chain.
  // Built INACTIVE and opened in the visual editor for review. Each agent node
  // is pre-pinned to a catalog skin (campaigner/seo/analyst) via skin_slugs.
  // NOTE: this is a linear skeleton on the current engine; true parallel fan-in
  // synthesis is a planned engine enhancement.
  const createCampaignPulseMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      // Find Carmen (or any active agent) for the agent nodes.
      const { data: agentsList } = await supabase
        .from("ai_agents" as any)
        .select("id,name,active")
        .eq("tenant_id", tenantId)
        .eq("active", true);
      const carmen =
        (agentsList as any[] || []).find((a) => /כרמן|carmen/i.test(a.name || "")) ||
        (agentsList as any[] || [])[0];
      if (!carmen) throw new Error("לא נמצא סוכן פעיל (כרמן). צרי סוכן תחילה.");

      const { data: automation, error: autoErr } = await supabase
        .from("automations")
        .insert({
          name: "Campaign Pulse — בדיקת בוקר",
          description: "סריקת בוקר יומית: קמפיינרית → SEO → אנליסטית → דוח. תבנית כבויה לעריכה.",
          tenant_id: tenantId,
          trigger_type: "scheduled_daily",
          action_type: "notification",
          configuration: { hour: 8, minute: 0 },
          is_flow: true,
          active: false,
        } as any)
        .select()
        .single();
      if (autoErr) throw autoErr;

      const aid = automation.id;
      const mk = (over: any) => ({
        id: crypto.randomUUID(),
        automation_id: aid,
        tenant_id: tenantId,
        condition_branch: null,
        label: over.label ?? null,
        ...over,
      });
      const trigger = mk({ step_type: "trigger", action_type: "scheduled_daily", configuration: { hour: 8, minute: 0 }, position_x: 400, position_y: 60, sort_order: 0, parent_step_id: null, label: "כל בוקר 08:00" });
      const agentNode = (skin: string, label: string, instruction: string, parent: string, y: number, sort: number) =>
        mk({
          step_type: "agent",
          action_type: "agent",
          configuration: { agent_id: carmen.id, skin_slugs: [skin], step_instruction: instruction },
          position_x: 400,
          position_y: y,
          sort_order: sort,
          parent_step_id: parent,
          label,
        });
      const campaigner = agentNode("campaigner", "קמפיינרית", "נתחי ביצועי קמפיינים של 7 הימים האחרונים מול השבוע הקודם. זהי חריגות תקציב, anomalies וחשבונות לא תקינים. סכמי בקצרה.", trigger.id, 190, 1);
      const seo = agentNode("seo", "SEO", "בדקי שינויי דירוג, backlinks חדשים ובעיות audit טכניות מהותיות. סכמי בקצרה.", campaigner.id, 320, 2);
      const analyst = agentNode("analyst", "אנליסטית — סינתזה", "על סמך ממצאי הקמפיינים וה-SEO שנאספו בשלבים הקודמים ({{agent_output}}), הפיקי 3 תובנות מתועדפות + המלצה אחת לפעולה.", seo.id, 450, 3);
      const report = mk({
        step_type: "action",
        action_type: "notification",
        configuration: { title: "Campaign Pulse", message: "{{agent_output}}" },
        position_x: 400,
        position_y: 580,
        sort_order: 4,
        parent_step_id: analyst.id,
        label: "דוח",
      });

      const { error: stepErr } = await supabase
        .from("automation_flow_steps")
        .insert([trigger, campaigner, seo, analyst, report] as any);
      if (stepErr) throw stepErr;
      return automation;
    },
    onSuccess: (data) => {
      toast({ title: "התבנית נוצרה (כבויה)", description: "פתחי, בדקי ובחרי סקינז/הוראות לפני הפעלה." });
      navigate(buildPath(`automations/flow/${data.id}`));
    },
    onError: (err: any) => {
      toast({ title: "שגיאה ביצירת התבנית", description: err.message, variant: "destructive" });
    },
  });

  // Create new flow automation
  const createFlowMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const { data, error } = await supabase
        .from("automations")
        .insert({
          name: "פלוו חדש",
          tenant_id: tenantId,
          trigger_type: "lead_created",
          action_type: "notification",
          configuration: {},
          is_flow: true,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      navigate(buildPath(`automations/flow/${data.id}`));
    },
    onError: (err: any) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const handleTest = (automation: any) => {
    setSelectedAutomation(automation);
    setTestDialogOpen(true);
  };

  const handleViewLogs = (automationId: string) => {
    setSelectedAutomationId(automationId);
    setLogsDialogOpen(true);
  };

  const handleEdit = (automation: any) => {
    setSelectedAutomation(automation);
    setEditDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 p-3 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 md:h-8 md:w-8" />
            אוטומציות
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            נהל אוטומציות והזרמות נתונים למערכות חיצוניות
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => createFlowMutation.mutate()} disabled={createFlowMutation.isPending} variant="outline">
            <Workflow className="h-4 w-4 ml-2" />
            פלוו חדש
          </Button>
          <AddAutomationForm />
        </div>
      </div>

      {/* Carmen WhatsApp Session Banner - shown when no carmen automation exists */}
      {!automations?.some((a: any) => a.configuration?.carmen_session_mode === true) && (
        <div className="rounded-xl border border-purple-500/30 bg-gradient-to-l from-purple-500/5 to-transparent p-4 flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">שיחת כרמן ב-WhatsApp</p>
              <p className="text-xs text-muted-foreground">אפשר למשתמשים לשוחר עם כרמן ישירות ב-WhatsApp עם הקלדת מילת "כרמן"</p>
            </div>
          </div>
          <Button
            size="sm"
            className="md:mr-auto bg-purple-600 hover:bg-purple-700 text-white shrink-0"
            onClick={() => createCarmenFlowMutation.mutate()}
            disabled={createCarmenFlowMutation.isPending}
          >
            <MessageCircle className="h-4 w-4 ml-2" />
            צור שיחת כרמן
          </Button>
        </div>
      )}

      {/* Campaign Pulse template */}
      <div className="flex items-center gap-3 p-4 rounded-lg border bg-gradient-to-l from-orange-500/10 to-transparent">
        <div className="p-2 rounded-full bg-orange-500/20">
          <Zap className="h-5 w-5 text-orange-500" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">תבנית: Campaign Pulse</p>
          <p className="text-xs text-muted-foreground">סריקת בוקר יומית עם סקינז — קמפיינרית ← SEO ← אנליסטית ← דוח. נוצרת כבויה לעריכה.</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 border-orange-500 text-orange-600 hover:bg-orange-50"
          onClick={() => createCampaignPulseMutation.mutate()}
          disabled={createCampaignPulseMutation.isPending}
        >
          <Plus className="h-4 w-4 ml-2" />
          צור תבנית
        </Button>
      </div>

      {/* Automations Grid */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-2">
        {automations?.map((automation) => {
          const isMirror = (automation as any)._isSharedMirror === true;
          const isCarmenMode = (automation as any).configuration?.carmen_session_mode === true;
          const isFlow = (automation as any).is_flow;
          const triggerType = automation.trigger_type;
          const actionType = automation.action_type;
          return (
          <Card
            key={automation.id}
            className={cn(
              "group transition-all duration-200",
              automation.active ? "" : "opacity-60",
              isFlow && "cursor-pointer hover:border-primary/50 hover:shadow-md",
              isCarmenMode && "border-purple-500/40 bg-purple-500/5",
              isMirror && "border-dashed border-amber-500/40 bg-amber-500/5"
            )}
            onClick={() => isFlow && navigate(buildPath(`automations/flow/${automation.id}`))}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                {/* Trigger icon badge */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{ backgroundColor: "rgba(var(--muted), 0.5)" }}
                >
                  <NodeIconDisplay
                    stepType="trigger"
                    actionType={triggerType}
                    size={20}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-sm font-semibold truncate">
                      {automation.name}
                    </CardTitle>
                    {isMirror && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 dark:text-amber-400 shrink-0">
                        מראה
                      </Badge>
                    )}
                    {isCarmenMode && (
                      <Badge variant="outline" className="text-[10px] border-purple-500/50 text-purple-600 dark:text-purple-400 shrink-0">
                        כרמן
                      </Badge>
                    )}
                  </div>
                  {/* Trigger → Action summary */}
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[11px] text-muted-foreground">
                      {TRIGGER_LABELS[triggerType] || triggerType}
                    </span>
                    {actionType && (
                      <>
                        <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />
                        <span className="text-[11px] text-muted-foreground">
                          {ACTION_LABELS[actionType] || actionType}
                        </span>
                      </>
                    )}
                  </div>
                  {automation.description && (
                    <CardDescription className="text-xs mt-0.5 line-clamp-1">
                      {automation.description}
                    </CardDescription>
                  )}
                </div>

                <Switch
                  checked={automation.active}
                  disabled={isMirror}
                  onCheckedChange={(checked) =>
                    !isMirror && toggleActiveMutation.mutate({ id: automation.id, active: checked })
                  }
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">

              {(automation.configuration as any)?.url && (
                <p className="text-xs text-muted-foreground truncate">
                  URL: {(automation.configuration as any).url}
                </p>
              )}

              {automation.action_type === "update_status" && (automation.configuration as any)?.entity && (
                <p className="text-xs text-muted-foreground">
                  עדכון סטטוס: {(automation.configuration as any).entity === "lead" ? "ליד" : "משימה"} → {(automation.configuration as any).status}
                </p>
              )}

              {isMirror && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  אוטומציה זו שייכת לארגון אחר. היא רצה פעם אחת בלבד, ולא ניתן לערוך אותה כאן.
                </p>
              )}

              <div className="flex flex-wrap gap-1.5 pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); handleViewLogs(automation.id); }}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Activity className="h-3 w-3 ml-1" />
                  לוגים
                </Button>
                {!isMirror && (
                  <>
                    {!isFlow && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); handleTest(automation); }}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <TestTube className="h-3 w-3 ml-1" />
                        בדיקה
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); handleEdit(automation); }}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Edit className="h-3 w-3 ml-1" />
                      עריכה
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAutomation(automation);
                        setShareDialogOpen(true);
                      }}
                      title="שתף כמראה (read-only) עם ארגון אחר"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Share2 className="h-3 w-3 ml-1" />
                      שתף
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); duplicateMutation.mutate(automation.id); }}
                      disabled={duplicateMutation.isPending}
                      title="שכפל אוטומציה בארגון הנוכחי"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3 w-3 ml-1" />
                      שכפל
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAutomation(automation);
                        setCloneOrgOpen(true);
                      }}
                      title="שכפל עותק עצמאי לארגון אחר"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Building2 className="h-3 w-3 ml-1" />
                      שכפל לארגון
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("האם למחוק אוטומציה זו?")) {
                          deleteMutation.mutate(automation.id);
                        }
                      }}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 mr-auto"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>

      {automations?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              אין עדיין אוטומציות במערכת
            </p>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      {selectedAutomation && (
        <EditAutomationDialog
          automation={selectedAutomation}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
      )}

      {/* Test Dialog */}
      {selectedAutomation && (
        <TestAutomationDialog
          automation={selectedAutomation}
          open={testDialogOpen}
          onOpenChange={setTestDialogOpen}
        />
      )}

      {/* Share Dialog */}
      {selectedAutomation && (
        <ShareAutomationDialog
          automation={selectedAutomation}
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
        />
      )}

      {/* Clone-to-organization Dialog (true independent copy) */}
      {selectedAutomation && (
        <CloneToOrgDialog
          entityType="automation"
          entityId={selectedAutomation.id}
          entityName={selectedAutomation.name}
          open={cloneOrgOpen}
          onOpenChange={setCloneOrgOpen}
        />
      )}

      {/* Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent dir="rtl" className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>לוגי הפעלה</DialogTitle>
            <DialogDescription>
              50 הרצות אחרונות של האוטומציה
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>זמן ביצוע</TableHead>
                  <TableHead>פרטים</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      {new Date(log.triggered_at).toLocaleString("he-IL")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.success ? "default" : "destructive"}>
                        {log.success ? "הצליח" : "נכשל"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.execution_time_ms}ms
                    </TableCell>
                    <TableCell className="text-xs truncate max-w-xs">
                      {log.error_message || (log.response as any)?.statusText || "OK"}
                    </TableCell>
                  </TableRow>
                ))}
                {logs?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      אין לוגים עדיין
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

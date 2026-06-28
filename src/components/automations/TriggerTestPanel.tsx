/**
 * TriggerTestPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Per-trigger test panel that opens from StepConfigPanel.
 * Each trigger type shows relevant input fields and runs a targeted test
 * against the specific automation (not all automations for that trigger type).
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Play,
  Search,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { NodeIconDisplay } from "./nodeIcons";
import { ACTION_TYPE_LABELS } from "./FlowNode";
import { cn } from "@/lib/utils";

interface TriggerTestPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automationId: string;
  automationName: string;
  triggerType: string;
  triggerConfig?: Record<string, any>;
}

interface StepResult {
  step_id?: string;
  action_type?: string;
  success: boolean;
  error?: string;
  output?: any;
}

interface TestResult {
  success?: boolean;
  error?: string;
  steps?: StepResult[];
  agent_output?: string;
  flow?: any;
}

// ─── Helper: build default payload per trigger type ──────────────────────────

function getDefaultPayload(triggerType: string): Record<string, any> {
  switch (triggerType) {
    case "lead_created":
    case "lead_updated":
    case "lead_status_changed":
    case "lead_note_added":
    case "lead_inactive_days":
      return {
        contact_name: "ישראל ישראלי",
        phone: "0501234567",
        email: "test@example.com",
        source: "facebook",
        status: "new",
        notes: "",
      };
    case "client_created":
    case "client_status_changed":
    case "client_note_added":
      return {
        contact_name: "לקוח לדוגמה",
        phone: "0521234567",
        email: "client@example.com",
        status: "active",
      };
    case "task_created":
    case "task_status_changed":
    case "task_completed":
    case "task_assigned":
    case "task_overdue":
      return {
        title: "משימה לדוגמה",
        description: "תיאור המשימה",
        status: "pending",
        assigned_to: "",
      };
    case "meeting_created":
    case "meeting_updated":
    case "meeting_cancelled":
      return {
        title: "פגישה לדוגמה",
        meeting_date: new Date().toISOString().split("T")[0],
        meeting_time: "10:00",
        location: "משרד",
        contact_name: "ישראל ישראלי",
        phone: "0501234567",
      };
    case "whatsapp_message_received":
      return {
        phone: "972501234567",
        message: "שלום, אני מעוניין לקבל מידע",
        from_name: "ישראל ישראלי",
      };
    case "carmen_whatsapp_session":
      return {
        phone: "972501234567",
        message: "כרמן, מה שלומך?",
        from_name: "ישראל ישראלי",
      };
    case "telegram_message_received":
      return {
        chat_id: "123456789",
        message: "שלום, אני מעוניין לקבל מידע",
        from_name: "ישראל ישראלי",
      };
    case "email_received":
      return {
        from: "sender@example.com",
        subject: "פנייה חדשה",
        body: "שלום, אני מעוניין לקבל מידע נוסף",
      };
    case "google_sheet_new_row":
    case "google_sheet_row_updated":
      return {
        row_data: { שם: "ישראל ישראלי", טלפון: "0501234567", אימייל: "test@example.com" },
        row_index: 2,
      };
    case "google_calendar_event_created":
      return {
        event_title: "פגישה עם לקוח",
        event_start: new Date().toISOString(),
        attendees: ["test@example.com"],
      };
    case "google_form_submitted":
      return {
        form_data: { שם: "ישראל ישראלי", טלפון: "0501234567" },
        form_id: "test_form",
      };
    case "scheduled_daily":
    case "scheduled_weekly":
    case "scheduled_monthly":
      return {};
    case "facebook_lead_form":
      return {
        contact_name: "ישראל ישראלי",
        phone: "0501234567",
        email: "test@example.com",
        source: "facebook",
        notes: "--- שדות טופס פייסבוק ---\nfb_full_name: ישראל ישראלי\nfb_phone_number: 0501234567",
      };
    case "instagram_message":
      return {
        from_username: "user123",
        message: "שלום, ראיתי את הפרסום שלכם",
        from_name: "ישראל ישראלי",
      };
    case "inbound_webhook_task":
    case "inbound_webhook_lead":
      return {
        contact_name: "ישראל ישראלי",
        phone: "0501234567",
        email: "test@example.com",
        custom_field: "ערך מותאם",
      };
    case "stripe_payment":
      return {
        amount: 9900,
        currency: "ils",
        customer_email: "customer@example.com",
        customer_name: "ישראל ישראלי",
        status: "succeeded",
      };
    case "manual_command":
      return {
        command_text: "הרץ בדיקה ידנית",
        user_name: "מנהל מערכת",
      };
    default:
      return {};
  }
}

// ─── Helper: get field definitions per trigger type ──────────────────────────

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "json";
  placeholder?: string;
  options?: { value: string; label: string }[];
}

function getFieldDefs(triggerType: string): FieldDef[] {
  switch (triggerType) {
    case "lead_created":
    case "lead_updated":
    case "lead_status_changed":
    case "lead_note_added":
    case "lead_inactive_days":
      return [
        { key: "contact_name", label: "שם ליד", type: "text", placeholder: "ישראל ישראלי" },
        { key: "phone", label: "טלפון", type: "text", placeholder: "0501234567" },
        { key: "email", label: "אימייל", type: "text", placeholder: "test@example.com" },
        { key: "source", label: "מקור", type: "select", options: [
          { value: "facebook", label: "פייסבוק" },
          { value: "instagram", label: "אינסטגרם" },
          { value: "website", label: "אתר" },
          { value: "referral", label: "הפניה" },
          { value: "other", label: "אחר" },
        ]},
        { key: "notes", label: "הערות", type: "textarea", placeholder: "הערות נוספות..." },
      ];
    case "client_created":
    case "client_status_changed":
    case "client_note_added":
      return [
        { key: "contact_name", label: "שם לקוח", type: "text", placeholder: "לקוח לדוגמה" },
        { key: "phone", label: "טלפון", type: "text", placeholder: "0521234567" },
        { key: "email", label: "אימייל", type: "text", placeholder: "client@example.com" },
      ];
    case "task_created":
    case "task_status_changed":
    case "task_completed":
    case "task_assigned":
    case "task_overdue":
      return [
        { key: "title", label: "כותרת משימה", type: "text", placeholder: "משימה לדוגמה" },
        { key: "description", label: "תיאור", type: "textarea", placeholder: "תיאור המשימה" },
        { key: "status", label: "סטאטוס", type: "select", options: [
          { value: "pending", label: "ממתין" },
          { value: "in_progress", label: "בביצוע" },
          { value: "completed", label: "הושלם" },
        ]},
      ];
    case "meeting_created":
    case "meeting_updated":
    case "meeting_cancelled":
      return [
        { key: "title", label: "כותרת פגישה", type: "text", placeholder: "פגישה לדוגמה" },
        { key: "meeting_date", label: "תאריך", type: "text", placeholder: "2024-01-01" },
        { key: "meeting_time", label: "שעה", type: "text", placeholder: "10:00" },
        { key: "location", label: "מיקום", type: "text", placeholder: "משרד" },
        { key: "contact_name", label: "שם איש קשר", type: "text", placeholder: "ישראל ישראלי" },
        { key: "phone", label: "טלפון", type: "text", placeholder: "0501234567" },
      ];
    case "whatsapp_message_received":
    case "carmen_whatsapp_session":
      return [
        { key: "phone", label: "מספר טלפון (עם קידומת)", type: "text", placeholder: "972501234567" },
        { key: "message", label: "תוכן ההודעה", type: "textarea", placeholder: "שלום, אני מעוניין לקבל מידע" },
        { key: "from_name", label: "שם השולח", type: "text", placeholder: "ישראל ישראלי" },
      ];
    case "telegram_message_received":
      return [
        { key: "chat_id", label: "Chat ID", type: "text", placeholder: "123456789" },
        { key: "message", label: "תוכן ההודעה", type: "textarea", placeholder: "שלום, אני מעוניין לקבל מידע" },
        { key: "from_name", label: "שם השולח", type: "text", placeholder: "ישראל ישראלי" },
      ];
    case "email_received":
      return [
        { key: "from", label: "מאימייל", type: "text", placeholder: "sender@example.com" },
        { key: "subject", label: "נושא", type: "text", placeholder: "פנייה חדשה" },
        { key: "body", label: "תוכן", type: "textarea", placeholder: "תוכן המייל..." },
      ];
    case "facebook_lead_form":
      return [
        { key: "contact_name", label: "שם", type: "text", placeholder: "ישראל ישראלי" },
        { key: "phone", label: "טלפון", type: "text", placeholder: "0501234567" },
        { key: "email", label: "אימייל", type: "text", placeholder: "test@example.com" },
        { key: "notes", label: "שדות טופס (fb_*)", type: "textarea", placeholder: "--- שדות טופס פייסבוק ---\nfb_full_name: ישראל ישראלי" },
      ];
    case "instagram_message":
      return [
        { key: "from_username", label: "שם משתמש", type: "text", placeholder: "user123" },
        { key: "message", label: "הודעה", type: "textarea", placeholder: "שלום, ראיתי את הפרסום" },
      ];
    case "inbound_webhook_task":
    case "inbound_webhook_lead":
      return [
        { key: "_json_payload", label: "JSON Payload", type: "json", placeholder: '{"contact_name": "ישראל ישראלי", "phone": "0501234567"}' },
      ];
    case "stripe_payment":
      return [
        { key: "amount", label: "סכום (אגורות)", type: "text", placeholder: "9900" },
        { key: "customer_email", label: "אימייל לקוח", type: "text", placeholder: "customer@example.com" },
        { key: "customer_name", label: "שם לקוח", type: "text", placeholder: "ישראל ישראלי" },
      ];
    case "manual_command":
      return [
        { key: "command_text", label: "פקודה", type: "textarea", placeholder: "הרץ בדיקה ידנית..." },
        { key: "user_name", label: "שם משתמש", type: "text", placeholder: "מנהל מערכת" },
      ];
    case "scheduled_daily":
    case "scheduled_weekly":
    case "scheduled_monthly":
      return []; // No inputs needed — just run
    default:
      return [
        { key: "_json_payload", label: "JSON Payload", type: "json", placeholder: '{}' },
      ];
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TriggerTestPanel({
  open,
  onOpenChange,
  automationId,
  automationName,
  triggerType,
  triggerConfig,
}: TriggerTestPanelProps) {
  const { tenantId } = useCurrentTenant();
  const { toast } = useToast();

  const [payload, setPayload] = useState<Record<string, any>>(() =>
    getDefaultPayload(triggerType)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showRawResult, setShowRawResult] = useState(false);

  // For lead/client/task pickers
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [useExistingEntity, setUseExistingEntity] = useState(false);

  const isLeadTrigger = triggerType.startsWith("lead_");
  const isClientTrigger = triggerType.startsWith("client_");
  const isTaskTrigger = triggerType.startsWith("task_");
  const isScheduled = triggerType.startsWith("scheduled_");
  const isJsonOnly = ["inbound_webhook_task", "inbound_webhook_lead"].includes(triggerType);

  // Fetch leads for picker
  const { data: leads } = useQuery({
    queryKey: ["leads-for-test", tenantId, searchQuery],
    queryFn: async () => {
      if (!tenantId || !isLeadTrigger) return [];
      let q = supabase
        .from("leads")
        .select("id, contact_name, phone, email, source, status, notes")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (searchQuery) {
        q = q.ilike("contact_name", `%${searchQuery}%`);
      }
      const { data } = await q;
      return data || [];
    },
    enabled: !!tenantId && isLeadTrigger && useExistingEntity,
  });

  // Fetch clients for picker
  const { data: clients } = useQuery({
    queryKey: ["clients-for-test", tenantId, searchQuery],
    queryFn: async () => {
      if (!tenantId || !isClientTrigger) return [];
      let q = supabase
        .from("clients")
        .select("id, contact_name, phone, email, status")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (searchQuery) {
        q = q.ilike("contact_name", `%${searchQuery}%`);
      }
      const { data } = await q;
      return data || [];
    },
    enabled: !!tenantId && isClientTrigger && useExistingEntity,
  });

  // Fetch tasks for picker
  const { data: tasks } = useQuery({
    queryKey: ["tasks-for-test", tenantId, searchQuery],
    queryFn: async () => {
      if (!tenantId || !isTaskTrigger) return [];
      let q = supabase
        .from("tasks")
        .select("id, title, description, status")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (searchQuery) {
        q = q.ilike("title", `%${searchQuery}%`);
      }
      const { data } = await q;
      return data || [];
    },
    enabled: !!tenantId && isTaskTrigger && useExistingEntity,
  });

  const fieldDefs = getFieldDefs(triggerType);

  const handleFieldChange = (key: string, value: string) => {
    if (key === "_json_payload") {
      try {
        const parsed = JSON.parse(value);
        setPayload(parsed);
        setJsonError(null);
      } catch {
        setJsonError("JSON לא תקין");
        setPayload((prev) => ({ ...prev, _raw_json: value }));
      }
    } else {
      setPayload((prev) => ({ ...prev, [key]: value }));
    }
  };

  const handleSelectEntity = (entity: any) => {
    setSelectedEntityId(entity.id);
    // Pre-fill payload from entity
    const newPayload: Record<string, any> = { ...getDefaultPayload(triggerType) };
    if (isLeadTrigger) {
      newPayload.contact_name = entity.contact_name || "";
      newPayload.phone = entity.phone || "";
      newPayload.email = entity.email || "";
      newPayload.source = entity.source || "other";
      newPayload.status = entity.status || "new";
      newPayload.notes = entity.notes || "";
      newPayload._lead_id = entity.id;
    } else if (isClientTrigger) {
      newPayload.contact_name = entity.contact_name || "";
      newPayload.phone = entity.phone || "";
      newPayload.email = entity.email || "";
      newPayload.status = entity.status || "active";
      newPayload._client_id = entity.id;
    } else if (isTaskTrigger) {
      newPayload.title = entity.title || "";
      newPayload.description = entity.description || "";
      newPayload.status = entity.status || "pending";
      newPayload._task_id = entity.id;
    }
    setPayload(newPayload);
  };

  const handleRun = async () => {
    if (!tenantId) return;
    setIsRunning(true);
    setTestResult(null);

    try {
      // Build the final payload
      let finalPayload = { ...payload };
      // Remove internal keys
      delete finalPayload._raw_json;

      const { data, error } = await supabase.functions.invoke("trigger-automation", {
        body: {
          automationId,
          trigger_type: triggerType,
          tenant_id: tenantId,
          payload: finalPayload,
          test: true, // bypass trigger validation
        },
      });

      if (error) throw error;

      setTestResult(data);

      const success = data?.success !== false && !data?.error;
      toast({
        title: success ? "הטריגר הופעל בהצלחה" : "הטריגר נכשל",
        description: success
          ? `האוטומציה "${automationName}" הורצה`
          : data?.error || "שגיאה לא ידועה",
        variant: success ? "default" : "destructive",
      });
    } catch (err: any) {
      setTestResult({ error: err.message });
      toast({
        title: "שגיאה בהפעלת הטריגר",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const triggerLabel = ACTION_TYPE_LABELS[triggerType] || triggerType;
  const entityList = isLeadTrigger ? leads : isClientTrigger ? clients : isTaskTrigger ? tasks : [];
  const canPickEntity = (isLeadTrigger || isClientTrigger || isTaskTrigger) && useExistingEntity;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[380px] sm:w-[420px] overflow-y-auto" dir="rtl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-right">
            <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-muted">
              <NodeIconDisplay stepType="trigger" actionType={triggerType} size={18} />
            </div>
            בדיקת טריגר
          </SheetTitle>
          <SheetDescription className="text-right">
            <span className="font-medium text-foreground">{triggerLabel}</span>
            <br />
            <span className="text-xs">הרצה ידנית של האוטומציה: {automationName}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Scheduled triggers: just a run button */}
          {isScheduled && (
            <div className="rounded-lg border bg-muted/30 p-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                טריגר מתוזמן — אין צורך בפרמטרים. לחץ הרץ כדי להפעיל את האוטומציה כעת.
              </p>
            </div>
          )}

          {/* Entity picker toggle for lead/client/task */}
          {(isLeadTrigger || isClientTrigger || isTaskTrigger) && (
            <div className="flex items-center gap-2">
              <Button
                variant={useExistingEntity ? "default" : "outline"}
                size="sm"
                onClick={() => setUseExistingEntity(true)}
                className="flex-1"
              >
                בחר מהמערכת
              </Button>
              <Button
                variant={!useExistingEntity ? "default" : "outline"}
                size="sm"
                onClick={() => setUseExistingEntity(false)}
                className="flex-1"
              >
                הזן ידנית
              </Button>
            </div>
          )}

          {/* Entity picker */}
          {canPickEntity && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isLeadTrigger ? "חפש ליד..." : isClientTrigger ? "חפש לקוח..." : "חפש משימה..."}
                  className="pr-9 text-right"
                />
              </div>
              <ScrollArea className="h-[160px] rounded-lg border">
                <div className="p-1 space-y-0.5">
                  {(entityList as any[] || []).map((entity: any) => (
                    <button
                      key={entity.id}
                      className={cn(
                        "w-full text-right px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors",
                        selectedEntityId === entity.id && "bg-primary/10 border border-primary/30"
                      )}
                      onClick={() => handleSelectEntity(entity)}
                    >
                      <p className="font-medium truncate">
                        {entity.contact_name || entity.title || entity.id}
                      </p>
                      {entity.phone && (
                        <p className="text-xs text-muted-foreground">{entity.phone}</p>
                      )}
                    </button>
                  ))}
                  {(entityList as any[] || []).length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-4">לא נמצאו תוצאות</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Manual fields */}
          {!isScheduled && (!canPickEntity || !useExistingEntity) && (
            <div className="space-y-4">
              {isJsonOnly ? (
                <div className="space-y-2">
                  <Label className="text-right block">JSON Payload</Label>
                  <Textarea
                    value={JSON.stringify(payload, null, 2)}
                    onChange={(e) => handleFieldChange("_json_payload", e.target.value)}
                    placeholder='{"contact_name": "ישראל ישראלי"}'
                    className="font-mono text-xs min-h-[140px] text-left"
                    dir="ltr"
                  />
                  {jsonError && (
                    <p className="text-xs text-destructive">{jsonError}</p>
                  )}
                </div>
              ) : (
                fieldDefs.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="text-right block text-sm">{field.label}</Label>
                    {field.type === "textarea" ? (
                      <Textarea
                        value={String(payload[field.key] ?? "")}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="text-right min-h-[80px] resize-none text-sm"
                      />
                    ) : field.type === "select" ? (
                      <Select
                        value={String(payload[field.key] ?? "")}
                        onValueChange={(v) => handleFieldChange(field.key, v)}
                      >
                        <SelectTrigger className="text-right">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={String(payload[field.key] ?? "")}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="text-right text-sm"
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Run button */}
          <Button
            className="w-full"
            onClick={handleRun}
            disabled={isRunning || !!jsonError}
            size="lg"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                מריץ...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 ml-2" />
                הרץ בדיקה
              </>
            )}
          </Button>

          {/* Results */}
          {testResult && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                {testResult.error ? (
                  <>
                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                    <span className="text-sm font-medium text-destructive">נכשל</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    <span className="text-sm font-medium text-green-600">הצליח</span>
                  </>
                )}
              </div>

              {testResult.error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                  {testResult.error}
                </div>
              )}

              {/* Step results */}
              {testResult.steps && testResult.steps.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">צעדים שהורצו:</p>
                  {testResult.steps.map((step, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center gap-2 text-xs rounded-lg px-3 py-2 border",
                        step.success
                          ? "bg-green-500/10 border-green-500/30"
                          : "bg-destructive/10 border-destructive/30"
                      )}
                    >
                      {step.success ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      )}
                      <span className="font-medium">
                        {ACTION_TYPE_LABELS[step.action_type || ""] || step.action_type || `צעד ${i + 1}`}
                      </span>
                      {step.error && (
                        <span className="text-destructive truncate mr-auto">{step.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Agent output */}
              {testResult.agent_output && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                  <p className="text-xs font-semibold text-orange-600 mb-1">פלט סוכן:</p>
                  <p className="text-xs text-foreground whitespace-pre-wrap">{testResult.agent_output}</p>
                </div>
              )}

              {/* Raw result toggle */}
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowRawResult((v) => !v)}
              >
                {showRawResult ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                תוצאה גולמית
              </button>
              {showRawResult && (
                <pre className="text-[10px] bg-muted rounded-lg p-3 overflow-auto max-h-[200px] text-left" dir="ltr">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Info note */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              הבדיקה מריצה את האוטומציה הספציפית הזו בלבד, ללא השפעה על אוטומציות אחרות.
              פעולות אמיתיות (WhatsApp, אימייל, וכו') יבוצעו בפועל.
            </span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

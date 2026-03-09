import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Facebook, CheckCircle2, Search, Bot, Plus, Sparkles, Copy, FileText, Phone, Scissors, Languages, RotateCcw, ChevronDown, ClipboardCopy } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FlowNodeData } from "./FlowNode";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useToast } from "@/hooks/use-toast";

const TRIGGER_OPTIONS = [
  { value: "lead_created", label: "ליד נוצר" },
  { value: "lead_status_changed", label: "סטטוס ליד השתנה" },
  { value: "client_created", label: "לקוח נוצר" },
  { value: "client_status_changed", label: "סטטוס לקוח השתנה" },
  { value: "task_status_changed", label: "סטטוס משימה השתנה" },
  { value: "task_assigned", label: "משימה שוייכה" },
  { value: "meeting_created", label: "נוצרה פגישה" },
  { value: "task_overdue", label: "משימה באיחור" },
  { value: "inbound_webhook_task", label: "Webhook נכנס" },
  { value: "manual_command", label: "פקודה ידנית (צ'אט)" },
  { value: "whatsapp_message_received", label: "הודעת WhatsApp נכנסת" },
];

const ACTION_OPTIONS = [
  { value: "send_whatsapp", label: "שלח WhatsApp (ManyChat)" },
  { value: "send_greenapi_message", label: "שלח WhatsApp (Green API)" },
  { value: "create_task", label: "צור משימה" },
  { value: "add_lead_update", label: "הוסף עדכון לליד" },
  { value: "add_client_update", label: "הוסף עדכון ללקוח" },
  { value: "create_manychat_subscriber", label: "צור subscriber ב-ManyChat" },
  { value: "update_status", label: "שנה סטטוס" },
  { value: "webhook", label: "Webhook" },
  { value: "email", label: "אימייל" },
  { value: "notification", label: "התראה" },
];

const DELAY_UNITS = [
  { value: "minutes", label: "דקות" },
  { value: "hours", label: "שעות" },
  { value: "days", label: "ימים" },
];

const LEAD_SOURCE_OPTIONS = [
  { value: "any", label: "ליד חדש בארגון (כל מקור)" },
  { value: "facebook_form", label: "ליד מטופס ליד (Facebook)" },
];

// Available fields by trigger type
function getAvailableFields(triggerType: string | undefined, triggerConfig?: Record<string, any>): { key: string; label: string }[] {
  let fields: { key: string; label: string }[] = [];
  switch (triggerType) {
    case "lead_created":
      fields = [
        { key: "contact_name", label: "שם איש קשר" },
        { key: "company_name", label: "שם חברה" },
        { key: "phone", label: "טלפון" },
        { key: "email", label: "אימייל" },
        { key: "source", label: "מקור" },
        { key: "notes", label: "הערות" },
      ];
      break;
    case "lead_status_changed":
      fields = [
        { key: "contact_name", label: "שם איש קשר" },
        { key: "company_name", label: "שם חברה" },
        { key: "phone", label: "טלפון" },
        { key: "email", label: "אימייל" },
        { key: "old_status", label: "סטטוס קודם" },
        { key: "new_status", label: "סטטוס חדש" },
      ];
      break;
    case "client_created":
    case "client_status_changed":
      fields = [
        { key: "name", label: "שם לקוח" },
        { key: "contact_name", label: "שם איש קשר" },
        { key: "phone", label: "טלפון" },
        { key: "email", label: "אימייל" },
      ];
      break;
    case "task_assigned":
    case "task_status_changed":
    case "task_overdue":
      fields = [
        { key: "title", label: "כותרת משימה" },
        { key: "assignee_name", label: "שם מבצע" },
      ];
      break;
    case "meeting_created":
      fields = [
        { key: "title", label: "כותרת פגישה" },
        { key: "date", label: "תאריך" },
      ];
      break;
    case "manual_command":
      fields = [
        { key: "command_text", label: "טקסט הפקודה" },
        { key: "user_name", label: "שם המשתמש" },
      ];
      break;
    case "whatsapp_message_received":
      fields = [
        { key: "sender_name", label: "שם השולח" },
        { key: "sender_phone", label: "טלפון השולח" },
        { key: "message_text", label: "תוכן ההודעה" },
        { key: "group_id", label: "מזהה קבוצה" },
        { key: "group_name", label: "שם הקבוצה" },
        { key: "group_invite_link", label: "קישור הזמנה לקבוצה" },
        { key: "group_chat_id", label: "מזהה צ'אט קבוצה (WhatsApp)" },
        { key: "contact_type", label: "סוג איש קשר (client/lead/group)" },
        { key: "contact_id", label: "מזהה איש קשר" },
        { key: "contact_name", label: "שם איש קשר" },
        { key: "connection_user_id", label: "מזהה חיבור" },
      ];
      break;
    default:
      fields = [
        { key: "contact_name", label: "שם איש קשר" },
        { key: "phone", label: "טלפון" },
        { key: "email", label: "אימייל" },
      ];
      break;
  }

  // Add Facebook form fields if trigger is lead_created with facebook_form source
  if (triggerType === "lead_created" && triggerConfig?.lead_source === "facebook_form") {
    const fbFields = triggerConfig?.facebook_form_fields as Array<{ key: string; label: string; type?: string }> | undefined;
    if (fbFields && Array.isArray(fbFields)) {
      const existingKeys = new Set(fields.map(f => f.key));
      for (const fbField of fbFields) {
        const fieldKey = `fb_${fbField.key}`;
        if (!existingKeys.has(fieldKey)) {
          fields.push({ key: fieldKey, label: `📋 ${fbField.label || fbField.key}` });
        }
      }
    }
  }

  return fields;
}

interface StepConfigPanelProps {
  node: FlowNodeData | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (nodeId: string, updates: Partial<FlowNodeData>) => void;
  allNodes?: FlowNodeData[];
}

interface FacebookPage {
  id: string;
  name: string;
  access_token?: string;
}

interface FacebookFormField {
  key: string;
  label: string;
  type?: string;
}

interface FacebookForm {
  id: string;
  name: string;
  status: string;
  fields?: FacebookFormField[];
}

export function StepConfigPanel({ node, open, onClose, onUpdate, allNodes = [] }: StepConfigPanelProps) {
  const { tenant } = useCurrentTenant();
  const tenantId = tenant?.id;

  if (!node) return null;

  // Detect trigger type from flow
  const triggerNode = allNodes.find((n) => n.step_type === "trigger");
  const triggerType = triggerNode?.action_type;
  const triggerConfig = triggerNode?.configuration;
  const availableFields = getAvailableFields(triggerType, triggerConfig);

  const isLeadCreatedTrigger = node.step_type === "trigger" && node.action_type === "lead_created";
  const leadSource = node.configuration?.lead_source || "any";

  const handleActionTypeChange = (value: string) => {
    onUpdate(node.id, { action_type: value });
  };

  const handleLabelChange = (value: string) => {
    onUpdate(node.id, { label: value });
  };

  const handleConfigChange = (key: string, value: any) => {
    onUpdate(node.id, {
      configuration: { ...node.configuration, [key]: value },
    });
  };

  const handleBulkConfigChange = (updates: Record<string, any>) => {
    onUpdate(node.id, {
      configuration: { ...node.configuration, ...updates },
    });
  };

  const options = node.step_type === "trigger" ? TRIGGER_OPTIONS : ACTION_OPTIONS;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-[360px] sm:w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-right">
            {node.step_type === "trigger" ? "הגדרת טריגר" :
             node.step_type === "action" ? "הגדרת פעולה" :
             node.step_type === "condition" ? "הגדרת תנאי" :
             node.step_type === "agent" ? "הגדרת סוכן AI" :
             "הגדרת השהייה"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          {/* Label */}
          <div className="space-y-2">
            <Label className="text-right block">שם הצעד</Label>
            <Input
              value={node.label || ""}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="שם מותאם אישית (אופציונלי)"
              className="text-right"
            />
          </div>

          {/* Action type selector */}
          {(node.step_type === "trigger" || node.step_type === "action") && (
            <div className="space-y-2">
              <Label className="text-right block">
                {node.step_type === "trigger" ? "סוג טריגר" : "סוג פעולה"}
              </Label>
              <Select value={node.action_type || ""} onValueChange={handleActionTypeChange}>
                <SelectTrigger className="text-right">
                  <SelectValue placeholder="בחר..." />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Lead source sub-config when lead_created trigger */}
          {isLeadCreatedTrigger && (
            <LeadSourceConfig
              tenantId={tenantId}
              leadSource={leadSource}
              configuration={node.configuration}
              onConfigChange={handleConfigChange}
              onBulkConfigChange={handleBulkConfigChange}
            />
          )}

          {/* WhatsApp message received trigger config */}
          {node.step_type === "trigger" && node.action_type === "whatsapp_message_received" && (
            <WhatsAppTriggerConfig
              tenantId={tenantId}
              configuration={node.configuration}
              onConfigChange={handleConfigChange}
            />
          )}

          {/* Delay config */}
          {node.step_type === "delay" && (
            <>
              <div className="space-y-2">
                <Label className="text-right block">זמן המתנה</Label>
                <Input
                  type="number"
                  min={1}
                  value={node.configuration?.delay_value || ""}
                  onChange={(e) => handleConfigChange("delay_value", parseInt(e.target.value) || 0)}
                  placeholder="כמות"
                  className="text-right"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-right block">יחידה</Label>
                <Select
                  value={node.configuration?.delay_unit || "minutes"}
                  onValueChange={(v) => handleConfigChange("delay_unit", v)}
                >
                  <SelectTrigger className="text-right">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELAY_UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Condition config */}
          {node.step_type === "condition" && (
            <div className="space-y-2">
              <Label className="text-right block">תנאי (ביטוי)</Label>
              <Textarea
                value={node.configuration?.condition_expression || ""}
                onChange={(e) => handleConfigChange("condition_expression", e.target.value)}
                placeholder="למשל: lead.status === 'new'"
                className="text-right font-mono text-xs"
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">
                אם התנאי מתקיים - הענף הראשי. אם לא - הענף החלופי.
              </p>
            </div>
          )}

          {/* Agent config */}
          {node.step_type === "agent" && (
            <AgentStepConfig
              tenantId={tenantId}
              configuration={node.configuration}
              onConfigChange={handleConfigChange}
              availableFields={availableFields}
            />
          )}

          {/* Webhook URL for webhook action */}
          {node.action_type === "webhook" && (
            <div className="space-y-2">
              <Label className="text-right block">כתובת URL</Label>
              <Input
                value={node.configuration?.url || ""}
                onChange={(e) => handleConfigChange("url", e.target.value)}
                placeholder="https://..."
                dir="ltr"
              />
            </div>
          )}

          {/* Message template for ManyChat WhatsApp */}
          {node.action_type === "send_whatsapp" && (
            <div className="space-y-2">
              <Label className="text-right block">תבנית הודעה</Label>
              <Textarea
                value={node.configuration?.message_template || ""}
                onChange={(e) => handleConfigChange("message_template", e.target.value)}
                placeholder="שלום {{contact_name}}..."
                className="text-right"
                rows={4}
              />
              <p className="text-xs text-muted-foreground text-right">
                משתנים זמינים: {availableFields.map((f) => `{{${f.key}}}`).join(", ")}
              </p>
            </div>
          )}

          {/* Green API WhatsApp config with connection selector + field mapping */}
          {node.action_type === "send_greenapi_message" && (
            <GreenAPIActionConfig
              tenantId={tenantId}
              configuration={node.configuration}
              availableFields={availableFields}
              onConfigChange={handleConfigChange}
            />
          )}

          {/* Create Task config */}
          {node.action_type === "create_task" && (
            <CreateTaskActionConfig
              tenantId={tenantId}
              configuration={node.configuration}
              availableFields={availableFields}
              onConfigChange={handleConfigChange}
            />
          )}

          {/* Status update config */}
          {node.action_type === "update_status" && (
            <>
              <div className="space-y-2">
                <Label className="text-right block">סוג ישות</Label>
                <Select
                  value={node.configuration?.entity || ""}
                  onValueChange={(v) => handleConfigChange("entity", v)}
                >
                  <SelectTrigger className="text-right">
                    <SelectValue placeholder="בחר..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">ליד</SelectItem>
                    <SelectItem value="task">משימה</SelectItem>
                    <SelectItem value="client">לקוח</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-right block">סטטוס חדש</Label>
                <Input
                  value={node.configuration?.status || ""}
                  onChange={(e) => handleConfigChange("status", e.target.value)}
                  placeholder="הסטטוס החדש"
                  className="text-right"
                />
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Sub-component for Green API action configuration
function GreenAPIActionConfig({
  tenantId,
  configuration,
  availableFields,
  onConfigChange,
}: {
  tenantId: string | undefined;
  configuration: Record<string, any>;
  availableFields: { key: string; label: string }[];
  onConfigChange: (key: string, value: any) => void;
}) {
  const [cursorPos, setCursorPos] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch Green API integrations
  const { data: greenApiIntegrations, isLoading } = useQuery({
    queryKey: ["green-api-integrations-for-flow", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("id, integration_type, settings, is_active, user_id")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "green_api")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const phoneFields = availableFields.filter((f) =>
    ["phone", "email"].includes(f.key) || f.key.includes("phone")
  );

  const insertVariable = (fieldKey: string) => {
    const variable = `{{${fieldKey}}}`;
    const currentValue = configuration?.message_template || "";
    const pos = cursorPos ?? currentValue.length;
    const newValue = currentValue.slice(0, pos) + variable + currentValue.slice(pos);
    onConfigChange("message_template", newValue);
  };

  const greenApiMode = configuration?.green_api_mode || "tenant";
  const phoneMode = configuration?.phone_mode || "field";

  return (
    <div className="space-y-4">
      {/* Green API connection mode */}
      <div className="space-y-2">
        <Label className="text-right block">מקור חיבור Green API</Label>
        <RadioGroup
          value={greenApiMode}
          onValueChange={(v) => onConfigChange("green_api_mode", v)}
          className="flex gap-4 justify-end"
          dir="rtl"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="tenant" id="gapi-tenant" />
            <Label htmlFor="gapi-tenant" className="cursor-pointer text-sm">מהארגון</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="external" id="gapi-external" />
            <Label htmlFor="gapi-external" className="cursor-pointer text-sm">חיבור חיצוני</Label>
          </div>
        </RadioGroup>
      </div>

      {greenApiMode === "tenant" ? (
        <div className="space-y-2">
          <Label className="text-right block">חיבור Green API</Label>
          {isLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : greenApiIntegrations && greenApiIntegrations.length > 0 ? (
            <Select
              value={configuration?.green_api_integration_id || ""}
              onValueChange={(v) => onConfigChange("green_api_integration_id", v)}
            >
              <SelectTrigger className="text-right">
                <SelectValue placeholder="בחר חיבור..." />
              </SelectTrigger>
              <SelectContent>
                {greenApiIntegrations.map((integration) => {
                  const settings = integration.settings as Record<string, any> | null;
                  const name = settings?.instance_name || settings?.connection_name || "Green API";
                  return (
                    <SelectItem key={integration.id} value={integration.id}>
                      {name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          ) : (
            <div className="rounded-lg border border-dashed p-3 text-center">
              <p className="text-sm text-muted-foreground">אין חיבור Green API פעיל.</p>
              <p className="text-xs text-muted-foreground mt-1">הגדר חיבור בעמוד האינטגרציות.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground text-right">הזן פרטי חיבור Green API חיצוני:</p>
          <div className="space-y-2">
            <Label className="text-right block text-xs">Instance ID</Label>
            <Input
              value={configuration?.external_instance_id || ""}
              onChange={(e) => onConfigChange("external_instance_id", e.target.value)}
              placeholder="למשל: 7103..."
              dir="ltr"
              className="text-left"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-right block text-xs">API Token</Label>
            <Input
              value={configuration?.external_api_token || ""}
              onChange={(e) => onConfigChange("external_api_token", e.target.value)}
              placeholder="למשל: abc123..."
              dir="ltr"
              className="text-left"
              type="password"
            />
          </div>
        </div>
      )}

      {/* Phone mode toggle */}
      <div className="space-y-2">
        <Label className="text-right block">מספר טלפון לשליחה</Label>
        <RadioGroup
          value={phoneMode}
          onValueChange={(v) => onConfigChange("phone_mode", v)}
          className="flex gap-4 justify-end"
          dir="rtl"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="field" id="phone-field" />
            <Label htmlFor="phone-field" className="cursor-pointer text-sm">שדה דינמי</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="manual" id="phone-manual" />
            <Label htmlFor="phone-manual" className="cursor-pointer text-sm">מספר ידני</Label>
          </div>
        </RadioGroup>
      </div>

      {phoneMode === "field" ? (
        <div className="space-y-2">
          <Label className="text-right block">שדה מספר טלפון</Label>
          <Select
            value={configuration?.phone_field || ""}
            onValueChange={(v) => onConfigChange("phone_field", v)}
          >
            <SelectTrigger className="text-right">
              <SelectValue placeholder="בחר שדה..." />
            </SelectTrigger>
            <SelectContent>
              {availableFields.map((field) => (
                <SelectItem key={field.key} value={field.key}>
                  {field.label} ({`{{${field.key}}}`})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground text-right">
            השדה שממנו יילקח מספר הטלפון לשליחת ההודעה
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-right block">מספר טלפון</Label>
          <Input
            value={configuration?.manual_phone || ""}
            onChange={(e) => onConfigChange("manual_phone", e.target.value)}
            placeholder="050-1234567"
            dir="ltr"
            className="text-left"
          />
          <p className="text-xs text-muted-foreground text-right">
            הזן מספר טלפון קבוע שאליו תישלח ההודעה
          </p>
        </div>
      )}

      {/* Message template with dynamic variables */}
      <div className="space-y-2">
        <Label className="text-right block">תבנית הודעה</Label>
        <Textarea
          ref={textareaRef}
          value={configuration?.message_template || ""}
          onChange={(e) => onConfigChange("message_template", e.target.value)}
          onSelect={(e) => setCursorPos((e.target as HTMLTextAreaElement).selectionStart)}
          placeholder="שלום {{contact_name}}..."
          className="text-right"
          rows={4}
        />
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-right">הכנס משתנה:</p>
          {(() => {
            const systemFields = availableFields.filter((f) => !f.key.startsWith("fb_"));
            const fbFields = availableFields.filter((f) => f.key.startsWith("fb_"));
            return (
              <>
                {systemFields.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground text-right">שדות מערכת</p>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {systemFields.map((field) => (
                        <Button
                          key={field.key}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs h-6 px-2"
                          onClick={() => insertVariable(field.key)}
                        >
                          {field.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {fbFields.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-blue-500 text-right">שדות פייסבוק</p>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {fbFields.map((field) => (
                        <Button
                          key={field.key}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs h-6 px-2 border-blue-400 text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950/50"
                          onClick={() => insertVariable(field.key)}
                        >
                          {field.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 px-2 border-primary text-primary"
                  onClick={() => insertVariable("agent_output")}
                >
                  🤖 תוצאת סוכן AI
                </Button>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// AI Agent step configuration
const AI_ENGINES = [
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { value: "google/gemini-3-pro-preview", label: "Gemini 3 Pro" },
  { value: "openai/gpt-5", label: "GPT-5" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  { value: "openai/gpt-5-nano", label: "GPT-5 Nano" },
  { value: "openai/gpt-5.2", label: "GPT-5.2" },
];

const QUICK_TEMPLATES = [
  { icon: Phone, label: "📱 פרמוט טלפון", text: "פרמט את מספר הטלפון {{phone}} לפורמט בינלאומי +972XXXXXXXXX. החזר רק את המספר המפורמט." },
  { icon: Scissors, label: "✂️ הפרדת שם", text: "הפרד את {{contact_name}} לשם פרטי ושם משפחה. החזר JSON בפורמט: {\"first_name\": \"...\", \"last_name\": \"...\"}" },
  { icon: Languages, label: "🌐 תרגום לעברית", text: "תרגם את {{contact_name}} לעברית. החזר רק את השם המתורגם." },
  { icon: FileText, label: "📝 סיכום טקסט", text: "סכם את הטקסט הבא בצורה תמציתית:\n{{notes}}" },
  { icon: RotateCcw, label: "🔄 המרת פורמט", text: "המר את הנתונים הבאים לפורמט JSON מובנה:\n{{notes}}" },
];

const OUTPUT_FORMATS = [
  { value: "text", label: "טקסט חופשי" },
  { value: "single_reply", label: "תשובה אחת ישירה" },
  { value: "json", label: "JSON מובנה" },
  { value: "single_value", label: "ערך בודד" },
];

function AgentStepConfig({
  tenantId,
  configuration,
  onConfigChange,
  availableFields,
}: {
  tenantId: string | undefined;
  configuration: Record<string, any>;
  onConfigChange: (key: string, value: any) => void;
  availableFields: { key: string; label: string }[];
}) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const instructionRef = useRef<HTMLTextAreaElement>(null);

  const { data: agents, isLoading } = useQuery({
    queryKey: ["ai-agents", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("ai_agents" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tenantId,
  });

  const selectedAgent = agents?.find((a: any) => a.id === configuration?.agent_id);

  const insertVariableToInstruction = (fieldKey: string) => {
    const variable = `{{${fieldKey}}}`;
    const currentValue = configuration?.step_instruction || "";
    const textarea = instructionRef.current;
    const pos = textarea?.selectionStart ?? currentValue.length;
    const newValue = currentValue.slice(0, pos) + variable + currentValue.slice(pos);
    onConfigChange("step_instruction", newValue);
    // Restore cursor position after variable
    setTimeout(() => {
      if (textarea) {
        const newPos = pos + variable.length;
        textarea.selectionStart = newPos;
        textarea.selectionEnd = newPos;
        textarea.focus();
      }
    }, 0);
  };

  const applyTemplate = (templateText: string) => {
    onConfigChange("step_instruction", templateText);
    setShowTemplates(false);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-right block">בחר סוכן AI</Label>
        {isLoading ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : agents && agents.length > 0 ? (
          <Select
            value={configuration?.agent_id || ""}
            onValueChange={(v) => onConfigChange("agent_id", v)}
          >
            <SelectTrigger className="text-right">
              <SelectValue placeholder="בחר סוכן..." />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent: any) => (
                <SelectItem key={agent.id} value={agent.id}>
                  <div className="flex items-center gap-2">
                    <Bot className="h-3.5 w-3.5 text-orange-500" />
                    {agent.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="rounded-lg border border-dashed p-3 text-center">
            <Bot className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">אין סוכנים עדיין.</p>
            <p className="text-xs text-muted-foreground mt-1">צור סוכן AI חדש כדי להתחיל.</p>
          </div>
        )}
      </div>

      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => setShowCreateDialog(true)}
      >
        <Plus className="h-4 w-4" />
        צור סוכן חדש
      </Button>

      {/* Show selected agent details */}
      {selectedAgent && (
        <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium">{selectedAgent.name}</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-1 text-right">
            <p>מנוע: {AI_ENGINES.find(e => e.value === selectedAgent.engine)?.label || selectedAgent.engine}</p>
            {selectedAgent.personality && <p>אופי: {selectedAgent.personality.slice(0, 60)}...</p>}
            {selectedAgent.talent && <p>טלנט: {selectedAgent.talent.slice(0, 60)}...</p>}
          </div>
        </div>
      )}

      {/* Step Instruction */}
      {selectedAgent && (
        <div className="space-y-2 border-t pt-4">
          <Label className="text-right block font-medium">הוראה / משימה לשלב זה</Label>
          <Textarea
            ref={instructionRef}
            value={configuration?.step_instruction || ""}
            onChange={(e) => onConfigChange("step_instruction", e.target.value)}
            placeholder="מה הסוכן צריך לעשות? למשל: פרמט את הטלפון {{phone}} לפורמט +972..."
            className="text-right min-h-[100px]"
            rows={5}
          />

          {/* Insert variable buttons */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-right">הכנס משתנה:</p>
            {(() => {
              const systemFields = availableFields.filter((f) => !f.key.startsWith("fb_"));
              const fbFields = availableFields.filter((f) => f.key.startsWith("fb_"));
              return (
                <>
                  {systemFields.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground text-right">שדות מערכת</p>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {systemFields.map((field) => (
                          <Button
                            key={field.key}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs h-6 px-2"
                            onClick={() => insertVariableToInstruction(field.key)}
                          >
                            {field.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {fbFields.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium text-blue-500 text-right">שדות פייסבוק</p>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {fbFields.map((field) => (
                          <Button
                            key={field.key}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs h-6 px-2 border-blue-400 text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950/50"
                            onClick={() => insertVariableToInstruction(field.key)}
                          >
                            {field.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Quick Templates */}
          <div className="space-y-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs gap-1 h-7"
              onClick={() => setShowTemplates(!showTemplates)}
            >
              <Sparkles className="h-3 w-3" />
              {showTemplates ? "הסתר תבניות" : "תבניות מוכנות"}
            </Button>
            {showTemplates && (
              <div className="grid gap-1.5">
                {QUICK_TEMPLATES.map((tpl, i) => (
                  <Button
                    key={i}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-1.5 px-2 text-right justify-end"
                    onClick={() => applyTemplate(tpl.text)}
                  >
                    {tpl.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Output Format */}
          <div className="space-y-2 border-t pt-3">
            <Label className="text-right block">פורמט תשובה צפוי</Label>
            <Select
              value={configuration?.output_format || "text"}
              onValueChange={(v) => onConfigChange("output_format", v)}
            >
              <SelectTrigger className="text-right">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTPUT_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground text-right">
              {configuration?.output_format === "json" && "הסוכן יתבקש להחזיר תשובה בפורמט JSON בלבד"}
              {configuration?.output_format === "single_value" && "הסוכן יתבקש להחזיר ערך בודד ללא הסברים"}
              {configuration?.output_format === "single_reply" && "הסוכן יחזיר תשובה אחת קצרה וישירה, ללא חלופות/בדיחות"}
              {(!configuration?.output_format || configuration?.output_format === "text") && "הסוכן יחזיר טקסט חופשי"}
            </p>
          </div>
        </div>
      )}

      <CreateAgentDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        tenantId={tenantId}
        onCreated={(agentId: string) => {
          onConfigChange("agent_id", agentId);
          queryClient.invalidateQueries({ queryKey: ["ai-agents", tenantId] });
          setShowCreateDialog(false);
          toast({ title: "הסוכן נוצר בהצלחה!" });
        }}
      />
    </div>
  );
}

function CreateAgentDialog({
  open,
  onClose,
  tenantId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string | undefined;
  onCreated: (agentId: string) => void;
}) {
  const [name, setName] = useState("");
  const [engine, setEngine] = useState("google/gemini-2.5-flash");
  const [personality, setPersonality] = useState("");
  const [soul, setSoul] = useState("");
  const [talent, setTalent] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !name.trim()) throw new Error("שם הסוכן הוא שדה חובה");
      const { data, error } = await supabase
        .from("ai_agents" as any)
        .insert({
          tenant_id: tenantId,
          name: name.trim(),
          engine,
          personality: personality.trim() || null,
          soul: soul.trim() || null,
          talent: talent.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: (agentId) => {
      setName("");
      setEngine("google/gemini-2.5-flash");
      setPersonality("");
      setSoul("");
      setTalent("");
      onCreated(agentId);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <Bot className="h-5 w-5 text-orange-500" />
            יצירת סוכן AI חדש
          </DialogTitle>
          <DialogDescription className="text-right">
            הגדר את הסוכן עם שם, מנוע AI, אופי, נשמה וטלנט.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-right block">שם הסוכן *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="למשל: סוכן מכירות, סוכן תמיכה..."
              className="text-right"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-right block">מנוע AI</Label>
            <Select value={engine} onValueChange={setEngine}>
              <SelectTrigger className="text-right">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_ENGINES.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-right block">אופי</Label>
            <Textarea
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="תאר את האופי של הסוכן... למשל: ידידותי, מקצועי, סבלני, ישיר"
              className="text-right"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-right block">נשמה</Label>
            <Textarea
              value={soul}
              onChange={(e) => setSoul(e.target.value)}
              placeholder="מה מניע את הסוכן? מה הערכים שלו? למשל: עזרה ללקוחות, מקסום מכירות..."
              className="text-right"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-right block">טלנט</Label>
            <Textarea
              value={talent}
              onChange={(e) => setTalent(e.target.value)}
              placeholder="מה הסוכן טוב בו? למשל: משא ומתן, כתיבת תוכן שיווקי, ניתוח נתונים..."
              className="text-right"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-row-reverse sm:flex-row-reverse gap-2">
          <Button
            disabled={!name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 ml-2" />
            )}
            {createMutation.isPending ? "יוצר..." : "צור סוכן"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Sub-component for WhatsApp message received trigger configuration
function WhatsAppTriggerConfig({
  tenantId,
  configuration,
  onConfigChange,
}: {
  tenantId: string | undefined;
  configuration: Record<string, any>;
  onConfigChange: (key: string, value: any) => void;
}) {
  const sourceFilter = configuration?.source_filter || "all";

  // Fetch WhatsApp groups
  const { data: groups } = useQuery({
    queryKey: ["whatsapp-groups-for-trigger", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("whatsapp_groups")
        .select("id, group_name, group_chat_id")
        .eq("tenant_id", tenantId)
        .order("group_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch chat tags
  const { data: tags } = useQuery({
    queryKey: ["chat-tags-for-trigger", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("chat_tags")
        .select("id, name, color")
        .eq("tenant_id", tenantId)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch Green API integrations
  const { data: greenApiIntegrations } = useQuery({
    queryKey: ["green-api-integrations-for-trigger", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("id, settings, is_active, user_id, instance_id")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "green_api")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  return (
    <div className="space-y-4">
      {/* Source filter */}
      <div className="space-y-2">
        <Label className="text-right block">מקור הודעות</Label>
        <Select
          value={sourceFilter}
          onValueChange={(v) => onConfigChange("source_filter", v)}
        >
          <SelectTrigger className="text-right">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל ההודעות</SelectItem>
            <SelectItem value="all_groups">כל הקבוצות</SelectItem>
            <SelectItem value="all_groups_except">כל הקבוצות חוץ מ...</SelectItem>
            <SelectItem value="multiple_groups">קבוצות מרובות</SelectItem>
            <SelectItem value="group">קבוצה ספציפית</SelectItem>
            <SelectItem value="tagged_contact">איש קשר מתויג</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Single group selector */}
      {sourceFilter === "group" && (
        <div className="space-y-2">
          <Label className="text-right block">בחר קבוצה</Label>
          <Select
            value={configuration?.group_id || ""}
            onValueChange={(v) => onConfigChange("group_id", v)}
          >
            <SelectTrigger className="text-right">
              <SelectValue placeholder="בחר קבוצה..." />
            </SelectTrigger>
            <SelectContent>
              {(groups || []).map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.group_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Multiple groups selector */}
      {sourceFilter === "multiple_groups" && (
        <div className="space-y-2">
          <Label className="text-right block">בחר קבוצות</Label>
          <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1">
            {(groups || []).map((g) => {
              const selectedIds: string[] = configuration?.selected_group_ids || [];
              const isSelected = selectedIds.includes(g.id);
              return (
                <label key={g.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded p-1 justify-end">
                  <span className="text-sm">{g.group_name}</span>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      const newIds = checked
                        ? [...selectedIds, g.id]
                        : selectedIds.filter((id: string) => id !== g.id);
                      onConfigChange("selected_group_ids", newIds);
                    }}
                  />
                </label>
              );
            })}
            {(!groups || groups.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-2">אין קבוצות</p>
            )}
          </div>
          {(configuration?.selected_group_ids?.length || 0) > 0 && (
            <p className="text-xs text-muted-foreground text-right">
              {configuration.selected_group_ids.length} קבוצות נבחרו
            </p>
          )}
        </div>
      )}

      {/* Exclude groups selector */}
      {sourceFilter === "all_groups_except" && (
        <div className="space-y-2">
          <Label className="text-right block">קבוצות להחרגה</Label>
          <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1">
            {(groups || []).map((g) => {
              const excludedIds: string[] = configuration?.excluded_group_ids || [];
              const isExcluded = excludedIds.includes(g.id);
              return (
                <label key={g.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded p-1 justify-end">
                  <span className="text-sm">{g.group_name}</span>
                  <Checkbox
                    checked={isExcluded}
                    onCheckedChange={(checked) => {
                      const newIds = checked
                        ? [...excludedIds, g.id]
                        : excludedIds.filter((id: string) => id !== g.id);
                      onConfigChange("excluded_group_ids", newIds);
                    }}
                  />
                </label>
              );
            })}
            {(!groups || groups.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-2">אין קבוצות</p>
            )}
          </div>
          {(configuration?.excluded_group_ids?.length || 0) > 0 && (
            <p className="text-xs text-muted-foreground text-right">
              {configuration.excluded_group_ids.length} קבוצות מוחרגות
            </p>
          )}
        </div>
      )}

      {/* Tag selector */}
      {sourceFilter === "tagged_contact" && (
        <div className="space-y-2">
          <Label className="text-right block">בחר טאג</Label>
          <Select
            value={configuration?.tag_id || ""}
            onValueChange={(v) => onConfigChange("tag_id", v)}
          >
            <SelectTrigger className="text-right">
              <SelectValue placeholder="בחר טאג..." />
            </SelectTrigger>
            <SelectContent>
              {(tags || []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Keyword filter */}
      <div className="space-y-2">
        <Label className="text-right block">מילות מפתח (אופציונלי)</Label>
        <Input
          value={configuration?.keyword || ""}
          onChange={(e) => onConfigChange("keyword", e.target.value)}
          placeholder="מילה1, מילה2, מילה3..."
          className="text-right"
        />
        <p className="text-xs text-muted-foreground text-right">
          הפרד בפסיקים — מספיק שההודעה תכיל אחת מהמילים כדי להפעיל את האוטומציה
        </p>
      </div>

      {/* Green API connection selector */}
      {greenApiIntegrations && greenApiIntegrations.length > 1 && (
        <div className="space-y-2">
          <Label className="text-right block">חיבור Green API</Label>
          <Select
            value={configuration?.connection_user_id || "all"}
            onValueChange={(v) => onConfigChange("connection_user_id", v === "all" ? "" : v)}
          >
            <SelectTrigger className="text-right">
              <SelectValue placeholder="כל החיבורים" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל החיבורים</SelectItem>
              {greenApiIntegrations.map((int) => (
                <SelectItem key={int.id} value={int.user_id}>
                  {(int.settings as any)?.display_name || `חיבור ${int.instance_id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}


function LeadSourceConfig({
  tenantId,
  leadSource,
  configuration,
  onConfigChange,
  onBulkConfigChange,
}: {
  tenantId: string | undefined;
  leadSource: string;
  configuration: Record<string, any>;
  onConfigChange: (key: string, value: any) => void;
  onBulkConfigChange: (updates: Record<string, any>) => void;
}) {
  const { toast } = useToast();
  const [showFbDialog, setShowFbDialog] = useState(false);
  const isFacebookForm = leadSource === "facebook_form";

  // Display current selection summary
  const hasSelection = configuration?.facebook_form_id && configuration?.facebook_page_name;

  return (
    <>
      <div className="space-y-2">
        <Label className="text-right block">מקור הליד</Label>
        <Select
          value={leadSource}
          onValueChange={(v) => {
            onConfigChange("lead_source", v);
            if (v === "facebook_form") {
              setShowFbDialog(true);
            }
          }}
        >
          <SelectTrigger className="text-right">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_SOURCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Show selected form summary */}
      {isFacebookForm && hasSelection && (
        <div className="rounded-lg border bg-muted/50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">טופס מחובר</span>
          </div>
          <div className="text-right space-y-1">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">עמוד:</span>{" "}
              {configuration?.facebook_page_name || configuration?.facebook_page_id}
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">טופס:</span>{" "}
              {configuration?.facebook_form_name || configuration?.facebook_form_id}
            </p>
          </div>

          {configuration?.facebook_form_fields && Array.isArray(configuration.facebook_form_fields) && configuration.facebook_form_fields.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <ClipboardCopy className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>שדות הטופס למיפוי</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {configuration.facebook_form_fields.length}
                      </Badge>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start" dir="rtl">
                  <div className="px-3 py-2 border-b border-border bg-muted/50">
                    <p className="text-xs font-medium text-muted-foreground">לחץ על שדה כדי להעתיק</p>
                  </div>
                  <ScrollArea className="max-h-48">
                    <div className="p-1">
                      {configuration.facebook_form_fields.map((f: FacebookFormField) => (
                        <button
                          key={f.key}
                          type="button"
                          className="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs hover:bg-accent transition-colors group"
                          onClick={() => {
                            navigator.clipboard.writeText(`{{fb_${f.key}}}`);
                            toast({ title: "הועתק!", description: `{{fb_${f.key}}}` });
                          }}
                        >
                          <code className="font-mono text-[11px] text-foreground">{`{{fb_${f.key}}}`}</code>
                          <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => setShowFbDialog(true)}
          >
            <Facebook className="h-4 w-4" />
            החלף טופס
          </Button>
        </div>
      )}

      {/* Show button to open dialog if facebook_form selected but no form chosen yet */}
      {isFacebookForm && !hasSelection && (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => setShowFbDialog(true)}
        >
          <Facebook className="h-4 w-4" />
          בחר טופס ליד מפייסבוק
        </Button>
      )}

      {/* Facebook form selection dialog */}
      <FacebookFormSelectionDialog
        open={showFbDialog}
        onClose={() => setShowFbDialog(false)}
        tenantId={tenantId}
        configuration={configuration}
        onSave={(selected) => {
          onBulkConfigChange({
            facebook_integration_id: selected.integrationId,
            facebook_page_id: selected.pageId,
            facebook_page_name: selected.pageName,
            facebook_form_id: selected.formId,
            facebook_form_name: selected.formName,
            facebook_form_fields: selected.formFields || [],
          });
          setShowFbDialog(false);
        }}
      />
    </>
  );
}

// Dialog for selecting Facebook page & form
function FacebookFormSelectionDialog({
  open,
  onClose,
  tenantId,
  configuration,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string | undefined;
  configuration: Record<string, any>;
  onSave: (selected: {
    integrationId: string;
    pageId: string;
    pageName: string;
    formId: string;
    formName: string;
    formFields: FacebookFormField[];
  }) => void;
}) {
  const [selectedIntegrationId, setSelectedIntegrationId] = useState(configuration?.facebook_integration_id || "");
  const [selectedPageId, setSelectedPageId] = useState(configuration?.facebook_page_id || "");
  const [selectedFormId, setSelectedFormId] = useState(configuration?.facebook_form_id || "");
  const [pageSearchQuery, setPageSearchQuery] = useState("");

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedIntegrationId(configuration?.facebook_integration_id || "");
      setSelectedPageId(configuration?.facebook_page_id || "");
      setSelectedFormId(configuration?.facebook_form_id || "");
      setPageSearchQuery("");
    }
  }, [open, configuration]);

  // Fetch Facebook integrations
  const { data: fbIntegrations, isLoading: loadingIntegrations } = useQuery({
    queryKey: ["fb-integrations-for-flow", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("id, integration_type, settings, api_key, is_active")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "facebook_lead_ads")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  const selectedIntegration = fbIntegrations?.find((i) => i.id === selectedIntegrationId);
  const accessToken = selectedIntegration?.api_key || null;

  // Fetch pages
  const { data: pagesData, isLoading: loadingPages } = useQuery({
    queryKey: ["fb-pages-for-flow", selectedIntegrationId, accessToken],
    queryFn: async () => {
      if (!accessToken || !tenantId) return [];
      const { data, error } = await supabase.functions.invoke("get-facebook-forms", {
        body: { tenant_id: tenantId, access_token: accessToken },
      });
      if (error || data?.error) return [];
      return (data?.pages as FacebookPage[]) || [];
    },
    enabled: !!accessToken && !!tenantId && open,
  });

  // Fetch forms
  const pageToken = pagesData?.find((p: FacebookPage) => p.id === selectedPageId)?.access_token || null;
  const { data: formsData, isLoading: loadingForms } = useQuery({
    queryKey: ["fb-forms-for-flow", selectedPageId, accessToken, pageToken],
    queryFn: async () => {
      if (!accessToken || !selectedPageId || !tenantId) return [];
      const { data, error } = await supabase.functions.invoke("get-facebook-forms", {
        body: {
          tenant_id: tenantId,
          page_id: selectedPageId,
          access_token: accessToken,
          page_access_token: pageToken,
        },
      });
      if (error || data?.error) return [];
      return (data?.forms as FacebookForm[]) || [];
    },
    enabled: !!accessToken && !!selectedPageId && !!tenantId && open,
  });

  const selectedPage = pagesData?.find((p: FacebookPage) => p.id === selectedPageId);
  const selectedForm = formsData?.find((f: FacebookForm) => f.id === selectedFormId);
  const canSave = !!selectedIntegrationId && !!selectedPageId && !!selectedFormId;

  const filteredPages = useMemo(() => {
    if (!pagesData || pagesData.length === 0) return [];
    if (!pageSearchQuery.trim()) return pagesData;
    const q = pageSearchQuery.trim().toLowerCase();
    return pagesData.filter((p: FacebookPage) => p.name.toLowerCase().includes(q));
  }, [pagesData, pageSearchQuery]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <Facebook className="h-5 w-5 text-blue-600" />
            בחירת טופס ליד מפייסבוק
          </DialogTitle>
          <DialogDescription className="text-right">
            בחר את חיבור הפייסבוק, העמוד והטופס שממנו יגיעו הלידים לאוטומציה זו.
            <br />
            <span className="text-xs text-amber-600">* חיבור הטופס כאן לא ישפיע על הגדרות הלידים של הארגון</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Step 1: Integration */}
          <div className="space-y-2">
            <Label className="text-right block font-medium">
              <span className="inline-flex items-center gap-2">
                <Badge variant="outline" className="rounded-full h-5 w-5 p-0 flex items-center justify-center text-xs">1</Badge>
                חיבור Facebook
              </span>
            </Label>
            {loadingIntegrations ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : fbIntegrations && fbIntegrations.length > 0 ? (
              <Select
                value={selectedIntegrationId}
                onValueChange={(v) => {
                  setSelectedIntegrationId(v);
                  setSelectedPageId("");
                  setSelectedFormId("");
                }}
              >
                <SelectTrigger className="text-right">
                  <SelectValue placeholder="בחר חיבור..." />
                </SelectTrigger>
                <SelectContent>
                  {fbIntegrations.map((integration) => {
                    const settings = integration.settings as Record<string, any> | null;
                    const name = settings?.connection_name || "Facebook Lead Ads";
                    return (
                      <SelectItem key={integration.id} value={integration.id}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-lg border border-dashed p-3 text-center">
                <p className="text-sm text-muted-foreground">
                  אין חיבור Facebook פעיל.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  הגדר אינטגרציית Facebook Lead Ads בעמוד האינטגרציות.
                </p>
              </div>
            )}
          </div>

          {/* Step 2: Page */}
          {selectedIntegrationId && (
            <div className="space-y-2">
              <Label className="text-right block font-medium">
                <span className="inline-flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full h-5 w-5 p-0 flex items-center justify-center text-xs">2</Badge>
                  דף פייסבוק
                </span>
              </Label>
              {loadingPages ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : pagesData && pagesData.length > 0 ? (
                <div className="space-y-2">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={pageSearchQuery}
                      onChange={(e) => setPageSearchQuery(e.target.value)}
                      placeholder="חפש עמוד לפי שם..."
                      className="text-right pr-9"
                    />
                  </div>
                  {/* Pages list */}
                  <ScrollArea className="h-[200px] rounded-md border">
                    <div className="p-1">
                      {filteredPages.length > 0 ? (
                        filteredPages.map((page: FacebookPage) => (
                          <button
                            key={page.id}
                            type="button"
                            onClick={() => {
                              setSelectedPageId(page.id);
                              setSelectedFormId("");
                            }}
                            className={`w-full text-right px-3 py-2 rounded-md text-sm transition-colors ${
                              selectedPageId === page.id
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted"
                            }`}
                          >
                            {page.name}
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          לא נמצאו עמודים תואמים
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                  {pagesData.length > 5 && (
                    <p className="text-xs text-muted-foreground text-right">
                      {filteredPages.length} מתוך {pagesData.length} עמודים
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-right">
                  לא נמצאו דפים. בדוק את ההרשאות של חיבור הפייסבוק.
                </p>
              )}
            </div>
          )}

          {/* Step 3: Form */}
          {selectedPageId && (
            <div className="space-y-2">
              <Label className="text-right block font-medium">
                <span className="inline-flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full h-5 w-5 p-0 flex items-center justify-center text-xs">3</Badge>
                  טופס ליד
                </span>
              </Label>
              {loadingForms ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : formsData && formsData.length > 0 ? (
                <Select
                  value={selectedFormId}
                  onValueChange={(v) => setSelectedFormId(v)}
                >
                  <SelectTrigger className="text-right">
                    <SelectValue placeholder="בחר טופס..." />
                  </SelectTrigger>
                  <SelectContent>
                    {formsData.map((form: FacebookForm) => (
                      <SelectItem key={form.id} value={form.id}>
                        {form.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground text-right">
                  לא נמצאו טפסים בדף זה.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row-reverse sm:flex-row-reverse gap-2">
          <Button
            disabled={!canSave}
            onClick={() => {
              onSave({
                integrationId: selectedIntegrationId,
                pageId: selectedPageId,
                pageName: selectedPage?.name || selectedPageId,
                formId: selectedFormId,
                formName: selectedForm?.name || selectedFormId,
                formFields: selectedForm?.fields || [],
              });
            }}
          >
            <CheckCircle2 className="h-4 w-4 ml-2" />
            אישור
          </Button>
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Sub-component for Create Task action configuration
function CreateTaskActionConfig({
  tenantId,
  configuration,
  availableFields,
  onConfigChange,
}: {
  tenantId: string | undefined;
  configuration: Record<string, any>;
  availableFields: { key: string; label: string }[];
  onConfigChange: (key: string, value: any) => void;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [activeField, setActiveField] = useState<"title" | "notes">("title");

  const { data: agencies } = useQuery({
    queryKey: ["agencies-for-task-config", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: campaigners } = useQuery({
    queryKey: ["campaigners-for-task-config", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("campaigners")
        .select("id, full_name")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const insertVariable = (fieldKey: string) => {
    const variable = `{{${fieldKey}}}`;
    if (activeField === "title") {
      const el = titleRef.current;
      const currentValue = configuration?.task_title_template || "";
      const pos = el?.selectionStart ?? currentValue.length;
      const newValue = currentValue.slice(0, pos) + variable + currentValue.slice(pos);
      onConfigChange("task_title_template", newValue);
    } else {
      const el = notesRef.current;
      const currentValue = configuration?.task_notes_template || "";
      const pos = el?.selectionStart ?? currentValue.length;
      const newValue = currentValue.slice(0, pos) + variable + currentValue.slice(pos);
      onConfigChange("task_notes_template", newValue);
    }
  };

  return (
    <div className="space-y-4">
      {availableFields.length > 0 && (
        <div className="space-y-2">
          <Label className="text-right block text-xs text-muted-foreground">הכנס משתנה מהטריגר:</Label>
          <div className="flex flex-wrap gap-1 justify-end">
            {availableFields.map((field) => (
              <Badge
                key={field.key}
                variant="outline"
                className="cursor-pointer hover:bg-accent text-xs"
                onClick={() => insertVariable(field.key)}
              >
                {field.label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-right block">כותרת משימה</Label>
        <Input
          ref={titleRef}
          value={configuration?.task_title_template || ""}
          onChange={(e) => onConfigChange("task_title_template", e.target.value)}
          onFocus={() => setActiveField("title")}
          placeholder="למשל: טיפול בליד {{contact_name}}"
          className="text-right"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-right block">הערות</Label>
        <Textarea
          ref={notesRef}
          value={configuration?.task_notes_template || ""}
          onChange={(e) => onConfigChange("task_notes_template", e.target.value)}
          onFocus={() => setActiveField("notes")}
          placeholder="למשל: ליצור קשר עם {{contact_name}} בטלפון {{phone}}"
          className="text-right min-h-[80px]"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-right block">עדיפות (1-10)</Label>
        <Select
          value={String(configuration?.task_priority || "")}
          onValueChange={(v) => onConfigChange("task_priority", Number(v))}
        >
          <SelectTrigger className="text-right">
            <SelectValue placeholder="בחר עדיפות..." />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-right block">ימים לדד-ליין</Label>
        <Input
          type="number"
          min={0}
          value={configuration?.task_due_days ?? ""}
          onChange={(e) => onConfigChange("task_due_days", e.target.value ? Number(e.target.value) : null)}
          placeholder="למשל: 3 (ימים מרגע היצירה)"
          className="text-right"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-right block">סוכנות ברירת מחדל</Label>
        <Select
          value={configuration?.default_agency_id || ""}
          onValueChange={(v) => onConfigChange("default_agency_id", v)}
        >
          <SelectTrigger className="text-right">
            <SelectValue placeholder="בחר סוכנות..." />
          </SelectTrigger>
          <SelectContent>
            {agencies?.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-right block">קמפיינר ברירת מחדל</Label>
        <Select
          value={configuration?.default_campaigner_id || ""}
          onValueChange={(v) => onConfigChange("default_campaigner_id", v)}
        >
          <SelectTrigger className="text-right">
            <SelectValue placeholder="בחר קמפיינר..." />
          </SelectTrigger>
          <SelectContent>
            {campaigners?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-dashed p-3 text-right">
        <p className="text-xs text-muted-foreground">
          💡 שיוך ליד/לקוח מתבצע אוטומטית מנתוני הטריגר. אם הטריגר מכיל ליד או לקוח, המשימה תשויך אליו.
        </p>
      </div>
    </div>
  );
}

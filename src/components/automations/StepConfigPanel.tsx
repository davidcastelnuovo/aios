import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FlowNodeData } from "./FlowNode";

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

interface StepConfigPanelProps {
  node: FlowNodeData | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (nodeId: string, updates: Partial<FlowNodeData>) => void;
}

export function StepConfigPanel({ node, open, onClose, onUpdate }: StepConfigPanelProps) {
  if (!node) return null;

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

  const options = node.step_type === "trigger" ? TRIGGER_OPTIONS : ACTION_OPTIONS;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-[360px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="text-right">
            {node.step_type === "trigger" ? "הגדרת טריגר" :
             node.step_type === "action" ? "הגדרת פעולה" :
             node.step_type === "condition" ? "הגדרת תנאי" :
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

          {/* Message template for WhatsApp actions */}
          {(node.action_type === "send_whatsapp" || node.action_type === "send_greenapi_message") && (
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
                משתנים זמינים: {"{{contact_name}}"}, {"{{company_name}}"}
              </p>
            </div>
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

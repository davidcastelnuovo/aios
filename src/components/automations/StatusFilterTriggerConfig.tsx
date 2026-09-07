import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeadStatuses } from "@/hooks/useLeadStatuses";

const TASK_STATUS_OPTIONS = [
  { value: "open", label: "פתוחה" },
  { value: "in_progress", label: "בטיפול" },
  { value: "completed", label: "הושלמה" },
  { value: "cancelled", label: "בוטלה" },
];

interface StatusFilterTriggerConfigProps {
  triggerType: string;
  configuration: Record<string, any>;
  onConfigChange: (key: string, value: any) => void;
}

export default function StatusFilterTriggerConfig({
  triggerType,
  configuration,
  onConfigChange,
}: StatusFilterTriggerConfigProps) {
  const { statuses: leadStatuses } = useLeadStatuses();

  if (triggerType !== "lead_status_changed" && triggerType !== "task_status_changed") {
    return null;
  }

  return (
    <div className="space-y-2 bg-muted/40 border rounded-lg p-3" dir="rtl">
      <Label className="text-right block text-sm font-semibold">סינון לפי סטטוס</Label>
      <Select
        value={configuration?.filter_status || "any"}
        onValueChange={(v) => onConfigChange("filter_status", v)}
      >
        <SelectTrigger className="text-right">
          <SelectValue placeholder="כל סטטוס" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">כל שינוי סטטוס</SelectItem>
          {triggerType === "lead_status_changed" && leadStatuses.map((status) => (
            <SelectItem key={status.status_key} value={status.status_key}>
              {status.label}
            </SelectItem>
          ))}
          {triggerType === "task_status_changed" && TASK_STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground text-right">
        האוטומציה תרוץ רק כשהסטטוס משתנה לערך זה
      </p>
    </div>
  );
}

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AVAILABLE_VARIABLES = [
  { key: "contact_name", label: "שם איש קשר", example: "יוסי כהן" },
  { key: "company_name", label: "חברה", example: "חברת ABC" },
  { key: "phone", label: "טלפון", example: "050-1234567" },
  { key: "status", label: "סטטוס", example: "ממתין" },
  { key: "date", label: "תאריך", example: "14.12.2025" },
  { key: "time", label: "שעה", example: "16:00" },
  { key: "day_of_week", label: "יום בשבוע", example: "ראשון" },
  { key: "task_title", label: "כותרת משימה", example: "פגישת היכרות" },
  { key: "client_name", label: "שם לקוח", example: "לקוח VIP" },
  { key: "campaigner_name", label: "קמפיינר", example: "מיכל לוי" },
  { key: "priority", label: "עדיפות", example: "גבוהה" },
  { key: "due_date", label: "תאריך יעד", example: "20.12.2025" },
  { key: "old_status", label: "סטטוס קודם", example: "חדש" },
  { key: "new_status", label: "סטטוס חדש", example: "בטיפול" },
  { key: "task_status", label: "סטטוס משימה", example: "פתוח" },
  { key: "agency_name", label: "שם סוכנות", example: "סוכנות מרקטינג" },
  { key: "tasks_link", label: "קישור למשימות", example: "https://app.example.com/tasks" },
  { key: "leads_link", label: "קישור ללידים", example: "https://app.example.com/leads" },
  { key: "clients_link", label: "קישור ללקוחות", example: "https://app.example.com/clients" },
  { key: "group_invite_link", label: "קישור לקבוצה", example: "https://chat.whatsapp.com/ABC123" },
  { key: "group_name", label: "שם קבוצה", example: "קבוצת מכירות" },
];

interface MessageTemplateBuilderProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

export function MessageTemplateBuilder({ 
  value, 
  onChange, 
  label = "תבנית הודעה",
  placeholder = "שלום {{contact_name}}, תודה על פנייתך!" 
}: MessageTemplateBuilderProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [copied, setCopied] = useState<"json" | "text" | null>(null);
  const { toast } = useToast();

  const insertVariable = (variableKey: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const variableText = `{{${variableKey}}}`;
    
    const newValue = value.slice(0, start) + variableText + value.slice(end);
    onChange(newValue);

    // Set cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + variableText.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const getPreviewText = () => {
    let preview = value;
    AVAILABLE_VARIABLES.forEach((variable) => {
      const regex = new RegExp(`{{${variable.key}}}`, "g");
      preview = preview.replace(regex, variable.example);
    });
    return preview;
  };

  const copyAsJson = async () => {
    const jsonOutput = JSON.stringify({ message_template: value }, null, 2);
    await navigator.clipboard.writeText(jsonOutput);
    setCopied("json");
    toast({ title: "JSON הועתק ללוח" });
    setTimeout(() => setCopied(null), 2000);
  };

  const copyAsText = async () => {
    await navigator.clipboard.writeText(value);
    setCopied("text");
    toast({ title: "הטקסט הועתק ללוח" });
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card className="border border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>{label}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="h-7 px-2"
          >
            {showPreview ? (
              <>
                <EyeOff className="h-3.5 w-3.5 ml-1" />
                הסתר תצוגה
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 ml-1" />
                הצג תצוגה
              </>
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Variable Buttons */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">לחץ להוספת משתנה במיקום הסמן:</p>
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_VARIABLES.map((variable) => (
              <Badge
                key={variable.key}
                variant="outline"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs py-0.5"
                onClick={() => insertVariable(variable.key)}
              >
                + {variable.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="font-mono text-sm"
          dir="auto"
        />

        {/* Preview */}
        {showPreview && value && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">תצוגה מקדימה:</p>
            <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap border border-border/50" dir="auto">
              {getPreviewText()}
            </div>
          </div>
        )}

        {/* Copy Buttons */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyAsJson}
            className="text-xs"
            disabled={!value}
          >
            {copied === "json" ? (
              <Check className="h-3.5 w-3.5 ml-1" />
            ) : (
              <Copy className="h-3.5 w-3.5 ml-1" />
            )}
            העתק JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyAsText}
            className="text-xs"
            disabled={!value}
          >
            {copied === "text" ? (
              <Check className="h-3.5 w-3.5 ml-1" />
            ) : (
              <Copy className="h-3.5 w-3.5 ml-1" />
            )}
            העתק טקסט
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

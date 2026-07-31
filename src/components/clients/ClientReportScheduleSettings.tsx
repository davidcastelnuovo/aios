import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  clientId: string;
  tenantId: string;
  target: {
    kind: "table" | "dashboard";
    id: string;
    name: string;
  };
}

const WEEKDAYS = [
  ["0", "ראשון"],
  ["1", "שני"],
  ["2", "שלישי"],
  ["3", "רביעי"],
  ["4", "חמישי"],
  ["5", "שישי"],
  ["6", "שבת"],
];

export function ClientReportScheduleSettings({ clientId, tenantId, target }: Props) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<"weekly" | "monthly">("monthly");
  const [day, setDay] = useState("1");
  const [sendTime, setSendTime] = useState("09:00");
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [emails, setEmails] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const queryKey = ["client-report-schedule", clientId, target.kind, target.id];
  const { data: schedule, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from("report_schedules")
        .select("*")
        .eq("client_id", clientId)
        .eq("target_type", target.kind);
      query = target.kind === "table"
        ? query.eq("table_id", target.id)
        : query.eq("dashboard_id", target.id);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId && !!target.id,
  });

  useEffect(() => {
    setEnabled(!!schedule?.enabled);
    setFrequency(schedule?.frequency === "weekly" ? "weekly" : "monthly");
    setDay(String(
      schedule?.frequency === "weekly"
        ? schedule?.day_of_week ?? 0
        : schedule?.day_of_month ?? 1,
    ));
    setSendTime(String(schedule?.send_time || "09:00").slice(0, 5));
    const channels: string[] = schedule?.channels || ["whatsapp"];
    setSendWhatsApp(channels.includes("whatsapp"));
    setSendEmail(channels.includes("email"));
    setEmails((schedule?.email_recipients || []).join(", "));
    setMessage(schedule?.message || "");
  }, [schedule, target.id]);

  const save = async () => {
    if (!sendWhatsApp && !sendEmail) {
      toast.error("יש לבחור לפחות ערוץ שליחה אחד");
      return;
    }
    const emailRecipients = emails
      .split(/[,\n;]/)
      .map((email) => email.trim())
      .filter(Boolean);
    if (sendEmail && emailRecipients.length === 0) {
      toast.error("יש להזין לפחות כתובת אימייל אחת");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const payload = {
        tenant_id: tenantId,
        client_id: clientId,
        target_type: target.kind,
        table_id: target.kind === "table" ? target.id : null,
        dashboard_id: target.kind === "dashboard" ? target.id : null,
        enabled,
        frequency,
        day_of_week: frequency === "weekly" ? Number(day) : null,
        day_of_month: frequency === "monthly" ? Number(day) : null,
        send_time: sendTime,
        channels: [
          ...(sendWhatsApp ? ["whatsapp"] : []),
          ...(sendEmail ? ["email"] : []),
        ],
        email_recipients: emailRecipients,
        message: message.trim() || null,
        created_by: user.id,
      };

      const result = schedule?.id
        ? await supabase.from("report_schedules").update(payload).eq("id", schedule.id)
        : await supabase.from("report_schedules").insert(payload);
      if (result.error) throw result.error;
      await queryClient.invalidateQueries({ queryKey });
      toast.success(enabled ? "תזמון הדוח נשמר והופעל" : "הגדרת התזמון נשמרה ללא הפעלה");
    } catch (error: unknown) {
      toast.error(`שמירת התזמון נכשלה: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="h-20 rounded-lg border animate-pulse bg-muted/20" />;
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/10 p-3" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium">שליחה מתוזמנת</p>
            <p className="text-xs text-muted-foreground">
              כבוי כברירת מחדל. יישלח קישור לדוח החי רק לאחר הפעלה מפורשת.
            </p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="הפעל תזמון" />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">תדירות</Label>
          <Select value={frequency} onValueChange={(value) => {
            setFrequency(value as "weekly" | "monthly");
            setDay(value === "weekly" ? "0" : "1");
          }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">שבועי</SelectItem>
              <SelectItem value="monthly">חודשי</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{frequency === "weekly" ? "יום בשבוע" : "יום בחודש"}</Label>
          {frequency === "weekly" ? (
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type="number"
              min={1}
              max={28}
              value={day}
              onChange={(event) => setDay(event.target.value)}
              className="h-8 text-xs"
            />
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">שעה (ישראל)</Label>
          <Input type="time" value={sendTime} onChange={(event) => setSendTime(event.target.value)} className="h-8 text-xs" />
        </div>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={sendWhatsApp} onCheckedChange={(checked) => setSendWhatsApp(!!checked)} />
          וואטסאפ של הלקוח
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={sendEmail} onCheckedChange={(checked) => setSendEmail(!!checked)} />
          אימייל
        </label>
      </div>

      {sendEmail && (
        <Input
          value={emails}
          onChange={(event) => setEmails(event.target.value)}
          placeholder="כתובות אימייל, מופרדות בפסיק"
          className="h-8 text-xs"
          dir="ltr"
        />
      )}
      <Textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={`הודעה עבור ${target.name} (אופציונלי)`}
        rows={2}
        className="text-xs"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {schedule?.last_run_at
            ? `נשלח לאחרונה: ${new Date(schedule.last_run_at).toLocaleString("he-IL")}`
            : "עדיין לא נשלח מתזמון"}
        </span>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving && <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin" />}
          שמור הגדרה
        </Button>
      </div>
    </div>
  );
}

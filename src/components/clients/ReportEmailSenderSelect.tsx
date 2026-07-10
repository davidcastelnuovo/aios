import { useEffect } from "react";
import { useBroadcastDomains } from "@/hooks/useBroadcastDomains";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export interface ReportEmailSender {
  fromEmail: string;
  fromName: string;
}

interface Props {
  value: ReportEmailSender | null;
  onChange: (s: ReportEmailSender | null) => void;
}

/**
 * "Send from" picker for report/dashboard emails, sourced from the same
 * Resend-verified sending domains as the broadcast module (broadcast_email_domains).
 * Renders nothing when the tenant has no verified domain — in that case the parent
 * keeps sending via the connected Gmail account (unchanged behavior).
 */
export function ReportEmailSenderSelect({ value, onChange }: Props) {
  const { list } = useBroadcastDomains();
  const domains = list.data || [];

  // Default to the tenant's default verified domain once options load.
  useEffect(() => {
    if (domains.length > 0 && !value) {
      const d = domains.find((x) => x.is_default) || domains[0];
      onChange({ fromEmail: `${d.default_local}@${d.domain}`, fromName: d.from_name || "" });
    }
  }, [domains, value, onChange]);

  if (domains.length === 0) return null;

  return (
    <div className="space-y-1" dir="rtl">
      <Label className="text-xs text-muted-foreground">שלח מ (אימייל)</Label>
      <Select
        value={value?.fromEmail || ""}
        onValueChange={(email) => {
          const d = domains.find((x) => `${x.default_local}@${x.domain}` === email);
          if (d) onChange({ fromEmail: email, fromName: d.from_name || "" });
        }}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="בחר כתובת שולח" />
        </SelectTrigger>
        <SelectContent>
          {domains.map((d) => {
            const addr = `${d.default_local}@${d.domain}`;
            return (
              <SelectItem key={d.id} value={addr}>
                {d.from_name ? `${d.from_name} <${addr}>` : addr}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

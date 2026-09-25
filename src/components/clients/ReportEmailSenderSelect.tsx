import { useBroadcastDomains } from "@/hooks/useBroadcastDomains";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Mail } from "lucide-react";

export interface ReportEmailSender {
  type: "resend" | "gmail";
  fromEmail: string;
  fromName: string;
}

export const GMAIL_SENDER: ReportEmailSender = {
  type: "gmail",
  fromEmail: "__gmail__",
  fromName: "Gmail מחובר",
};

interface Props {
  value: ReportEmailSender | null;
  onChange: (s: ReportEmailSender | null) => void;
  gmailEmail?: string | null;
}

/**
 * "Send from" picker for report emails.
 * Shows verified Resend domains + the connected Gmail account.
 * If no verified domains exist, only Gmail is shown.
 */
export function ReportEmailSenderSelect({ value, onChange, gmailEmail }: Props) {
  const { list } = useBroadcastDomains();
  const domains = list.data || [];

  const options: ReportEmailSender[] = [
    ...domains.map((d) => ({
      type: "resend" as const,
      fromEmail: `${d.default_local}@${d.domain}`,
      fromName: d.from_name || "",
    })),
    {
      type: "gmail" as const,
      fromEmail: "__gmail__",
      fromName: gmailEmail ? `Gmail (${gmailEmail})` : "Gmail מחובר",
    },
  ];

  const currentValue = value?.fromEmail || "";

  return (
    <div className="space-y-1" dir="rtl">
      <Label className="text-xs text-muted-foreground">שלח מ (אימייל)</Label>
      <Select
        value={currentValue}
        onValueChange={(email) => {
          if (email === "__gmail__") {
            onChange({ type: "gmail", fromEmail: "__gmail__", fromName: gmailEmail ? `Gmail (${gmailEmail})` : "Gmail מחובר" });
          } else {
            const d = domains.find((x) => `${x.default_local}@${x.domain}` === email);
            if (d) onChange({ type: "resend", fromEmail: email, fromName: d.from_name || "" });
          }
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
          <SelectItem value="__gmail__">
            <span className="flex items-center gap-1.5">
              <Mail className="h-3 w-3 text-blue-500" />
              {gmailEmail ? `Gmail (${gmailEmail})` : "Gmail מחובר"}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

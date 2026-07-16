import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { Send, Mail, MessageCircle, Loader2, Check, ChevronsUpDown, X, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { markdownToEmailHtml, markdownToWhatsApp } from "./summaryFormat";

export interface ShareableRecording {
  id: string;
  meeting_topic: string | null;
  start_time: string | null;
  client_id: string | null;
  summary_md: string | null;
  summary_file_url: string | null;
}

interface ShareSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recording: ShareableRecording;
  tenantId: string;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function ShareSummaryDialog({ open, onOpenChange, recording, tenantId }: ShareSummaryDialogProps) {
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [attachDocx, setAttachDocx] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [directPhone, setDirectPhone] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [emailSender, setEmailSender] = useState<"aios" | "gmail">("aios");
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const meetingName = recording.meeting_topic || "פגישה";
  const meetingDate = recording.start_time
    ? new Date(recording.start_time).toLocaleDateString("he-IL")
    : "";

  const { data: client } = useQuery({
    queryKey: ["client-for-summary-share", recording.client_id],
    queryFn: async () => {
      if (!recording.client_id) return null;
      const { data } = await supabase
        .from("clients")
        .select("id, name, phone, email, whatsapp_group_id")
        .eq("id", recording.client_id)
        .single();
      return data;
    },
    enabled: !!recording.client_id && open,
  });

  const { data: groups } = useQuery({
    queryKey: ["whatsapp-groups-for-summary", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_groups")
        .select("id, group_name")
        .eq("tenant_id", tenantId)
        .eq("is_blocked", false)
        .order("group_name");
      return data || [];
    },
    enabled: open,
  });

  const { data: gmailToken } = useQuery({
    queryKey: ["gmail-token-check"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("gmail_tokens")
        .select("google_email")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (client) {
      if (client.phone) setDirectPhone(client.phone);
      if (client.email) setEmailAddress(client.email);
      if (client.whatsapp_group_id) setSelectedGroupId(client.whatsapp_group_id);
    }
  }, [client]);

  useEffect(() => {
    if (gmailToken?.google_email) setEmailSender("gmail");
    else setEmailSender("aios");
  }, [gmailToken]);

  const logClientUpdate = async () => {
    if (!recording.client_id) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("client_updates").insert({
        tenant_id: tenantId,
        client_id: recording.client_id,
        update_type: "meeting_summary",
        content: `סיכום הפגישה "${meetingName}"${meetingDate ? ` (${meetingDate})` : ""} נשלח ללקוח`,
        created_by: user?.id ?? null,
      } as never);
    } catch (err) {
      console.error("client_updates log failed:", err);
    }
  };

  const handleSend = async () => {
    if (!recording.summary_md) {
      toast.error("אין סיכום לשליחה — צור סיכום קודם");
      return;
    }
    if (!sendWhatsApp && !sendEmail) {
      toast.error("יש לבחור לפחות אמצעי שליחה אחד");
      return;
    }

    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const header = `*סיכום פגישה: ${meetingName}*${meetingDate ? `\n📅 ${meetingDate}` : ""}`;

      if (sendWhatsApp) {
        const hasGroup = !!selectedGroupId;
        if (!hasGroup && !directPhone) {
          toast.error("יש לבחור קבוצה או להזין מספר טלפון");
          setIsSending(false);
          return;
        }

        const waText = [
          header,
          messageText.trim() ? `\n${messageText.trim()}` : "",
          "\n" + markdownToWhatsApp(recording.summary_md),
        ].join("\n").trim();

        const msgResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-green-api-message`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tenantId,
              message: waText,
              ...(hasGroup ? { groupId: selectedGroupId } : { phoneNumber: directPhone }),
              ...(recording.client_id ? { clientId: recording.client_id } : {}),
            }),
          }
        );
        const msgResult = await msgResponse.json();
        if (!msgResponse.ok) throw new Error(msgResult.error || "שגיאה בשליחה בוואטסאפ");

        // Optional: the DOCX as an attached document
        if (attachDocx && recording.summary_file_url) {
          try {
            const docxBlob = await (await fetch(recording.summary_file_url)).blob();
            const formData = new FormData();
            formData.append("file", docxBlob, `סיכום פגישה - ${meetingName}.docx`);
            formData.append("tenantId", tenantId);
            formData.append("fileType", "document");
            if (hasGroup) formData.append("groupId", selectedGroupId);
            else formData.append("phoneNumber", directPhone);
            if (recording.client_id) formData.append("clientId", recording.client_id);
            const fileResponse = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-green-api-file`,
              { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: formData }
            );
            if (!fileResponse.ok) console.error("DOCX attach failed:", await fileResponse.text());
          } catch (docxErr) {
            console.error("DOCX attach failed:", docxErr);
          }
        }
        toast.success("הסיכום נשלח בוואטסאפ בהצלחה");
      }

      if (sendEmail) {
        if (!emailAddress) {
          toast.error("יש להזין כתובת אימייל");
          setIsSending(false);
          return;
        }

        const subject = `סיכום פגישה: ${meetingName}${meetingDate ? ` — ${meetingDate}` : ""}`;
        const messageSection = messageText.trim()
          ? `<p style="color:#1e293b;font-size:15px;line-height:1.6;margin:0 0 16px;">${messageText.trim().replace(/\n/g, "<br/>")}</p>`
          : "";
        const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#2563eb 0%,#1e40af 100%);padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">סיכום פגישה</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${meetingName}${meetingDate ? ` · ${meetingDate}` : ""}</p>
        </td></tr>
        <tr><td style="padding:28px 32px;" dir="rtl">
          ${messageSection}
          ${markdownToEmailHtml(recording.summary_md)}
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">נשלח באמצעות AfterLead AIOS</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        let attachments: { filename: string; base64: string }[] = [];
        if (attachDocx && recording.summary_file_url) {
          try {
            const docxBlob = await (await fetch(recording.summary_file_url)).blob();
            attachments = [{ filename: `סיכום פגישה - ${meetingName}.docx`, base64: await blobToBase64(docxBlob) }];
          } catch (docxErr) {
            console.error("DOCX fetch for email failed:", docxErr);
          }
        }
        const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

        if (emailSender === "gmail" && gmailToken?.google_email) {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-api`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "send",
                to: emailAddress,
                subject,
                body: html,
                attachments: attachments.map((a) => ({
                  filename: a.filename,
                  mimeType: docxMime,
                  data: a.base64,
                })),
              }),
            }
          );
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "שגיאה בשליחה ב-Gmail");
          toast.success(`הסיכום נשלח מ-${gmailToken.google_email}`);
        } else {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-resend-email`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                to: emailAddress,
                subject,
                html,
                attachments: attachments.map((a) => ({
                  filename: a.filename,
                  content: a.base64,
                  contentType: docxMime,
                })),
              }),
            }
          );
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "שגיאה בשליחת אימייל");
          toast.success("הסיכום נשלח באימייל בהצלחה");
        }
      }

      await logClientUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending summary:", error);
      toast.error("שגיאה בשליחת הסיכום: " + (error instanceof Error ? error.message : ""));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>שתף סיכום פגישה</DialogTitle>
          <DialogDescription>
            {meetingName}{meetingDate ? ` · ${meetingDate}` : ""}{client?.name ? ` · ${client.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">אמצעי שליחה</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={sendWhatsApp} onCheckedChange={(checked) => setSendWhatsApp(!!checked)} />
                <MessageCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">וואטסאפ</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={sendEmail} onCheckedChange={(checked) => setSendEmail(!!checked)} />
                <Mail className="h-4 w-4 text-blue-600" />
                <span className="text-sm">אימייל</span>
              </label>
            </div>
          </div>

          {sendWhatsApp && (
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <div>
                <Label className="text-sm">קבוצת וואטסאפ (חיפוש לפי שם)</Label>
                <GroupCombobox groups={groups || []} value={selectedGroupId} onChange={setSelectedGroupId} />
              </div>
              <div>
                <Label htmlFor="summary-direct-phone" className="text-sm">או מספר טלפון ישיר</Label>
                <Input
                  id="summary-direct-phone"
                  value={directPhone}
                  onChange={(e) => setDirectPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  אם נבחרה קבוצה — היא תקבל עדיפות. אחרת תישלח הודעה למספר.
                </p>
              </div>
            </div>
          )}

          {sendEmail && (
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <div>
                <Label htmlFor="summary-email" className="text-sm">כתובת אימייל של הנמען</Label>
                <Input
                  id="summary-email"
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="example@email.com"
                  dir="ltr"
                />
              </div>
              <div>
                <Label className="text-sm mb-2 block">שלח מ-</Label>
                <RadioGroup value={emailSender} onValueChange={(v) => setEmailSender(v as "aios" | "gmail")} className="space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <RadioGroupItem value="aios" id="summary-sender-aios" />
                    <span>AIOS <span className="text-muted-foreground text-xs">(noreply@aios.co.il)</span></span>
                  </label>
                  <label className={cn(
                    "flex items-center gap-2 text-sm",
                    gmailToken?.google_email ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                  )}>
                    <RadioGroupItem value="gmail" id="summary-sender-gmail" disabled={!gmailToken?.google_email} />
                    <span>
                      Gmail שלי{" "}
                      {gmailToken?.google_email
                        ? <span className="text-muted-foreground text-xs">({gmailToken.google_email})</span>
                        : <span className="text-muted-foreground text-xs">(לא מחובר)</span>}
                    </span>
                  </label>
                </RadioGroup>
              </div>
            </div>
          )}

          {recording.summary_file_url && (
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox checked={attachDocx} onCheckedChange={(checked) => setAttachDocx(!!checked)} />
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <span>צרף גם את קובץ ה-Word של הסיכום</span>
            </label>
          )}

          <div>
            <Label htmlFor="summary-message-text" className="text-sm">טקסט מלווה (אופציונלי)</Label>
            <Textarea
              id="summary-message-text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="הודעה אישית שתופיע לפני הסיכום..."
              rows={2}
            />
          </div>

          <Button onClick={handleSend} disabled={isSending || !recording.summary_md} className="w-full">
            {isSending ? (
              <><Loader2 className="ml-2 h-4 w-4 animate-spin" />שולח...</>
            ) : (
              <><Send className="ml-2 h-4 w-4" />שלח סיכום</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface GroupOption {
  id: string;
  group_name: string;
}

function GroupCombobox({
  groups,
  value,
  onChange,
}: {
  groups: GroupOption[];
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = groups.find((g) => g.id === value);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="flex-1 justify-between font-normal">
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected ? selected.group_name : "חפש קבוצה לפי שם..."}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="חפש שם קבוצה..." />
            <CommandList>
              <CommandEmpty>לא נמצאו קבוצות</CommandEmpty>
              <CommandGroup>
                {groups.map((group) => (
                  <CommandItem
                    key={group.id}
                    value={group.group_name}
                    onSelect={() => {
                      onChange(group.id === value ? "" : group.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("ml-2 h-4 w-4", value === group.id ? "opacity-100" : "opacity-0")} />
                    {group.group_name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected && (
        <Button type="button" variant="ghost" size="icon" onClick={() => onChange("")} title="נקה בחירה">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

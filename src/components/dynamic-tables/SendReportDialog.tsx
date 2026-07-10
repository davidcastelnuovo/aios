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
import { Send, Mail, MessageCircle, Loader2, Link2, Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SendReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  screenshotBlob: Blob | null;
  tableName: string;
  tableId: string;
  clientId?: string | null;
  tenantId: string;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function SendReportDialog({
  open,
  onOpenChange,
  screenshotBlob,
  tableName,
  tableId,
  clientId,
  tenantId,
}: SendReportDialogProps) {
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [directPhone, setDirectPhone] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [emailSender, setEmailSender] = useState<"aios" | "gmail">("aios");
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (screenshotBlob) {
      const url = URL.createObjectURL(screenshotBlob);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [screenshotBlob]);

  const { data: client } = useQuery({
    queryKey: ["client-for-report", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data } = await supabase
        .from("clients")
        .select("id, name, phone, email, whatsapp_group_id")
        .eq("id", clientId)
        .single();
      return data;
    },
    enabled: !!clientId && open,
  });

  const { data: groups } = useQuery({
    queryKey: ["whatsapp-groups-for-report", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_groups")
        .select("id, group_name, group_chat_id")
        .eq("tenant_id", tenantId)
        .eq("is_blocked", false)
        .order("group_name");
      return data || [];
    },
    enabled: open,
  });

  const { data: shareLink } = useQuery({
    queryKey: ["table-share-link", tableId],
    queryFn: async () => {
      const { data } = await supabase
        .from("table_shares" as any)
        .select("share_token, is_active")
        .eq("table_id", tableId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const shareData = data as any;
      if (shareData?.share_token) {
        return `https://aios.co.il/shared/table/${shareData.share_token}`;
      }
      return null;
    },
    enabled: open && !!tableId,
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

  const handleSend = async () => {
    if (!screenshotBlob) {
      toast.error("לא נוצר צילום מסך");
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

      if (sendWhatsApp) {
        const hasGroup = selectedGroupId && selectedGroupId !== "__none__";
        if (!hasGroup && !directPhone) {
          toast.error("יש לבחור קבוצה או להזין מספר טלפון");
          setIsSending(false);
          return;
        }

        const captionParts: string[] = [];
        if (messageText) captionParts.push(messageText);
        if (shareLink) captionParts.push(`\n📊 צפה בדוח המלא: ${shareLink}`);
        const fullCaption = captionParts.join("");

        const formData = new FormData();
        formData.append("file", screenshotBlob, `report-${tableName}.png`);
        formData.append("tenantId", tenantId);
        formData.append("fileType", "image");
        if (fullCaption) formData.append("caption", fullCaption);
        if (hasGroup) {
          formData.append("groupId", selectedGroupId);
        } else if (directPhone) {
          formData.append("phoneNumber", directPhone);
        }
        if (clientId) formData.append("clientId", clientId);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-green-api-file`,
          { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: formData }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "שגיאה בשליחה בוואטסאפ");
        toast.success("הדוח נשלח בוואטסאפ בהצלחה");
      }

      if (sendEmail) {
        if (!emailAddress) {
          toast.error("יש להזין כתובת אימייל");
          setIsSending(false);
          return;
        }

        const base64 = await blobToBase64(screenshotBlob);
        const subject = `דוח ${tableName}`;

        // Build branded HTML email with embedded screenshot as data URI (works in all email clients)
        const messageSection = messageText
          ? `<p style="color:#1e293b;font-size:15px;line-height:1.6;margin:0 0 16px;">${messageText.replace(/\n/g, "<br/>")}</p>`
          : "";
        const linkSection = shareLink
          ? `<p style="margin:16px 0 0;"><a href="${shareLink}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">📊 צפה בדוח המלא</a></p>`
          : "";
        const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">AfterLead · AIOS</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">דוח: ${tableName}</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          ${messageSection}
          <img src="data:image/png;base64,${base64}" alt="דוח ${tableName}" style="max-width:100%;border-radius:8px;border:1px solid #e2e8f0;display:block;"/>
          ${linkSection}
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">נשלח באמצעות AfterLead AIOS</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        if (emailSender === "gmail" && gmailToken?.google_email) {
          // Gmail blocks data URIs — use CID inline attachment instead
          const gmailHtml = html.replace(
            `data:image/png;base64,${base64}`,
            "cid:report-screenshot"
          );
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-api`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action: "send",
                to: emailAddress,
                subject,
                body: gmailHtml,
                attachments: [{
                  filename: `report-${tableName}.png`,
                  mimeType: "image/png",
                  data: base64,
                  disposition: "inline",
                  cid: "report-screenshot",
                }],
              }),
            }
          );
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "שגיאה בשליחה ב-Gmail");
          toast.success(`הדוח נשלח מ-${gmailToken.google_email}`);
        } else {
          // Resend: HTML with embedded data URI image (supported)
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-resend-email`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ to: emailAddress, subject, html }),
            }
          );
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "שגיאה בשליחת אימייל");
          toast.success("הדוח נשלח באימייל בהצלחה");
        }
      }

      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending report:", error);
      toast.error("שגיאה בשליחת הדוח: " + error.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>שלח עדכון ללקוח</DialogTitle>
          <DialogDescription>שליחת דוח מסכם של {tableName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {previewUrl && (
            <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-white">
              <img src={previewUrl} alt="תצוגה מקדימה" className="w-full" />
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm font-medium">אמצעי שליחה</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={sendWhatsApp}
                  onCheckedChange={(checked) => setSendWhatsApp(!!checked)}
                />
                <MessageCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">וואטסאפ</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={sendEmail}
                  onCheckedChange={(checked) => setSendEmail(!!checked)}
                />
                <Mail className="h-4 w-4 text-blue-600" />
                <span className="text-sm">אימייל</span>
              </label>
            </div>
          </div>

          {sendWhatsApp && (
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <div>
                <Label className="text-sm">קבוצת וואטסאפ (חיפוש לפי שם)</Label>
                <GroupCombobox
                  groups={groups || []}
                  value={selectedGroupId}
                  onChange={setSelectedGroupId}
                />
              </div>
              <div>
                <Label htmlFor="direct-phone" className="text-sm">
                  או מספר טלפון ישיר
                </Label>
                <Input
                  id="direct-phone"
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
                <Label htmlFor="email" className="text-sm">כתובת אימייל של הנמען</Label>
                <Input
                  id="email"
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="example@email.com"
                  dir="ltr"
                />
              </div>

              <div>
                <Label className="text-sm mb-2 block">שלח מ-</Label>
                <RadioGroup
                  value={emailSender}
                  onValueChange={(v) => setEmailSender(v as "aios" | "gmail")}
                  className="space-y-1"
                >
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <RadioGroupItem value="aios" id="sender-aios" />
                    <span>
                      AIOS{" "}
                      <span className="text-muted-foreground text-xs">(noreply@aios.co.il)</span>
                    </span>
                  </label>
                  <label className={cn(
                    "flex items-center gap-2 text-sm",
                    gmailToken?.google_email ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                  )}>
                    <RadioGroupItem
                      value="gmail"
                      id="sender-gmail"
                      disabled={!gmailToken?.google_email}
                    />
                    <span>
                      Gmail שלי{" "}
                      {gmailToken?.google_email
                        ? <span className="text-muted-foreground text-xs">({gmailToken.google_email})</span>
                        : <span className="text-muted-foreground text-xs">(לא מחובר)</span>
                      }
                    </span>
                  </label>
                </RadioGroup>
              </div>
            </div>
          )}

          {shareLink ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <Link2 className="h-4 w-4 shrink-0" />
              <span>קישור צפייה בטבלה יצורף אוטומטית להודעה</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <Link2 className="h-4 w-4 shrink-0 opacity-50" />
              <span>אין קישור שיתוף פעיל — צור קישור דרך "שתף טבלה" כדי לצרף לינק</span>
            </div>
          )}

          <div>
            <Label htmlFor="message-text" className="text-sm">טקסט מלווה (אופציונלי)</Label>
            <Textarea
              id="message-text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="הודעה שתצורף לדוח..."
              rows={3}
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={isSending || !screenshotBlob}
            className="w-full"
          >
            {isSending ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                שולח...
              </>
            ) : (
              <>
                <Send className="ml-2 h-4 w-4" />
                שלח דוח
              </>
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
  group_chat_id?: string | null;
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
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 justify-between font-normal"
          >
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
                    <Check
                      className={cn(
                        "ml-2 h-4 w-4",
                        value === group.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {group.group_name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange("")}
          title="נקה בחירה"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Mail, MessageCircle, Loader2, Link2 } from "lucide-react";

interface SendReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  screenshotBlob: Blob | null;
  tableName: string;
  tableId: string;
  clientId?: string | null;
  tenantId: string;
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
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Generate preview URL from blob
  useEffect(() => {
    if (screenshotBlob) {
      const url = URL.createObjectURL(screenshotBlob);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [screenshotBlob]);

  // Fetch client data
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

  // Fetch WhatsApp groups
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

  // Fetch active share link for the table
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
        return `https://after-lead.lovable.app/shared/table/${shareData.share_token}`;
      }
      return null;
    },
    enabled: open && !!tableId,
  });

  // Pre-fill from client data
  useEffect(() => {
    if (client) {
      if (client.phone) setDirectPhone(client.phone);
      if (client.email) setEmailAddress(client.email);
      if (client.whatsapp_group_id) setSelectedGroupId(client.whatsapp_group_id);
    }
  }, [client]);

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
      // Send via WhatsApp
      if (sendWhatsApp) {
        const hasGroup = selectedGroupId && selectedGroupId !== "__none__";
        if (!hasGroup && !directPhone) {
          toast.error("יש לבחור קבוצה או להזין מספר טלפון");
          setIsSending(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        // Build caption with optional share link
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
        if (clientId) {
          formData.append("clientId", clientId);
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-green-api-file`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            body: formData,
          }
        );

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "שגיאה בשליחה בוואטסאפ");
        toast.success("הדוח נשלח בוואטסאפ בהצלחה");
      }

      // Send via Email (placeholder - show toast for now)
      if (sendEmail) {
        if (!emailAddress) {
          toast.error("יש להזין כתובת אימייל");
          setIsSending(false);
          return;
        }
        // TODO: Implement email sending edge function
        toast.info("שליחה באימייל תתווסף בקרוב");
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
          {/* Screenshot Preview */}
          {previewUrl && (
            <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-white">
              <img src={previewUrl} alt="תצוגה מקדימה" className="w-full" />
            </div>
          )}

          {/* Delivery Methods */}
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

          {/* WhatsApp Options */}
          {sendWhatsApp && (
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <div>
                <Label htmlFor="whatsapp-group" className="text-sm">קבוצת וואטסאפ</Label>
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר קבוצה..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא קבוצה - שלח לטלפון</SelectItem>
                    {groups?.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.group_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(!selectedGroupId || selectedGroupId === "__none__") && (
                <div>
                  <Label htmlFor="direct-phone" className="text-sm">מספר טלפון</Label>
                  <Input
                    id="direct-phone"
                    value={directPhone}
                    onChange={(e) => setDirectPhone(e.target.value)}
                    placeholder="05xxxxxxxx"
                  />
                </div>
              )}
            </div>
          )}

          {/* Email Options */}
          {sendEmail && (
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <div>
                <Label htmlFor="email" className="text-sm">כתובת אימייל</Label>
                <Input
                  id="email"
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="example@email.com"
                />
              </div>
            </div>
          )}

          {/* Share Link Info */}
          {shareLink && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <Link2 className="h-4 w-4 shrink-0" />
              <span>קישור צפייה בטבלה יצורף אוטומטית להודעה</span>
            </div>
          )}
          {!shareLink && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <Link2 className="h-4 w-4 shrink-0 opacity-50" />
              <span>אין קישור שיתוף פעיל — צור קישור דרך "שתף טבלה" כדי לצרף לינק</span>
            </div>
          )}

          {/* Message Text */}
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

          {/* Send Button */}
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

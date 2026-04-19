import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Send,
  Loader2,
  Camera,
} from "lucide-react";
import { useTenantPath } from "@/hooks/useTenantPath";
import { toPng } from "html-to-image";
import { buildBrandedEmailHtml } from "@/lib/emailTemplate";
import { EmailRecipientsSelector, type EmailOption } from "./EmailRecipientsSelector";
import { ClientDashboardSnapshot } from "./ClientDashboardSnapshot";
import { WhatsAppGroupSelect } from "./WhatsAppGroupSelect";

interface ClientDashboardPanelProps {
  dashboard: { id: string; name: string };
  clientId: string;
  tenantId: string;
}

const CACHE_KEY_PREFIX = "dashboard-screenshot-";

function generateReadableToken(name: string): string {
  const hebrewMap: Record<string, string> = {
    'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z',
    'ח': 'ch', 'ט': 't', 'י': 'y', 'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm',
    'ם': 'm', 'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p', 'ף': 'f',
    'צ': 'ts', 'ץ': 'ts', 'ק': 'k', 'ר': 'r', 'ש': 'sh', 'ת': 't',
  };
  const firstWord = (name || 'dashboard').trim().split(/\s+/)[0] || 'dashboard';
  const transliterated = firstWord.split('').map((ch) => hebrewMap[ch] || ch).join('');
  const slug = transliterated.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  const shortId = Math.random().toString(36).slice(2, 6);
  return `${slug || 'dashboard'}-${shortId}`;
}

export function ClientDashboardPanel({ dashboard, clientId, tenantId }: ClientDashboardPanelProps) {
  const { buildPath } = useTenantPath();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const snapshotRef = useRef<HTMLDivElement>(null);

  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [snapshotMounted, setSnapshotMounted] = useState(false);
  const autoCapturedRef = useRef<string | null>(null);

  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [directPhone, setDirectPhone] = useState("");
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY_PREFIX + dashboard.id);
    if (cached) {
      setScreenshotUrl(cached);
      fetch(cached)
        .then((r) => r.blob())
        .then(setScreenshotBlob)
        .catch(() => {});
    }
  }, [dashboard.id]);

  const { data: client } = useQuery({
    queryKey: ["client-for-dashboard-panel", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, phone, email, whatsapp_group_id")
        .eq("id", clientId)
        .single();
      return data;
    },
    enabled: !!clientId,
  });

  const { data: groups } = useQuery({
    queryKey: ["whatsapp-groups-for-dashboard", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_groups")
        .select("id, group_name, group_chat_id")
        .eq("tenant_id", tenantId)
        .eq("is_blocked", false)
        .order("group_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: teamMembers } = useQuery({
    queryKey: ["tenant-team-emails-dashboard", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigners")
        .select("id, full_name, email")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .not("email", "is", null)
        .order("full_name");
      return (data || []).map((c: any) => ({ campaigners: { full_name: c.full_name, email: c.email } }));
    },
    enabled: !!tenantId,
  });

  const { data: shareLink } = useQuery({
    queryKey: ["dashboard-share-link", dashboard.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("dashboard_shares")
        .select("share_token, is_active")
        .eq("dashboard_id", dashboard.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const shareData = data as any;
      if (shareData?.share_token) {
        return shareData.share_token as string;
      }
      return null;
    },
    enabled: !!dashboard.id,
  });

  useEffect(() => {
    if (client) {
      if (client.phone) setDirectPhone(client.phone);
      if (client.email) setEmailRecipients((prev) => (prev.length === 0 ? [client.email!] : prev));
      if (client.whatsapp_group_id) setSelectedGroupId(client.whatsapp_group_id);
    }
  }, [client]);

  const ensureShareToken = useCallback(async (): Promise<string | null> => {
    if (shareLink) return shareLink;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Check for ANY existing share row (active or inactive) to avoid duplicates
      const { data: existing } = await supabase
        .from("dashboard_shares")
        .select("share_token, is_active")
        .eq("dashboard_id", dashboard.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const existingRow = existing as any;
      if (existingRow?.share_token) {
        if (!existingRow.is_active) {
          await supabase
            .from("dashboard_shares")
            .update({ is_active: true } as any)
            .eq("dashboard_id", dashboard.id)
            .eq("share_token", existingRow.share_token);
        }
        queryClient.invalidateQueries({ queryKey: ["dashboard-share-link", dashboard.id] });
        return existingRow.share_token as string;
      }

      const newToken = generateReadableToken(dashboard.name);
      const { data, error } = await supabase
        .from("dashboard_shares")
        .insert({
          dashboard_id: dashboard.id,
          tenant_id: tenantId,
          created_by: user.id,
          allowed_emails: [],
          share_token: newToken,
        } as any)
        .select("share_token")
        .single();
      if (error) throw error;
      const token = (data as any)?.share_token;
      if (!token) return null;
      queryClient.invalidateQueries({ queryKey: ["dashboard-share-link", dashboard.id] });
      toast.success("נוצר קישור שיתוף חדש");
      return token;
    } catch (err) {
      console.error("Failed to create share link", err);
      return null;
    }
  }, [shareLink, dashboard.id, dashboard.name, tenantId, queryClient]);

  const shareUrl = shareLink ? `https://after-lead.lovable.app/shared/dashboard/${shareLink}` : null;

  // Mount snapshot once we have the share token
  useEffect(() => {
    if (shareLink) {
      setSnapshotMounted(true);
    }
  }, [shareLink]);

  const captureScreenshot = useCallback(async (): Promise<Blob | null> => {
    const node = snapshotRef.current;
    if (!node) {
      toast.error("רכיב הצילום עדיין לא נטען");
      return null;
    }

    setIsCapturing(true);
    try {
      // Wait for data to load and render inside the snapshot
      await new Promise((r) => setTimeout(r, 2500));

      const dataUrl = await toPng(node, {
        quality: 0.92,
        pixelRatio: 1.5,
        backgroundColor: "#ffffff",
        skipFonts: true,
        cacheBust: true,
      });

      if (!dataUrl || dataUrl.length < 1000) {
        throw new Error("הצילום ריק");
      }

      setScreenshotUrl(dataUrl);
      try {
        localStorage.setItem(CACHE_KEY_PREFIX + dashboard.id, dataUrl);
      } catch {
        // localStorage quota exceeded - skip cache
      }
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      setScreenshotBlob(blob);
      toast.success("צילום הדשבורד נוצר");
      return blob;
    } catch (err: any) {
      console.error("Dashboard screenshot error:", err);
      toast.error(`שגיאה בצילום: ${err?.message || "לא ידוע"}`);
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [dashboard.id]);

  // Auto-capture once snapshot is mounted (only first time per dashboard)
  useEffect(() => {
    if (
      snapshotMounted &&
      !screenshotUrl &&
      !isCapturing &&
      autoCapturedRef.current !== dashboard.id
    ) {
      autoCapturedRef.current = dashboard.id;
      const t = setTimeout(() => captureScreenshot(), 3000);
      return () => clearTimeout(t);
    }
  }, [snapshotMounted, screenshotUrl, isCapturing, captureScreenshot, dashboard.id]);

  const handleSend = async () => {
    let blob = screenshotBlob;
    if (!blob) {
      toast.info("מצלם דשבורד...");
      blob = await captureScreenshot();
      if (!blob) {
        toast.error("לא נוצר צילום מסך - לחץ על 'צלם מחדש' ונסה שוב");
        return;
      }
    }
    setIsSending(true);
    try {
      let effectiveShareUrl = shareUrl;
      if (!effectiveShareUrl) {
        const token = await ensureShareToken();
        if (token) effectiveShareUrl = `https://after-lead.lovable.app/shared/dashboard/${token}`;
      }

      if (sendWhatsApp) {
        const formData = new FormData();
        formData.append("file", blob, `dashboard-${dashboard.name}.png`);
        formData.append("tenantId", tenantId);
        formData.append("fileType", "image");
        const caption = `${messageText}\n\n📊 צפה בדשבורד המלא: ${effectiveShareUrl || ""}`;
        formData.append("caption", caption);
        if (selectedGroupId && selectedGroupId !== "__none__") formData.append("groupId", selectedGroupId);
        else if (directPhone) formData.append("phoneNumber", directPhone);
        if (clientId) formData.append("clientId", clientId);

        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-green-api-file`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.access_token}` },
          body: formData,
        });
        if (!response.ok) throw new Error("שגיאה בשליחת וואטסאפ");
        toast.success("הדשבורד נשלח בוואטסאפ");
      }

      if (sendEmail) {
        if (emailRecipients.length === 0) {
          toast.error("יש לבחור לפחות נמען אימייל אחד");
          setIsSending(false);
          return;
        }
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(blob!);
        });

        const bodyHtml = buildBrandedEmailHtml({
          title: `דשבורד ${dashboard.name}`,
          subtitle: client?.name ? `עבור ${client.name}` : undefined,
          message: messageText,
          ctaUrl: effectiveShareUrl || undefined,
          ctaLabel: "צפה בדשבורד המלא",
          hasAttachment: true,
          attachmentNote: "צילום הדשבורד מצורף כקובץ לנוחותך",
        });

        const { error: gmailError } = await supabase.functions.invoke("gmail-api", {
          body: {
            action: "send",
            to: emailRecipients.join(", "),
            subject: `דשבורד ${dashboard.name}${client?.name ? ` - ${client.name}` : ""}`,
            body: bodyHtml,
            attachments: [{ filename: "dashboard.png", mimeType: "image/png", data: base64Data }],
          },
        });
        if (gmailError) {
          const msg = String(gmailError.message || "");
          if (msg.includes("Token refresh failed") || msg.includes("invalid_grant")) {
            toast.error("חיבור Gmail פג - יש להתחבר מחדש בהגדרות");
          } else {
            throw gmailError;
          }
        } else {
          toast.success("הדשבורד נשלח באימייל");
        }
      }
    } catch (e: any) {
      console.error("Send error:", e);
      toast.error(`שגיאה בשליחה: ${e?.message || "לא ידוע"}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleManualCapture = async () => {
    if (!shareLink) {
      toast.info("יוצר קישור שיתוף...");
      const token = await ensureShareToken();
      if (!token) {
        toast.error("לא ניתן ליצור קישור שיתוף");
        return;
      }
      setSnapshotMounted(true);
      // Wait for snapshot to mount + render
      await new Promise((r) => setTimeout(r, 500));
    }
    await captureScreenshot();
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Screenshot preview (replaces iframe) */}
      <div className="border rounded-lg overflow-hidden bg-muted/10 min-h-[400px] flex items-center justify-center">
        {screenshotUrl ? (
          <img
            src={screenshotUrl}
            alt={`Dashboard: ${dashboard.name}`}
            className="w-full h-auto"
          />
        ) : isCapturing ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">מצלם דשבורד...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Camera className="h-8 w-8" />
            <span className="text-sm">לחץ על "צלם דשבורד" כדי להתחיל</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Button type="button" variant="outline" size="sm" onClick={handleManualCapture} disabled={isCapturing}>
          {isCapturing ? (
            <><Loader2 className="ml-2 h-3 w-3 animate-spin" /> מצלם...</>
          ) : (
            <><Camera className="ml-2 h-3 w-3" /> {screenshotBlob ? "צלם מחדש" : "צלם דשבורד"}</>
          )}
        </Button>
        {screenshotBlob && <span className="text-primary">✓ צילום מוכן לשליחה</span>}
      </div>

      <div className="p-4 border rounded-lg bg-muted/20 space-y-4">

        <div className="flex gap-4">
          <label className="flex items-center gap-2"><Checkbox checked={sendWhatsApp} onCheckedChange={(c) => setSendWhatsApp(!!c)} /> וואטסאפ</label>
          <label className="flex items-center gap-2"><Checkbox checked={sendEmail} onCheckedChange={(c) => setSendEmail(!!c)} /> אימייל</label>
        </div>

        {sendWhatsApp && (
          <WhatsAppGroupSelect
            groups={groups}
            value={selectedGroupId}
            onValueChange={setSelectedGroupId}
          />
        )}

        {sendEmail && (
          <EmailRecipientsSelector
            options={[
              ...(client?.email
                ? [{
                    email: client.email,
                    label: `${client.name} (לקוח)`,
                    icon: "📋",
                  } satisfies EmailOption]
                : []),
              ...((teamMembers || []).map((t: any) => ({
                email: t.campaigners.email,
                label: `${t.campaigners.full_name}${t.role_on_account ? ` (${t.role_on_account})` : ""}`,
                icon: "👤",
              } satisfies EmailOption))),
            ]}
            selectedEmails={emailRecipients}
            onChange={setEmailRecipients}
          />
        )}

        <Textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="טקסט מלווה..." />
        
        <Button onClick={handleSend} disabled={isSending} className="w-full">
          {isSending ? <Loader2 className="animate-spin" /> : <><Send className="ml-2" /> שלח סיכום</>}
        </Button>
      </div>

      {/* Hidden snapshot rendered via portal — mirrors ClientReportPanel pattern. */}
      {snapshotMounted && shareLink && createPortal(
        <div
          style={{
            position: "fixed",
            left: -9999,
            top: -9999,
            zIndex: -9999,
            pointerEvents: "none",
            opacity: 0,
          }}
          aria-hidden="true"
        >
          <ClientDashboardSnapshot ref={snapshotRef} shareToken={shareLink} />
        </div>,
        document.body
      )}
    </div>
  );
}

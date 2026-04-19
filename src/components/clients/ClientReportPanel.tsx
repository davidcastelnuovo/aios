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
  Mail,
  MessageCircle,
  Loader2,
  Link2,
  RefreshCw,
  ExternalLink,
  Camera,
} from "lucide-react";
import { useTenantPath } from "@/hooks/useTenantPath";
import { ClientReportSnapshot } from "./ClientReportSnapshot";
import { SeoCombinedSnapshot } from "./SeoCombinedSnapshot";
import { toPng } from "html-to-image";
import { buildBrandedEmailHtml } from "@/lib/emailTemplate";
import { EmailRecipientsSelector, type EmailOption } from "./EmailRecipientsSelector";

interface ClientReportPanelProps {
  table: any;
  clientId: string;
  tenantId: string;
}

const CACHE_KEY_PREFIX = "report-screenshot-";

function getSyncFunction(integrationType: string | null): string | null {
  switch (integrationType) {
    case "facebook_insights":
    case "facebook_ecommerce":
      return "sync-facebook-insights";
    case "google_ads":
      return "sync-google-ads-data";
    default:
      return null;
  }
}

function generateReadableToken(tableName: string): string {
  const hebrewMap: Record<string, string> = {
    'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z',
    'ח': 'ch', 'ט': 't', 'י': 'y', 'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm',
    'ם': 'm', 'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p', 'ף': 'f',
    'צ': 'ts', 'ץ': 'ts', 'ק': 'k', 'ר': 'r', 'ש': 'sh', 'ת': 't',
  };
  const firstWord = (tableName || 'report').trim().split(/\s+/)[0] || 'report';
  const transliterated = firstWord.split('').map((ch) => hebrewMap[ch] || ch).join('');
  const slug = transliterated.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  const shortId = Math.random().toString(36).slice(2, 6);
  return `${slug || 'report'}-${shortId}`;
}

export function ClientReportPanel({ table, clientId, tenantId }: ClientReportPanelProps) {
  const { buildPath } = useTenantPath();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const snapshotRef = useRef<HTMLDivElement>(null);

  // Screenshot state
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [captureReady, setCaptureReady] = useState(false);
  const autoCapturedTableRef = useRef<string | null>(null);

  // Send controls state
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [directPhone, setDirectPhone] = useState("");
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null);

  // Fetch client data
  const { data: client } = useQuery({
    queryKey: ["client-for-report-panel", clientId],
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
    enabled: !!tenantId,
  });

  // Fetch all active team members in tenant
  const { data: teamMembers } = useQuery({
    queryKey: ["tenant-team-emails", tenantId],
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

  // Fetch share link (any existing — active or inactive)
  const { data: shareLink } = useQuery({
    queryKey: ["table-share-link", table.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("table_shares" as any)
        .select("share_token, is_active")
        .eq("table_id", table.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const shareData = data as any;
      if (shareData?.share_token) {
        return `https://after-lead.com/shared/table/${shareData.share_token}`;
      }
      return null;
    },
    enabled: !!table.id,
  });

  // Pre-fill from client data
  useEffect(() => {
    if (client) {
      if (client.phone) setDirectPhone(client.phone);
      if (client.email) setEmailRecipients((prev) => (prev.length === 0 ? [client.email!] : prev));
      if (client.whatsapp_group_id) setSelectedGroupId(client.whatsapp_group_id);
    }
  }, [client]);

  // On every table open: clear stale screenshot, sync data, then capture fresh
  useEffect(() => {
    autoCapturedTableRef.current = null;
    setCaptureReady(false);
    setScreenshotBlob(null);

    // Show stale cached image only as a placeholder while we sync+recapture
    const cached = localStorage.getItem(CACHE_KEY_PREFIX + table.id);
    setScreenshotUrl(cached || null);

    let cancelled = false;

    (async () => {
      // 1. Sync underlying data (if integration supports it)
      const syncFn = getSyncFunction(table.integration_type);
      if (syncFn) {
        setIsSyncing(true);
        try {
          await supabase.functions.invoke(syncFn, {
            body: { tableId: table.id, tenantId },
          });
        } catch (err) {
          console.error("Sync error:", err);
        } finally {
          if (!cancelled) setIsSyncing(false);
        }
      }

      // 2. Force the snapshot subtree to refetch its queries (ahrefs/GSC/GA/etc.)
      await queryClient.invalidateQueries({ queryKey: ["client-report-data", table.id] });
      await queryClient.invalidateQueries({ queryKey: ["seo-combined-snapshot", table.id] });
      await queryClient.invalidateQueries({ queryKey: ["ahrefs-reports"] });
      await queryClient.invalidateQueries({ queryKey: ["gsc-keywords"] });

      // 3. Wait for the snapshot DOM to render with fresh data, then capture
      const delay = table.integration_type === "ahrefs" ? 6000 : 3000;
      window.setTimeout(() => {
        if (!cancelled) setCaptureReady(true);
      }, delay);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.id, table.integration_type, tenantId]);

  // Auto-capture when ready (always re-shoots, even if a cached image exists)
  useEffect(() => {
    if (!captureReady || isCapturing || autoCapturedTableRef.current === table.id) return;
    autoCapturedTableRef.current = table.id;
    captureScreenshot();
  }, [captureReady, isCapturing, table.id]);

  const triggerSync = async () => {
    const syncFn = getSyncFunction(table.integration_type);
    if (!syncFn) {
      // Even without a dedicated sync fn, refresh queries + recapture
      await queryClient.invalidateQueries({ queryKey: ["client-report-data", table.id] });
      await queryClient.invalidateQueries({ queryKey: ["seo-combined-snapshot", table.id] });
      setTimeout(() => captureScreenshot(), 1500);
      return;
    }

    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.functions.invoke(syncFn, {
        body: { tableId: table.id, tenantId },
      });
      await queryClient.invalidateQueries({ queryKey: ["client-report-data", table.id] });
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setIsSyncing(false);
      // Re-capture after sync
      setTimeout(() => captureScreenshot(), 2000);
    }
  };

  const captureScreenshot = useCallback(async () => {
    const node = snapshotRef.current;
    if (!node) return;

    setIsCapturing(true);
    try {
      const dataUrl = await toPng(node, {
        quality: 0.9,
        pixelRatio: 1.5,
        backgroundColor: "#ffffff",
        skipFonts: true,
      });

      setScreenshotUrl(dataUrl);
      try {
        localStorage.setItem(CACHE_KEY_PREFIX + table.id, dataUrl);
      } catch { /* localStorage full */ }

      // Create blob for sending
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      setScreenshotBlob(blob);
    } catch (err) {
      console.error("Screenshot capture error:", err);
      toast.error("שגיאה בצילום הדוח");
    } finally {
      setIsCapturing(false);
    }
  }, [table.id]);

  const ensureShareLink = useCallback(async (): Promise<string | null> => {
    if (shareLink) return shareLink;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const newToken = generateReadableToken(table.name);
      const { data, error } = await supabase
        .from("table_shares" as any)
        .insert({
          table_id: table.id,
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
      const url = `https://after-lead.com/shared/table/${token}`;
      queryClient.invalidateQueries({ queryKey: ["table-share-link", table.id] });
      toast.success("נוצר קישור שיתוף חדש");
      return url;
    } catch (err) {
      console.error("Failed to create share link", err);
      return null;
    }
  }, [shareLink, table.id, table.name, tenantId, queryClient]);

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
      // Auto-create share link if missing
      const effectiveShareLink = shareLink || (await ensureShareLink());

      if (sendWhatsApp) {
        const hasGroup = selectedGroupId && selectedGroupId !== "__none__";
        if (!hasGroup && !directPhone) {
          toast.error("יש לבחור קבוצה או להזין מספר טלפון");
          setIsSending(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const captionParts: string[] = [];
        if (messageText) captionParts.push(messageText);
        if (effectiveShareLink) captionParts.push(`\n📊 צפה בדוח המלא: ${effectiveShareLink}`);
        const fullCaption = captionParts.join("");

        const formData = new FormData();
        formData.append("file", screenshotBlob, `report-${table.name}.png`);
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
          {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: formData,
          }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "שגיאה בשליחה");
        toast.success("הדוח נשלח בוואטסאפ בהצלחה");
      }

      if (sendEmail) {
        if (emailRecipients.length === 0) {
          toast.error("יש לבחור לפחות נמען אימייל אחד");
          setIsSending(false);
          return;
        }

        // Convert blob to base64
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1] || "");
          };
          reader.onerror = reject;
          reader.readAsDataURL(screenshotBlob);
        });

        const subject = `דוח ${table.name}${client?.name ? ` - ${client.name}` : ""}`;
        const bodyHtml = buildBrandedEmailHtml({
          title: `דוח ${table.name}`,
          subtitle: client?.name ? `עבור ${client.name}` : undefined,
          message: messageText,
          ctaUrl: effectiveShareLink || undefined,
          ctaLabel: "צפה בדוח המלא",
          hasAttachment: true,
          attachmentNote: "הדוח המלא מצורף כקובץ תמונה לנוחותך",
        });

        const { data, error } = await supabase.functions.invoke("gmail-api", {
          body: {
            action: "send",
            to: emailRecipients.join(", "),
            subject,
            body: bodyHtml,
            attachments: [
              {
                filename: `report-${table.name}.png`,
                mimeType: "image/png",
                data: base64Data,
              },
            ],
          },
        });

        if (error) throw new Error(error.message || "שגיאה בשליחה");
        if (data?.error) throw new Error(data.error);
        toast.success("הדוח נשלח באימייל בהצלחה");
      }
    } catch (error: any) {
      console.error("Error sending report:", error);
      const msg = String(error?.message || "");
      const isGmailAuthIssue =
        msg.includes("Token refresh failed") ||
        msg.includes("Gmail not connected") ||
        msg.includes("invalid_grant");
      if (isGmailAuthIssue) {
        toast.error("חיבור ה-Gmail פג. יש להתחבר מחדש.", {
          action: {
            label: "התחבר מחדש",
            onClick: () => navigate(buildPath("/gmail-settings")),
          },
          duration: 8000,
        });
      } else {
        toast.error("שגיאה בשליחת הדוח: " + msg);
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-3" dir="rtl">
      {/* Screenshot Preview */}
      <div className="relative border rounded-lg overflow-hidden bg-muted/20" style={{ minHeight: 200 }}>
        {screenshotUrl ? (
          <img
            src={screenshotUrl}
            alt={`דוח ${table.name}`}
            className="w-full object-contain"
          />
        ) : (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            <Camera className="h-5 w-5 ml-2 opacity-50" />
            ממתין לצילום דוח...
          </div>
        )}

        {(isCapturing || isSyncing) && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{isSyncing ? "מסנכרן נתונים..." : "מצלם דוח..."}</span>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => triggerSync()}
          disabled={isSyncing || isCapturing}
        >
          <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
          סנכרן ולכוד
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => captureScreenshot()}
          disabled={isCapturing}
        >
          <Camera className={`h-3 w-3 ${isCapturing ? "animate-spin" : ""}`} />
          צלם מחדש
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs mr-auto"
          onClick={() => window.open(buildPath(`/table/${table.slug}`), "_blank")}
        >
          <ExternalLink className="h-3 w-3" />
          פתח דוח
        </Button>
      </div>

      {/* Send Controls */}
      <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={sendWhatsApp} onCheckedChange={(c) => setSendWhatsApp(!!c)} />
            <MessageCircle className="h-3.5 w-3.5 text-green-600" />
            <span className="text-xs">וואטסאפ</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={sendEmail} onCheckedChange={(c) => setSendEmail(!!c)} />
            <Mail className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs">אימייל</span>
          </label>
        </div>

        {sendWhatsApp && (
          <div className="space-y-2">
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="בחר קבוצה..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ללא קבוצה - שלח לטלפון</SelectItem>
                {groups?.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.group_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(!selectedGroupId || selectedGroupId === "__none__") && (
              <Input
                value={directPhone}
                onChange={(e) => setDirectPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                className="h-8 text-xs"
              />
            )}
          </div>
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

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link2 className={`h-3 w-3 shrink-0 ${shareLink ? "" : "opacity-50"}`} />
          <span className="flex-1">{shareLink ? "קישור צפייה יצורף אוטומטית" : "אין קישור שיתוף פעיל"}</span>
          {!shareLink && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={() => ensureShareLink()}
            >
              צור קישור
            </Button>
          )}
        </div>

        <Textarea
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="טקסט מלווה (אופציונלי)..."
          rows={2}
          className="text-xs"
        />

        <Button
          onClick={handleSend}
          disabled={isSending || !screenshotBlob}
          size="sm"
          className="w-full gap-1"
        >
          {isSending ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> שולח...</>
          ) : (
            <><Send className="h-3.5 w-3.5" /> שלח דוח</>
          )}
        </Button>
      </div>

      {/* Hidden snapshot component rendered via portal — no iframe! */}
      {createPortal(
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
          {table.integration_type === "ahrefs" ? (
            <SeoCombinedSnapshot
              ref={snapshotRef}
              tableId={table.id}
              tableName={table.name}
            />
          ) : (
            <ClientReportSnapshot
              ref={snapshotRef}
              tableId={table.id}
              tableName={table.name}
            />
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

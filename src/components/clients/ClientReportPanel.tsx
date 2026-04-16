import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

export function ClientReportPanel({ table, clientId, tenantId }: ClientReportPanelProps) {
  const { buildPath } = useTenantPath();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Screenshot state
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Send controls state
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [directPhone, setDirectPhone] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null);

  // Load cached screenshot
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY_PREFIX + table.id);
    if (cached) setScreenshotUrl(cached);
  }, [table.id]);

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

  // Fetch team members for this client
  const { data: teamMembers } = useQuery({
    queryKey: ["client-team-emails", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_team")
        .select("id, campaigner_id, role_on_account, campaigners(full_name, email)")
        .eq("client_id", clientId);
      return (data || []).filter((t: any) => t.campaigners?.email);
    },
    enabled: !!clientId,
  });

  // Fetch share link
  const { data: shareLink } = useQuery({
    queryKey: ["table-share-link", table.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("table_shares" as any)
        .select("share_token, is_active")
        .eq("table_id", table.id)
        .eq("is_active", true)
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
      if (client.email) setEmailAddress(client.email);
      if (client.whatsapp_group_id) setSelectedGroupId(client.whatsapp_group_id);
    }
  }, [client]);

  // Auto-sync on mount
  useEffect(() => {
    const syncFn = getSyncFunction(table.integration_type);
    if (syncFn) {
      triggerSync();
    } else {
      // No sync needed, just capture screenshot after iframe loads
      captureScreenshot();
    }
  }, [table.id]);

  const triggerSync = async () => {
    const syncFn = getSyncFunction(table.integration_type);
    if (!syncFn) return;

    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke(syncFn, {
        body: { tableId: table.id, tenantId },
      });
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setIsSyncing(false);
      // Capture screenshot after sync
      setTimeout(() => captureScreenshot(), 2000);
    }
  };

  const captureScreenshot = useCallback(async () => {
    setIsCapturing(true);
    try {
      // Wait for iframe content to render
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const iframe = iframeRef.current;
      if (!iframe) {
        setIsCapturing(false);
        return;
      }

      // Access the iframe's inner document (same-origin)
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc?.body) {
        console.error("Cannot access iframe document");
        setIsCapturing(false);
        return;
      }

      const { toPng } = await import("html-to-image");
      const targetEl = iframeDoc.querySelector('[data-embed-root]') as HTMLElement || iframeDoc.body;
      const dataUrl = await toPng(targetEl, {
        quality: 0.9,
        pixelRatio: 2,
        cacheBust: true,
        width: targetEl.scrollWidth,
        height: targetEl.scrollHeight,
      });

      setScreenshotUrl(dataUrl);
      // Cache in localStorage (limit size to avoid quota issues)
      try {
        localStorage.setItem(CACHE_KEY_PREFIX + table.id, dataUrl);
      } catch { /* localStorage full, skip caching */ }

      // Convert to blob for sending
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      setScreenshotBlob(blob);
    } catch (err) {
      console.error("Screenshot capture error:", err);
    } finally {
      setIsCapturing(false);
    }
  }, [table.id]);

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
        if (shareLink) captionParts.push(`\n📊 צפה בדוח המלא: ${shareLink}`);
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
        if (!emailAddress) {
          toast.error("יש להזין כתובת אימייל");
          setIsSending(false);
          return;
        }
        toast.info("שליחה באימייל תתווסף בקרוב");
      }
    } catch (error: any) {
      console.error("Error sending report:", error);
      toast.error("שגיאה בשליחת הדוח: " + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const iframeSrc = `${window.location.origin}${buildPath(`/table/${table.slug}?embed=1`)}`;

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

        {/* Loading overlay */}
        {(isCapturing || isSyncing) && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{isSyncing ? "מסנכרן נתונים..." : "מצלם דוח..."}</span>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons row */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => { triggerSync(); }}
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
        {/* Delivery Methods */}
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

        {/* WhatsApp Options */}
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

        {/* Email */}
        {sendEmail && (
          <Input
            type="email"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            placeholder="example@email.com"
            className="h-8 text-xs"
          />
        )}

        {/* Share Link Info */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link2 className={`h-3 w-3 shrink-0 ${shareLink ? "" : "opacity-50"}`} />
          <span>{shareLink ? "קישור צפייה יצורף אוטומטית" : "אין קישור שיתוף פעיל"}</span>
        </div>

        {/* Message */}
        <Textarea
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="טקסט מלווה (אופציונלי)..."
          rows={2}
          className="text-xs"
        />

        {/* Send Button */}
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

      {/* Hidden iframe for screenshot capture */}
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        className="border-0 absolute"
        style={{ width: 1200, height: 800, left: -9999, top: -9999, position: "fixed", opacity: 0, pointerEvents: "none" }}
        title={table.name}
        onLoad={() => {
          if (!screenshotUrl && !isCapturing && !isSyncing) {
            captureScreenshot();
          }
        }}
      />
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
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
  Camera,
  Maximize2,
  LayoutDashboard,
  Search,
  Megaphone,
} from "lucide-react";
import { useTenantPath } from "@/hooks/useTenantPath";
import { toPng } from "html-to-image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailRecipientsSelector, type EmailOption } from "./EmailRecipientsSelector";

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
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

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
    if (cached) setScreenshotUrl(cached);
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
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const shareData = data as any;
      if (shareData?.share_token) {
        return `https://after-lead.lovable.app/shared/dashboard/${shareData.share_token}`;
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

  const ensureShareLink = useCallback(async (): Promise<string | null> => {
    if (shareLink) return shareLink;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
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
      const url = `https://after-lead.lovable.app/shared/dashboard/${token}`;
      queryClient.invalidateQueries({ queryKey: ["dashboard-share-link", dashboard.id] });
      toast.success("נוצר קישור שיתוף חדש");
      return url;
    } catch (err) {
      console.error("Failed to create share link", err);
      return null;
    }
  }, [shareLink, dashboard.id, dashboard.name, tenantId, queryClient]);

  const captureScreenshot = useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe) {
      toast.error("Iframe לא נטען");
      return;
    }

    setIsCapturing(true);
    try {
      // Wait extra time for charts/data to render
      await new Promise((r) => setTimeout(r, 1500));

      let doc: Document | null = null;
      try {
        doc = iframe.contentDocument;
      } catch (e) {
        console.error("Cannot access iframe contentDocument:", e);
      }
      if (!doc || !doc.body) {
        throw new Error("לא ניתן לגשת לתוכן הדשבורד (cross-origin?)");
      }

      const root = (doc.querySelector("main") as HTMLElement) || doc.body;
      const topHeight = Math.min(root.scrollHeight || 800, 850);
      const width = root.scrollWidth || iframe.clientWidth || 1200;

      const dataUrl = await toPng(root, {
        quality: 0.92,
        pixelRatio: 1.5,
        backgroundColor: "#ffffff",
        height: topHeight,
        width,
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
    } catch (err: any) {
      console.error("Dashboard screenshot error:", err);
      toast.error(`שגיאה בצילום: ${err?.message || "לא ידוע"}`);
    } finally {
      setIsCapturing(false);
    }
  }, [dashboard.id]);

  useEffect(() => {
    if (iframeLoaded && !screenshotUrl && !isCapturing) {
      const t = setTimeout(() => captureScreenshot(), 2500);
      return () => clearTimeout(t);
    }
  }, [iframeLoaded, screenshotUrl, isCapturing, captureScreenshot]);

  const handleSend = async () => {
    if (!screenshotBlob) {
      toast.error("לא נוצר צילום מסך");
      return;
    }
    setIsSending(true);
    try {
      const effectiveShareLink = shareLink || (await ensureShareLink());
      
      if (sendWhatsApp) {
        const formData = new FormData();
        formData.append("file", screenshotBlob, `dashboard-${dashboard.name}.png`);
        formData.append("tenantId", tenantId);
        formData.append("fileType", "image");
        const caption = `${messageText}\n\n📊 צפה בדשבורד המלא: ${effectiveShareLink || ""}`;
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
          reader.readAsDataURL(screenshotBlob);
        });

        await supabase.functions.invoke("gmail-api", {
          body: {
            action: "send",
            to: emailRecipients.join(", "),
            subject: `דשבורד ${dashboard.name}`,
            body: `${messageText}<br/><br/><a href="${effectiveShareLink}">צפה בדשבורד המלא</a>`,
            attachments: [{ filename: "dashboard.png", mimeType: "image/png", data: base64Data }],
          },
        });
        toast.success("הדשבורד נשלח באימייל");
      }
    } catch (e) {
      toast.error("שגיאה בשליחה");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 ml-2" /> דשבורד</TabsTrigger>
          <TabsTrigger value="seo"><Search className="h-4 w-4 ml-2" /> SEO</TabsTrigger>
          <TabsTrigger value="ads"><Megaphone className="h-4 w-4 ml-2" /> מודעות</TabsTrigger>
        </TabsList>
        
        <div className="mt-4 border rounded-lg overflow-hidden h-[500px]">
          <iframe
            ref={iframeRef}
            src={`${window.location.origin}${buildPath(`/dashboard/${dashboard.id}?tab=${activeTab}`)}`}
            className="w-full h-full border-0"
            onLoad={() => setIframeLoaded(true)}
          />
        </div>
      </Tabs>

      <div className="p-4 border rounded-lg bg-muted/20 space-y-4">
        <div className="flex gap-4">
          <label className="flex items-center gap-2"><Checkbox checked={sendWhatsApp} onCheckedChange={(c) => setSendWhatsApp(!!c)} /> וואטסאפ</label>
          <label className="flex items-center gap-2"><Checkbox checked={sendEmail} onCheckedChange={(c) => setSendEmail(!!c)} /> אימייל</label>
        </div>

        {sendWhatsApp && (
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger><SelectValue placeholder="בחר קבוצה..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">מספר טלפון ישיר</SelectItem>
              {groups?.map((g) => <SelectItem key={g.id} value={g.id}>{g.group_name}</SelectItem>)}
            </SelectContent>
          </Select>
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
    </div>
  );
}

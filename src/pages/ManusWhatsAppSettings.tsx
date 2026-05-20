import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTenantPath } from "@/hooks/useTenantPath";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight, Webhook, Key, CheckCircle2, AlertCircle, Copy, ExternalLink, RefreshCw,
} from "lucide-react";

const PROJECT_REF = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string) || "";

function genSecret() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ManusWhatsAppSettings() {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const { buildPath } = useTenantPath();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [instanceId, setInstanceId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [countryCode, setCountryCode] = useState("972");
  const [statusInfo, setStatusInfo] = useState<{ status?: string; phoneNumber?: string } | null>(null);

  const { data: integration, isLoading } = useQuery({
    queryKey: ["manus-wa-integration", tenantId, userId],
    queryFn: async () => {
      if (!tenantId || !userId) return null;
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .eq("integration_type", "manus_wa")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!userId,
  });

  useEffect(() => {
    if (integration) {
      const s = (integration.settings as any) || {};
      setInstanceId(s.instance_id || "");
      setApiKey(integration.api_key || "");
      setWebhookSecret(s.webhook_secret || "");
      setCountryCode(s.country_code || "972");
      setStatusInfo({ status: s.status, phoneNumber: s.phone_number });
    }
  }, [integration]);

  const webhookUrl = `https://${PROJECT_REF}.supabase.co/functions/v1/manus-wa-webhook`;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !userId) throw new Error("משתמש לא מחובר");
      if (!instanceId || !apiKey) throw new Error("נא למלא Instance ID ו-API Key");
      const secret = webhookSecret || genSecret();
      const payload = {
        tenant_id: tenantId,
        user_id: userId,
        integration_type: "manus_wa" as const,
        api_key: apiKey,
        instance_id: instanceId,
        is_active: true,
        api_token_last_4: apiKey.slice(-4),
        settings: {
          instance_id: instanceId,
          webhook_secret: secret,
          country_code: countryCode || "972",
          status: statusInfo?.status,
          phone_number: statusInfo?.phoneNumber,
        },
      };
      if (integration) {
        const { error } = await supabase.from("tenant_integrations").update(payload).eq("id", integration.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tenant_integrations").insert([payload]);
        if (error) throw error;
      }
      setWebhookSecret(secret);
    },
    onSuccess: async () => {
      toast({ title: "נשמר בהצלחה", description: "פרטי החיבור עודכנו" });
      queryClient.invalidateQueries({ queryKey: ["manus-wa-integration", tenantId, userId] });
      queryClient.invalidateQueries({ queryKey: ["integration-manus-wa", tenantId, userId] });
      // Auto-fetch status so phone_number gets persisted — needed for outbound-from-phone detection.
      try {
        const { data: integ } = await supabase
          .from("tenant_integrations")
          .select("id")
          .eq("tenant_id", tenantId!)
          .eq("user_id", userId!)
          .eq("integration_type", "manus_wa")
          .maybeSingle();
        if (integ?.id) {
          const { data } = await supabase.functions.invoke("manus-wa-status", {
            body: { integrationId: integ.id },
          });
          if (data?.success) {
            setStatusInfo({ status: data.status, phoneNumber: data.phoneNumber });
          }
        }
      } catch { /* non-fatal */ }
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "שגיאה", description: e.message }),
  });

  const resyncSecretMutation = useMutation({
    mutationFn: async () => {
      if (!integration?.id) throw new Error("שמור את החיבור תחילה");
      const cur = (integration.settings as any) || {};
      const merged = { ...cur, webhook_secret: "" };
      const { error } = await supabase
        .from("tenant_integrations")
        .update({ settings: merged })
        .eq("id", integration.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setWebhookSecret("");
      toast({
        title: "ממתין לסנכרון",
        description: "שלח הודעת בדיקה ב-WhatsApp — הסוד יילכד אוטומטית מה-webhook הבא",
      });
      queryClient.invalidateQueries({ queryKey: ["manus-wa-integration", tenantId, userId] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "שגיאה", description: e.message }),
  });

  const statusMutation = useMutation({
    mutationFn: async () => {
      if (!integration?.id) throw new Error("שמור את החיבור תחילה");
      const { data, error } = await supabase.functions.invoke("manus-wa-status", {
        body: { integrationId: integration.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "שגיאה בבדיקת סטטוס");
      return data;
    },
    onSuccess: (data) => {
      setStatusInfo({ status: data.status, phoneNumber: data.phoneNumber });
      toast({ title: "סטטוס עודכן", description: `${data.status} · ${data.phoneNumber || ""}` });
      queryClient.invalidateQueries({ queryKey: ["manus-wa-integration", tenantId, userId] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "שגיאה", description: e.message }),
  });

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "הועתק ללוח", description: label });
  };

  const isConnected = statusInfo?.status === "CONNECTED";

  return (
    <div className="container mx-auto p-6 max-w-4xl" dir="rtl">
      <Button variant="ghost" onClick={() => navigate(buildPath("/chat-integrations"))} className="mb-6">
        <ArrowRight className="h-4 w-4 ml-2" />
        חזרה לאינטגרציות
      </Button>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
            <Webhook className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Manus WhatsApp Gateway</h1>
        </div>
        <p className="text-muted-foreground">
          חבר את המערכת לשער ה-WhatsApp שלך ב-Manus לקבלה ושליחה של הודעות
        </p>
      </div>

      {integration?.is_active && (
        <Card className="mb-6 border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">החיבור פעיל</span>
                {isConnected && <Badge variant="outline">{statusInfo?.phoneNumber}</Badge>}
                {statusInfo?.status && (
                  <Badge variant={isConnected ? "default" : "secondary"}>{statusInfo.status}</Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => statusMutation.mutate()} disabled={statusMutation.isPending}>
                <RefreshCw className={`h-4 w-4 ml-2 ${statusMutation.isPending ? "animate-spin" : ""}`} />
                בדוק סטטוס
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              הוראות התקנה
            </CardTitle>
            <CardDescription>שלוש פעולות בדשבורד של Manus</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-2">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0">1</Badge>
                <span>
                  היכנס ל-{" "}
                  <a href="https://whatsappgw-pzpyrrww.manus.space" target="_blank" rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1">
                    Manus WhatsApp Gateway <ExternalLink className="h-3 w-3" />
                  </a>{" "}ובחר את ה-Instance שלך
                </span>
              </li>
              <li className="flex gap-2">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0">2</Badge>
                <span>העתק את <strong>Instance ID</strong> ואת ה-<strong>API Key</strong> מטאב ה-API Key, והדבק כאן</span>
              </li>
              <li className="flex gap-2">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0">3</Badge>
                <span>בטאב ה-Webhook של ה-Instance, הדבק את ה-Webhook URL ואת ה-Webhook Secret מטה</span>
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              פרטי חיבור
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instanceId">Instance ID</Label>
              <Input id="instanceId" placeholder="YwIn7GY3Ul3OAxXG" value={instanceId}
                onChange={(e) => setInstanceId(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input id="apiKey" type="password" placeholder="wgk_..." value={apiKey}
                onChange={(e) => setApiKey(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc">קידומת מדינת ברירת מחדל</Label>
              <Input id="cc" placeholder="972" value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.replace(/\D/g, "").slice(0, 3))} dir="ltr" />
              <p className="text-xs text-muted-foreground">משמש להמרת מספר טלפון ישראלי (05X) לפורמט בינלאומי</p>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !instanceId || !apiKey} className="w-full">
              {saveMutation.isPending ? "שומר..." : integration ? "עדכן הגדרות" : "שמור והפעל"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              הגדרת Webhook ב-Manus
            </CardTitle>
            <CardDescription>הדבק את שני הערכים האלה בדשבורד של Manus כדי לקבל הודעות נכנסות ו-ACKs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly dir="ltr" className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copy(webhookUrl, "Webhook URL")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Webhook Secret</Label>
              <div className="flex gap-2">
                <Input value={webhookSecret} readOnly dir="ltr" className="font-mono text-xs"
                  placeholder="ייווצר אוטומטית בשמירה הראשונה" />
                <Button variant="outline" size="icon" onClick={() => copy(webhookSecret, "Webhook Secret")}
                  disabled={!webhookSecret}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setWebhookSecret(genSecret())}>
                  צור חדש
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                סוד זה מאמת שה-webhook הגיע באמת מ-Manus. שמור את החיבור אחרי יצירה כדי לשמור את הסוד.
              </p>
            </div>

            <Separator />

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                בדשבורד של Manus, בטאב Webhook: הזן את ה-URL בשדה Webhook URL ואת ה-Secret בשדה Webhook Secret. סמן את האירועים <strong>message</strong> ו-<strong>message_ack</strong>.
              </AlertDescription>
            </Alert>

            <Alert className="border-amber-500/30 bg-amber-500/5">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="space-y-2">
                <div>
                  <strong>לא רואה הודעות נכנסות?</strong> ייתכן שהסוד פה שונה מזה שמוגדר ב-Manus.
                  לחץ "סנכרן סוד מ-Manus" — הסוד יילכד אוטומטית מה-webhook הבא שיגיע.
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resyncSecretMutation.mutate()}
                  disabled={resyncSecretMutation.isPending || !integration}
                >
                  <RefreshCw className={`h-4 w-4 ml-2 ${resyncSecretMutation.isPending ? "animate-spin" : ""}`} />
                  סנכרן סוד מ-Manus
                </Button>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

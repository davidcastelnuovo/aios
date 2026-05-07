import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Phone, Settings, Save, Loader2, ArrowRight, RefreshCw, Copy } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";

export default function MaskyooSettings() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["maskyoo-settings", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maskyoo_settings" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!tenantId,
  });

  const [baseUrl, setBaseUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [defaultUserPhone, setDefaultUserPhone] = useState("");
  const [click2callService, setClick2callService] = useState("onetouch");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (settings) {
      setBaseUrl(settings.base_url || "");
      setApiToken(settings.api_token || "");
      setDefaultUserPhone(settings.default_user_phone || "");
      setClick2callService(settings.click2call_service || "onetouch");
      setWebhookSecret(settings.webhook_secret || "");
      setIsActive(settings.is_active ?? true);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Missing tenant");
      const { error } = await supabase.from("maskyoo_settings" as any).upsert({
        tenant_id: tenantId,
        base_url: baseUrl.trim(),
        api_token: apiToken.trim(),
        default_user_phone: defaultUserPhone || null,
        click2call_service: click2callService || "onetouch",
        webhook_secret: webhookSecret || null,
        is_active: isActive,
      }, { onConflict: "tenant_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הגדרות Maskyoo נשמרו");
      queryClient.invalidateQueries({ queryKey: ["maskyoo-settings"] });
    },
    onError: (e: any) => toast.error("שגיאה בשמירה", { description: e.message }),
  });

  const syncCdrMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-maskyoo-cdr", {
        body: { tenant_id: tenantId, days: 7 },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => toast.success(`סונכרנו ${d?.total ?? 0} שיחות (חדשות: ${d?.inserted ?? 0})`),
    onError: (e: any) => toast.error("סנכרון נכשל", { description: e.message }),
  });

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/maskyoo-webhook?tenant_id=${tenantId}${webhookSecret ? `&secret=${webhookSecret}` : ""}`;

  if (isLoading) {
    return <div className="container mx-auto p-6 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Phone className="h-8 w-8 text-primary" />
            הגדרות Maskyoo (מסקיו)
          </h1>
          <p className="text-muted-foreground mt-2">חיבור למרכזיית Maskyoo - חיוג, היסטוריה והקלטות</p>
        </div>
        <Button variant="outline" onClick={() => navigate(buildPath("integrations"))}>
          <ArrowRight className="h-4 w-4 ml-2" /> חזרה לאינטגרציות
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> חיבור API</CardTitle>
            <CardDescription>פרטי הגישה שקיבלת מ-Maskyoo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input dir="ltr" placeholder="https://yourcompany.maskyoo.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>API Token (Bearer)</Label>
              <Input dir="ltr" type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>שירות Click2Call</Label>
              <Input dir="ltr" value={click2callService} onChange={(e) => setClick2callService(e.target.value)} placeholder="onetouch" />
            </div>
            <div className="flex items-center justify-between">
              <Label>פעיל</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">סטטוס:</span>
              <Badge variant={settings?.is_active ? "default" : "secondary"}>
                {settings?.is_active ? "✓ מחובר" : "לא מוגדר"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5" /> הגדרות שיחה</CardTitle>
            <CardDescription>ברירות מחדל לחיוג</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>מספר משתמש ברירת מחדל (אם לא מוגדר ב-Telephony Settings)</Label>
              <Input dir="ltr" value={defaultUserPhone} onChange={(e) => setDefaultUserPhone(e.target.value)} placeholder="05X-XXXXXXX" />
            </div>
            <div className="space-y-2">
              <Label>Webhook Secret (אופציונלי)</Label>
              <Input dir="ltr" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder="טקסט סודי לאימות webhook" />
            </div>
            <div className="space-y-2">
              <Label>Webhook URL (להגדיר ב-Maskyoo)</Label>
              <div className="flex gap-2">
                <Input dir="ltr" value={webhookUrl} readOnly className="text-xs" />
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("הועתק"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="lg">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
          שמור הגדרות
        </Button>
        <Button onClick={() => syncCdrMutation.mutate()} disabled={syncCdrMutation.isPending || !settings} variant="outline" size="lg">
          {syncCdrMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <RefreshCw className="h-4 w-4 ml-2" />}
          סנכרן היסטוריית שיחות (7 ימים)
        </Button>
      </div>

      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="p-4">
          <h4 className="font-semibold mb-2">📞 איך זה עובד?</h4>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
            <li>Click2Call: המערכת תחייג קודם למספר שלך, ואז תחבר ללקוח דרך Maskyoo</li>
            <li>היסטוריית שיחות: סנכרון מ-Maskyoo CDR ושיוך אוטומטי לפי טלפון</li>
            <li>Webhook: עדכוני סטטוס בזמן אמת. הגדר את ה-URL במערכת Maskyoo</li>
            <li>הקלטות: זמינות בכרטיסיית "היסטוריית שיחות" של ליד/לקוח</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

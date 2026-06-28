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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRight, Webhook, Key, CheckCircle2, AlertCircle, Copy, ExternalLink,
  RefreshCw, Plus, Pencil, Trash2, Share2,
} from "lucide-react";
import { ShareIntegrationTenantsDialog } from "@/components/forms/ShareIntegrationTenantsDialog";
import { IntegrationVisibilitySelector } from "@/components/forms/IntegrationVisibilitySelector";

const PROJECT_REF = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string) || "";

function genSecret() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Integration = {
  id: string;
  display_name: string | null;
  api_key: string | null;
  settings: any;
  is_active: boolean;
  created_at: string;
};

export default function ManusWhatsAppSettings() {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const { buildPath } = useTenantPath();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sharingIntegration, setSharingIntegration] = useState<Integration | null>(null);

  const webhookUrl = `https://${PROJECT_REF}.supabase.co/functions/v1/manus-wa-webhook`;

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["manus-wa-integrations", tenantId, userId],
    queryFn: async () => {
      if (!tenantId || !userId) return [] as Integration[];
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .eq("integration_type", "manus_wa")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Integration[];
    },
    enabled: !!tenantId && !!userId,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    displayName: "",
    instanceId: "",
    apiKey: "",
    countryCode: "972",
    webhookSecret: "",
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ displayName: "", instanceId: "", apiKey: "", countryCode: "972", webhookSecret: genSecret() });
    setDialogOpen(true);
  };

  const openEdit = (i: Integration) => {
    const s = i.settings || {};
    setEditingId(i.id);
    setForm({
      displayName: i.display_name || "",
      instanceId: s.instance_id || "",
      apiKey: i.api_key || "",
      countryCode: s.country_code || "972",
      webhookSecret: s.webhook_secret || "",
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !userId) throw new Error("משתמש לא מחובר");
      if (!form.displayName.trim()) throw new Error("נא לתת שם לחיבור");
      if (!form.instanceId || !form.apiKey) throw new Error("נא למלא Instance ID ו-API Key");
      const secret = form.webhookSecret || genSecret();
      const existing = editingId ? integrations.find((i) => i.id === editingId) : null;
      const existingSettings = (existing?.settings as any) || {};
      const payload: any = {
        tenant_id: tenantId,
        user_id: userId,
        integration_type: "manus_wa",
        api_key: form.apiKey,
        instance_id: form.instanceId,
        is_active: true,
        display_name: form.displayName.trim(),
        api_token_last_4: form.apiKey.slice(-4),
        settings: {
          ...existingSettings,
          instance_id: form.instanceId,
          webhook_secret: secret,
          country_code: form.countryCode || "972",
        },
      };
      if (editingId) {
        const { error } = await supabase.from("tenant_integrations").update(payload).eq("id", editingId);
        if (error) throw error;
        return editingId;
      } else {
        const { data, error } = await supabase.from("tenant_integrations").insert([payload]).select("id").single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: async (id) => {
      toast({ title: "נשמר בהצלחה", description: "פרטי החיבור עודכנו" });
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["manus-wa-integrations", tenantId, userId] });
      try {
        await supabase.functions.invoke("manus-wa-status", { body: { integrationId: id } });
        queryClient.invalidateQueries({ queryKey: ["manus-wa-integrations", tenantId, userId] });
      } catch { /* non-fatal */ }
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "שגיאה", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tenant_integrations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "החיבור נמחק" });
      queryClient.invalidateQueries({ queryKey: ["manus-wa-integrations", tenantId, userId] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "שגיאה", description: e.message }),
  });

  const statusMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("manus-wa-status", { body: { integrationId: id } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "שגיאה בבדיקת סטטוס");
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "סטטוס עודכן", description: `${data.status} · ${data.phoneNumber || ""}` });
      queryClient.invalidateQueries({ queryKey: ["manus-wa-integrations", tenantId, userId] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "שגיאה", description: e.message }),
  });

  const resyncSecretMutation = useMutation({
    mutationFn: async (i: Integration) => {
      const cur = (i.settings as any) || {};
      const merged = { ...cur, webhook_secret: "" };
      const { error } = await supabase.from("tenant_integrations").update({ settings: merged }).eq("id", i.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "ממתין לסנכרון", description: "שלח הודעת בדיקה ב-WhatsApp — הסוד יילכד אוטומטית מה-webhook הבא" });
      queryClient.invalidateQueries({ queryKey: ["manus-wa-integrations", tenantId, userId] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "שגיאה", description: e.message }),
  });

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "הועתק ללוח", description: label });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl" dir="rtl">
      <Button variant="ghost" onClick={() => navigate(buildPath("/chat-integrations"))} className="mb-6">
        <ArrowRight className="h-4 w-4 ml-2" />
        חזרה לאינטגרציות
      </Button>

      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
              <Webhook className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold">Manus WhatsApp Gateway</h1>
          </div>
          <p className="text-muted-foreground">
            ניהול חיבורים שלך ל-Manus. כל חיבור = Instance נפרד ב-Manus (לדוגמה: כרמן, וואטסאפ לקוחות וכו׳).
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 ml-2" />
          הוסף חיבור Manus
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            הוראות התקנה
          </CardTitle>
          <CardDescription>שלוש פעולות בדשבורד של Manus עבור כל Instance</CardDescription>
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
              <span>העתק את <strong>Instance ID</strong> ואת ה-<strong>API Key</strong> והדבק בטופס החיבור</span>
            </li>
            <li className="flex gap-2">
              <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0">3</Badge>
              <span>בטאב ה-Webhook של ה-Instance, הדבק את ה-Webhook URL ואת ה-Webhook Secret</span>
            </li>
          </ol>
          <Separator className="my-4" />
          <div className="space-y-2">
            <Label>Webhook URL (משותף לכל החיבורים)</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly dir="ltr" className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copy(webhookUrl, "Webhook URL")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">טוען...</p>
      ) : integrations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-muted-foreground">עדיין אין חיבורי Manus.</p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 ml-2" />
              חבר את ה-Instance הראשון
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {integrations.map((i) => {
            const s = i.settings || {};
            const status = s.status as string | undefined;
            const phone = s.phone_number as string | undefined;
            const isConnected = status === "CONNECTED";
            return (
              <Card key={i.id} className={isConnected ? "border-emerald-500/20" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className={`h-5 w-5 ${isConnected ? "text-emerald-500" : "text-muted-foreground"}`} />
                      <CardTitle className="text-xl">{i.display_name || "ללא שם"}</CardTitle>
                      {status && <Badge variant={isConnected ? "default" : "secondary"}>{status}</Badge>}
                      {phone && <Badge variant="outline" dir="ltr">{phone}</Badge>}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => statusMutation.mutate(i.id)} disabled={statusMutation.isPending}>
                        <RefreshCw className={`h-4 w-4 ml-2 ${statusMutation.isPending ? "animate-spin" : ""}`} />
                        בדוק סטטוס
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(i)}>
                        <Pencil className="h-4 w-4 ml-2" />
                        ערוך
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => resyncSecretMutation.mutate(i)} disabled={resyncSecretMutation.isPending}>
                        <RefreshCw className="h-4 w-4 ml-2" />
                        סנכרן סוד
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setSharingIntegration(i)}>
                        <Share2 className="h-4 w-4 ml-2" />
                        שתף עם ארגונים
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        if (confirm(`למחוק את החיבור "${i.display_name}"?`)) deleteMutation.mutate(i.id);
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Instance ID</Label>
                      <div className="font-mono text-xs" dir="ltr">{s.instance_id || "—"}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Webhook Secret</Label>
                      <div className="flex gap-2 items-center">
                        <code className="font-mono text-xs truncate flex-1" dir="ltr">{s.webhook_secret || "(אין)"}</code>
                        {s.webhook_secret && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(s.webhook_secret, "Webhook Secret")}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <IntegrationVisibilitySelector
                    integrationId={i.id}
                    integrationName={i.display_name || "Manus WA"}
                    ownerId={userId}
                    tenantId={tenantId!}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "ערוך חיבור Manus" : "הוסף חיבור Manus"}</DialogTitle>
            <DialogDescription>
              כל חיבור מייצג Instance נפרד ב-Manus. תן לחיבור שם מזהה (למשל "Carmen" או "וואטסאפ לקוחות").
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">שם החיבור</Label>
              <Input id="displayName" placeholder="לדוגמה: Carmen" value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instanceId">Instance ID</Label>
              <Input id="instanceId" placeholder="YwIn7GY3Ul3OAxXG" value={form.instanceId}
                onChange={(e) => setForm({ ...form, instanceId: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input id="apiKey" type="password" placeholder="wgk_..." value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc">קידומת מדינת ברירת מחדל</Label>
              <Input id="cc" placeholder="972" value={form.countryCode}
                onChange={(e) => setForm({ ...form, countryCode: e.target.value.replace(/\D/g, "").slice(0, 3) })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>Webhook Secret</Label>
              <div className="flex gap-2">
                <Input value={form.webhookSecret} readOnly dir="ltr" className="font-mono text-xs" />
                <Button variant="outline" size="icon" type="button" onClick={() => copy(form.webhookSecret, "Webhook Secret")}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" type="button" onClick={() => setForm({ ...form, webhookSecret: genSecret() })}>
                  צור חדש
                </Button>
              </div>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                בדשבורד של Manus → טאב Webhook של ה-Instance הזה: הזן את ה-URL וה-Secret מלמעלה. סמן <strong>message</strong> ו-<strong>message_ack</strong>.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Key className="h-4 w-4 ml-2" />
              {saveMutation.isPending ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {sharingIntegration && (
        <ShareIntegrationTenantsDialog
          open={!!sharingIntegration}
          onOpenChange={(open) => !open && setSharingIntegration(null)}
          integrationId={sharingIntegration.id}
          integrationName={sharingIntegration.display_name || "Manus WA"}
        />
      )}
    </div>
  );
}

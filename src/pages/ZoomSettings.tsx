import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Video, Copy, Save, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";

export default function ZoomSettings() {
  const { currentTenantId } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const queryClient = useQueryClient();

  const [accountId, setAccountId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [webhookSecretToken, setWebhookSecretToken] = useState("");

  const { data: integration } = useQuery({
    queryKey: ['zoom-integration', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'zoom')
        .maybeSingle();
      if (data) {
        const s = data.settings as Record<string, string> | null;
        if (s) {
          setAccountId(s.account_id || "");
          setClientId(s.client_id || "");
          setClientSecret(s.client_secret || "");
          setWebhookSecretToken(s.webhook_secret_token || "");
        }
      }
      return data;
    },
    enabled: !!currentTenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenantId) throw new Error("No tenant");
      const settings = {
        account_id: accountId,
        client_id: clientId,
        client_secret: clientSecret,
        webhook_secret_token: webhookSecretToken,
      };
      if (integration) {
        const { error } = await supabase
          .from('tenant_integrations')
          .update({ settings: settings as any, is_active: true })
          .eq('id', integration.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_integrations')
          .insert({ tenant_id: currentTenantId, integration_type: 'zoom', settings: settings as any, is_active: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zoom-integration'] });
      toast({ title: "נשמר בהצלחה", description: "הגדרות Zoom נשמרו" });
    },
    onError: (err: any) => {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    },
  });

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zoom-webhook?tenant_id=${currentTenantId}`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: "הועתק!", description: "ה-Webhook URL הועתק ללוח" });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(buildPath("integrations"))}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Video className="h-8 w-8" />
            הגדרות Zoom
          </h1>
          <p className="text-muted-foreground mt-1">הגדרות חיבור Zoom לקבלת הקלטות אוטומטית</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webhook URL</CardTitle>
          <CardDescription>העתק את הכתובת הזו והגדר אותה ב-Zoom App Marketplace כ-Event Notification Endpoint</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly dir="ltr" className="font-mono text-xs" />
            <Button variant="outline" onClick={copyWebhookUrl}>
              <Copy className="h-4 w-4 ml-2" />
              העתק
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            ב-Zoom Marketplace, הפעל את האירוע <code className="bg-muted px-1 rounded">recording.completed</code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Server-to-Server OAuth Credentials</CardTitle>
          <CardDescription>הזן את פרטי האפליקציה מ-Zoom App Marketplace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Account ID</Label>
              <Input dir="ltr" value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="Account ID" />
            </div>
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input dir="ltr" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client ID" />
            </div>
            <div className="space-y-2">
              <Label>Client Secret</Label>
              <Input dir="ltr" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Client Secret" />
            </div>
            <div className="space-y-2">
              <Label>Webhook Secret Token</Label>
              <Input dir="ltr" type="password" value={webhookSecretToken} onChange={(e) => setWebhookSecretToken(e.target.value)} placeholder="Webhook Secret Token" />
            </div>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 ml-2" />
            {saveMutation.isPending ? "שומר..." : "שמור הגדרות"}
          </Button>
          {integration?.is_active && (
            <Badge className="mr-2 bg-primary/90">✓ מחובר</Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

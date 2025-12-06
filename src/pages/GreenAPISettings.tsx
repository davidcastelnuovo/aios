import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Webhook, Key, CheckCircle2, AlertCircle, Copy, ExternalLink } from "lucide-react";

export default function GreenAPISettings() {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const { buildPath } = useTenantPath();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [instanceId, setInstanceId] = useState("");
  const [apiToken, setApiToken] = useState("");

  // Fetch existing integration for current user
  const { data: integration, isLoading } = useQuery({
    queryKey: ['green-api-integration', tenantId, userId],
    queryFn: async () => {
      if (!tenantId || !userId) return null;
      
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .eq('integration_type', 'green_api')
        .maybeSingle();

      if (error) throw error;

      if (data?.settings) {
        const settings = data.settings as any;
        setInstanceId(settings.instance_id || "");
      }

      return data;
    },
    enabled: !!tenantId && !!userId,
  });

  // Configure Green API webhooks
  const configureWebhooks = async (instId: string, token: string) => {
    console.log("🔧 Configuring Green API webhooks...");
    try {
      const { data, error } = await supabase.functions.invoke('configure-green-api', {
        body: { instanceId: instId, apiToken: token }
      });

      if (error) {
        console.error("❌ Error configuring webhooks:", error);
        throw error;
      }

      console.log("✅ Webhooks configured:", data);
      return data;
    } catch (err) {
      console.error("❌ Failed to configure webhooks:", err);
      // Don't throw - webhook config failure shouldn't block saving
      return null;
    }
  };

  // Save integration mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!instanceId || !apiToken) {
        throw new Error("נא למלא את כל השדות");
      }
      if (!userId) {
        throw new Error("משתמש לא מחובר");
      }

      const integrationData = {
        tenant_id: tenantId,
        user_id: userId,
        integration_type: 'green_api',
        api_key: apiToken,
        instance_id: instanceId,
        is_active: true,
        api_token_last_4: apiToken.slice(-4),
        settings: {
          instance_id: instanceId,
        },
      };

      if (integration) {
        const { error } = await supabase
          .from('tenant_integrations')
          .update(integrationData)
          .eq('id', integration.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_integrations')
          .insert([integrationData]);

        if (error) throw error;
      }

      // Configure webhooks automatically after saving
      await configureWebhooks(instanceId, apiToken);
    },
    onSuccess: () => {
      toast({
        title: "החיבור שלך נשמר בהצלחה",
        description: "הגדרות ה-Webhook הוגדרו אוטומטית - תקבל גם הודעות שאתה שולח מהוואטסאפ",
      });
      queryClient.invalidateQueries({ queryKey: ['green-api-integration', tenantId, userId] });
      queryClient.invalidateQueries({ queryKey: ['chat-integrations', tenantId] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "שגיאה בשמירת הגדרות",
        description: error.message,
      });
    },
  });

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/green-api-webhook`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "הועתק ללוח",
      description: "כתובת ה-Webhook הועתקה בהצלחה",
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl" dir="rtl">
      <Button
        variant="ghost"
        onClick={() => navigate(buildPath('/chat-integrations'))}
        className="mb-6"
      >
        <ArrowRight className="h-4 w-4 ml-2" />
        חזרה לאינטגרציות
      </Button>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-green-600">
            <Webhook className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold">הגדרות Green API</h1>
        </div>
        <p className="text-muted-foreground">
          חבר את המערכת ל-WhatsApp Business באמצעות Green API
        </p>
      </div>

      {integration?.is_active && (
        <Card className="mb-6 border-green-500/20 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">האינטגרציה פעילה ומוכנה לשימוש</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6">
        {/* Setup Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              הוראות התקנה
            </CardTitle>
            <CardDescription>
              לפני שמתחילים, יש צורך ב-Instance מ-Green API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-2">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0">
                  1
                </Badge>
                <span>
                  היכנס ל-{" "}
                  <a
                    href="https://green-api.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    green-api.com
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {" "}והתחבר לחשבון שלך
                </span>
              </li>
              <li className="flex gap-2">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0">
                  2
                </Badge>
                <span>צור Instance חדש או השתמש בקיים</span>
              </li>
              <li className="flex gap-2">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0">
                  3
                </Badge>
                <span>העתק את ה-Instance ID וה-API Token מהפאנל</span>
              </li>
              <li className="flex gap-2">
                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0">
                  4
                </Badge>
                <span>הדבק אותם בטופס למטה</span>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              פרטי חיבור
            </CardTitle>
            <CardDescription>
              הזן את פרטי ה-API שקיבלת מ-Green API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instanceId">Instance ID</Label>
              <Input
                id="instanceId"
                placeholder="7103123456"
                value={instanceId}
                onChange={(e) => setInstanceId(e.target.value)}
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                מספר ה-Instance שלך (מספר בן 10 ספרות)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiToken">API Token</Label>
              <Input
                id="apiToken"
                type="password"
                placeholder="abc123def456..."
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                ה-Token הסודי לגישה ל-API
              </p>
            </div>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !instanceId || !apiToken}
              className="w-full"
            >
              {saveMutation.isPending ? "שומר..." : integration ? "עדכן הגדרות" : "שמור ואפשר"}
            </Button>
          </CardContent>
        </Card>

        {/* Webhook Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              הגדרת Webhook
            </CardTitle>
            <CardDescription>
              הגדר את כתובת ה-Webhook ב-Green API כדי לקבל הודעות נכנסות
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  value={webhookUrl}
                  readOnly
                  dir="ltr"
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyWebhookUrl}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                העתק URL זה והדבק אותו בהגדרות ה-Webhook ב-Green API Console
              </p>
            </div>

            <Separator />

            <div className="text-sm space-y-2">
              <p className="font-semibold">הגדרה אוטומטית</p>
              <p className="text-muted-foreground">
                כשתשמור את פרטי החיבור, המערכת תגדיר אוטומטית את ה-Webhook כדי שתקבל גם הודעות נכנסות וגם הודעות שאתה שולח מהוואטסאפ.
              </p>
              <p className="font-semibold mt-4">הגדרה ידנית (במידת הצורך)</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground mr-4">
                <li>עבור ל-Instance Settings בקונסול</li>
                <li>מצא את הקטגוריה Webhook</li>
                <li>הדבק את ה-URL למעלה בשדה Webhook URL</li>
                <li>סמן את האירועים: <strong>incoming messages</strong> וגם <strong>outgoing messages</strong></li>
                <li>שמור שינויים</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

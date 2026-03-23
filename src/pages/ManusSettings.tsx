import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Brain, CheckCircle, AlertCircle, Webhook, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function ManusSettings() {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const { currentTenantId } = useTenant();
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);

  const { data: integration, isLoading } = useQuery({
    queryKey: ['manus-integration', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'manus')
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenantId,
  });

  const isConnected = integration?.is_active;
  const settings = (integration?.settings as any) || {};

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenantId || !apiKey.trim()) throw new Error("Missing data");

      if (integration) {
        const { error } = await supabase
          .from('tenant_integrations')
          .update({
            settings: { ...settings, api_key: apiKey.trim() },
            is_active: true,
          })
          .eq('id', integration.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_integrations')
          .insert({
            tenant_id: currentTenantId,
            integration_type: 'manus',
            settings: { api_key: apiKey.trim() },
            is_active: true,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manus-integration'] });
      toast.success("מפתח API של Manus נשמר בהצלחה");
      setApiKey("");
    },
    onError: (err: Error) => {
      toast.error(`שגיאה בשמירה: ${err.message}`);
    },
  });

  const testConnection = async () => {
    if (!currentTenantId) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manus-api', {
        body: { action: 'test_connection', tenantId: currentTenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("החיבור ל-Manus תקין!");
    } catch (err: any) {
      toast.error(`שגיאת חיבור: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const registerWebhook = async () => {
    if (!currentTenantId) return;
    try {
      const { data, error } = await supabase.functions.invoke('manus-api', {
        body: { action: 'register_webhook', tenantId: currentTenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ['manus-integration'] });
      toast.success("Webhook נרשם בהצלחה!");
    } catch (err: any) {
      toast.error(`שגיאה ברישום webhook: ${err.message}`);
    }
  };

  const disconnect = async () => {
    if (!integration) return;
    const { error } = await supabase
      .from('tenant_integrations')
      .update({ is_active: false })
      .eq('id', integration.id);
    if (error) {
      toast.error("שגיאה בניתוק");
    } else {
      queryClient.invalidateQueries({ queryKey: ['manus-integration'] });
      toast.success("Manus נותק בהצלחה");
    }
  };

  if (isLoading) {
    return <div className="container mx-auto p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(buildPath("integrations"))}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            Manus AI
          </h1>
          <p className="text-muted-foreground mt-1">
            סוכן AI מתקדם לביצוע משימות מורכבות — מחקר, יצירת מצגות, ניתוח נתונים ועוד
          </p>
        </div>
      </div>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            סטטוס חיבור
            <Badge variant={isConnected ? "default" : "secondary"} className={isConnected ? "bg-green-500" : ""}>
              {isConnected ? "מחובר" : "לא מחובר"}
            </Badge>
          </CardTitle>
        </CardHeader>
        {isConnected && (
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              מפתח API מוגדר
            </div>
            {settings.webhook_id ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Webhook רשום (ID: {settings.webhook_id})
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                Webhook לא רשום — לא תתקבלנה תוצאות אוטומטיות
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={testConnection} disabled={testing}>
                {testing && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                בדוק חיבור
              </Button>
              {!settings.webhook_id && (
                <Button variant="outline" size="sm" onClick={registerWebhook}>
                  <Webhook className="h-4 w-4 ml-2" />
                  רשום Webhook
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={disconnect}>
                נתק
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* API Key Setup */}
      <Card>
        <CardHeader>
          <CardTitle>{isConnected ? "עדכון מפתח API" : "חיבור Manus"}</CardTitle>
          <CardDescription>
            ניתן להשיג את מפתח ה-API מ-
            <a href="https://manus.im/app?show_settings=integrations&app_name=api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline mr-1">
              הגדרות Manus
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>מפתח API</Label>
            <Input
              type="password"
              placeholder="הכנס את מפתח ה-API של Manus"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={!apiKey.trim() || saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            {isConnected ? "עדכן מפתח" : "חבר את Manus"}
          </Button>
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle>מה Manus יכול לעשות?</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">• מחקר מעמיק ואיסוף מידע מהאינטרנט</li>
            <li className="flex items-center gap-2">• יצירת מצגות ומסמכים</li>
            <li className="flex items-center gap-2">• ניתוח נתונים ויצירת דוחות</li>
            <li className="flex items-center gap-2">• בניית אתרים ואפליקציות פשוטות</li>
            <li className="flex items-center gap-2">• עיצוב גרפי ויצירת תמונות</li>
            <li className="flex items-center gap-2">• אוטומציה של תהליכים מורכבים</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

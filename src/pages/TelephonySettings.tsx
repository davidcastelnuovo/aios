import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Phone, Settings, Save, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";

export default function TelephonySettings() {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["telephony-settings", tenantId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telephony_settings")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!userId,
  });

  const { data: paycallIntegration } = useQuery({
    queryKey: ["paycall-integration", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenant_integrations")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("integration_type", "paycall")
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  const [personalPhone, setPersonalPhone] = useState("");
  const [virtualNumber, setVirtualNumber] = useState("");
  const [autoRecord, setAutoRecord] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize form values when data loads
  if (settings && !isInitialized) {
    setPersonalPhone(settings.personal_phone || "");
    setVirtualNumber(settings.virtual_number || "");
    setAutoRecord(settings.auto_record ?? true);
    setIsInitialized(true);
  }

  if (paycallIntegration && !apiKey && (paycallIntegration as any).settings?.api_key) {
    setApiKey((paycallIntegration as any).settings.api_key);
  }

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !userId) throw new Error("Missing context");

      // Upsert telephony settings
      const { error: settingsError } = await supabase
        .from("telephony_settings")
        .upsert({
          tenant_id: tenantId,
          user_id: userId,
          personal_phone: personalPhone || null,
          virtual_number: virtualNumber || null,
          auto_record: autoRecord,
          provider: "paycall",
        }, { onConflict: "tenant_id,user_id" });

      if (settingsError) throw settingsError;

      // Save API key in tenant_integrations if provided
      if (apiKey.trim()) {
        const { error: integrationError } = await supabase
          .from("tenant_integrations")
          .upsert({
            tenant_id: tenantId,
            integration_type: "paycall",
            is_active: true,
            settings: { api_key: apiKey },
          }, { onConflict: "tenant_id,integration_type" });

        if (integrationError) throw integrationError;
      }
    },
    onSuccess: () => {
      toast.success("הגדרות טלפוניה נשמרו בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["telephony-settings"] });
      queryClient.invalidateQueries({ queryKey: ["paycall-integration"] });
    },
    onError: (err: any) => {
      toast.error("שגיאה בשמירת הגדרות", { description: err.message });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Phone className="h-8 w-8 text-primary" />
            הגדרות מרכזיה (Paycall)
          </h1>
          <p className="text-muted-foreground mt-2">
            הגדר את פרטי הטלפוניה שלך לביצוע וקבלת שיחות דרך המערכת
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(buildPath("integrations"))}>
          <ArrowRight className="h-4 w-4 ml-2" />
          חזרה לאינטגרציות
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              חיבור ל-Paycall
            </CardTitle>
            <CardDescription>
              הזן את מפתח ה-API שקיבלת מ-Paycall
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="הזן מפתח API..."
                dir="ltr"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">סטטוס:</span>
              <Badge variant={paycallIntegration ? "default" : "secondary"}>
                {paycallIntegration ? "✓ מחובר" : "לא מוגדר"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Phone Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              הגדרות טלפון
            </CardTitle>
            <CardDescription>
              המספרים שישמשו לשיחות יוצאות
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>מספר אישי (המספר שמחייגים אליך קודם)</Label>
              <Input
                value={personalPhone}
                onChange={(e) => setPersonalPhone(e.target.value)}
                placeholder="05X-XXXXXXX"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>מספר וירטואלי (מה הלקוח רואה)</Label>
              <Input
                value={virtualNumber}
                onChange={(e) => setVirtualNumber(e.target.value)}
                placeholder="0X-XXXXXXX"
                dir="ltr"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>הקלטה אוטומטית</Label>
              <Switch checked={autoRecord} onCheckedChange={setAutoRecord} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-start">
        <Button
          onClick={() => saveSettingsMutation.mutate()}
          disabled={saveSettingsMutation.isPending}
          size="lg"
        >
          {saveSettingsMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin ml-2" />
          ) : (
            <Save className="h-4 w-4 ml-2" />
          )}
          שמור הגדרות
        </Button>
      </div>

      {/* Info card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="p-4">
          <h4 className="font-semibold mb-2">📞 איך זה עובד?</h4>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
            <li>לחיצה על אייקון הטלפון בכרטיסיית ליד/לקוח תפתח דיאלוג שיחה</li>
            <li>המערכת מתקשרת קודם אליך (למספר האישי) ואז מחברת ללקוח</li>
            <li>הלקוח רואה את המספר הוירטואלי כמספר מתקשר</li>
            <li>שיחות מוקלטות אוטומטית (אם מופעל) ונשמרות בהיסטוריה</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

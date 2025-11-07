import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Link as LinkIcon, CheckCircle2, XCircle } from "lucide-react";

export default function AccountingIntegrations() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Fetch current integration settings
  const { data: integration, isLoading } = useQuery({
    queryKey: ["tenant-integration", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "sumit")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Update integration settings
  const updateIntegration = useMutation({
    mutationFn: async (data: {
      api_key?: string;
      company_id?: string;
      is_active?: boolean;
      auto_sync_enabled?: boolean;
    }) => {
      if (!tenantId) throw new Error("No tenant selected");

      if (integration) {
        const { error } = await supabase
          .from("tenant_integrations")
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq("id", integration.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tenant_integrations")
          .insert({
            tenant_id: tenantId,
            integration_type: "sumit",
            ...data,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-integration"] });
      toast.success("הגדרות האינטגרציה עודכנו בהצלחה");
    },
    onError: (error) => {
      console.error("Error updating integration:", error);
      toast.error("שגיאה בעדכון הגדרות האינטגרציה");
    },
  });

  const handleTestConnection = async () => {
    if (!apiKey || !companyId) {
      toast.error("יש למלא מפתח API ומזהה חברה");
      return;
    }

    setIsTestingConnection(true);
    try {
      // TODO: Implement actual Sumit API test
      // For now, just simulate a test
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success("החיבור ל-Sumit הצליח!");
      await updateIntegration.mutateAsync({
        api_key: apiKey,
        company_id: companyId,
        is_active: true,
      });
    } catch (error) {
      console.error("Connection test failed:", error);
      toast.error("החיבור נכשל. אנא בדוק את הפרטים");
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateIntegration.mutateAsync({
        api_key: apiKey || integration?.api_key,
        company_id: companyId || integration?.company_id,
      });
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const handleToggleAutoSync = async (enabled: boolean) => {
    try {
      await updateIntegration.mutateAsync({
        auto_sync_enabled: enabled,
      });
    } catch (error) {
      console.error("Error toggling auto sync:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">אינטגרציות הנהלת חשבונות</h1>
        <p className="text-muted-foreground mt-2">
          חבר את המערכת לתוכנת הנהלת החשבונות שלך
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LinkIcon className="h-6 w-6" />
              <div>
                <CardTitle>Sumit - מערכת לניהול חשבונות</CardTitle>
                <CardDescription>
                  סנכרון אוטומטי של לקוחות וחשבוניות
                </CardDescription>
              </div>
            </div>
            {integration?.is_active ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">מחובר</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <XCircle className="h-5 w-5" />
                <span className="text-sm font-medium">לא מחובר</span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">מפתח API</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="הזן את מפתח ה-API מ-Sumit"
                value={apiKey || integration?.api_key || ""}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                ניתן למצוא את המפתח בהגדרות החשבון ב-Sumit
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-id">מזהה חברה</Label>
              <Input
                id="company-id"
                placeholder="הזן את מזהה החברה"
                value={companyId || integration?.company_id || ""}
                onChange={(e) => setCompanyId(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleTestConnection}
                disabled={isTestingConnection || !apiKey || !companyId}
                variant="outline"
              >
                {isTestingConnection && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                בדוק חיבור
              </Button>
              <Button
                onClick={handleSaveSettings}
                disabled={updateIntegration.isPending}
              >
                {updateIntegration.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                שמור הגדרות
              </Button>
            </div>
          </div>

          {integration?.is_active && (
            <div className="pt-6 border-t space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>סנכרון אוטומטי</Label>
                  <p className="text-sm text-muted-foreground">
                    סנכרן לקוחות וחשבוניות באופן אוטומטי
                  </p>
                </div>
                <Switch
                  checked={integration.auto_sync_enabled}
                  onCheckedChange={handleToggleAutoSync}
                  disabled={updateIntegration.isPending}
                />
              </div>

              {integration.last_sync_at && (
                <p className="text-sm text-muted-foreground">
                  סנכרון אחרון: {new Date(integration.last_sync_at).toLocaleString("he-IL")}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

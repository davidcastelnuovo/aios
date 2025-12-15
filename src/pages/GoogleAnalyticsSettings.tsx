import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { ArrowLeft, BarChart3, RefreshCw, Loader2, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";

export default function GoogleAnalyticsSettings() {
  const { currentTenantId } = useTenant();
  const { userId } = useCurrentUser();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Get integration status
  const { data: integration, isLoading } = useQuery({
    queryKey: ['google-analytics-integration', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'google_analytics')
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenantId,
  });

  // Connect to Google Analytics
  const handleConnect = async () => {
    if (!currentTenantId || !userId) {
      toast.error("נא להתחבר למערכת");
      return;
    }

    setIsConnecting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("No session found");
      }

      const response = await supabase.functions.invoke('google-analytics-auth?action=authorize', {
        body: { tenantId: currentTenantId, userId },
        headers: { Authorization: `Bearer ${session.session.access_token}` },
        method: 'POST',
      });

      if (response.error) throw response.error;
      if (response.data?.authUrl) {
        window.location.href = response.data.authUrl;
      }
    } catch (error: any) {
      console.error('Error connecting to Google Analytics:', error);
      toast.error("שגיאה בהתחברות ל-Google Analytics");
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect integration
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!integration?.id) throw new Error("No integration to disconnect");
      
      const { error } = await supabase
        .from('tenant_integrations')
        .update({ is_active: false })
        .eq('id', integration.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-analytics-integration'] });
      toast.success("החיבור ל-Google Analytics נותק");
    },
    onError: (error) => {
      console.error('Error disconnecting:', error);
      toast.error("שגיאה בניתוק החיבור");
    },
  });

  const settings = integration?.settings as any;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(buildPath('integrations'))}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-orange-500" />
            Google Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            חיבור לנתוני תנועה ומעקב אתר
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>סטטוס חיבור</CardTitle>
              <CardDescription>
                חבר את חשבון Google Analytics שלך לסנכרון נתונים
              </CardDescription>
            </div>
            <Badge variant={integration ? "default" : "secondary"} className={integration ? "bg-green-500" : ""}>
              {integration ? "מחובר" : "לא מחובר"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : integration ? (
            <div className="space-y-4">
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Google Analytics מחובר בהצלחה
                  {settings?.connected_at && (
                    <span className="block text-sm mt-1">
                      חובר בתאריך: {new Date(settings.connected_at).toLocaleDateString('he-IL')}
                    </span>
                  )}
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleConnect}
                  disabled={isConnecting}
                >
                  <RefreshCw className={`h-4 w-4 ml-2 ${isConnecting ? 'animate-spin' : ''}`} />
                  חיבור מחדש
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  נתק חיבור
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  חבר את חשבון Google Analytics שלך כדי לסנכרן נתוני תנועה וביצועים לטבלאות דינמיות
                </AlertDescription>
              </Alert>

              <Button 
                onClick={handleConnect} 
                disabled={isConnecting}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 ml-2" />
                )}
                התחבר עם Google
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>שימוש בנתונים</CardTitle>
          <CardDescription>
            איך להשתמש בנתוני Google Analytics במערכת
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-medium">1</div>
            <div>
              <p className="font-medium">צור טבלה דינמית חדשה</p>
              <p className="text-sm text-muted-foreground">עבור לדף "טבלאות דינמיות" ובחר "Google Analytics"</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-medium">2</div>
            <div>
              <p className="font-medium">בחר Property</p>
              <p className="text-sm text-muted-foreground">בחר את ה-Property (GA4) שממנו תרצה למשוך נתונים</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-medium">3</div>
            <div>
              <p className="font-medium">סנכרן נתונים</p>
              <p className="text-sm text-muted-foreground">לחץ על "סנכרון" כדי למשוך נתונים עדכניים מהחשבון</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>נתונים זמינים</CardTitle>
          <CardDescription>הנתונים שיסונכרנו מ-Google Analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Sessions", desc: "מספר הביקורים" },
              { label: "Users", desc: "מבקרים ייחודיים" },
              { label: "New Users", desc: "מבקרים חדשים" },
              { label: "Pageviews", desc: "צפיות בדפים" },
              { label: "Bounce Rate", desc: "אחוז נטישה" },
              { label: "Avg Duration", desc: "זמן ממוצע באתר" },
              { label: "Pages/Session", desc: "דפים לביקור" },
            ].map((item) => (
              <div key={item.label} className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

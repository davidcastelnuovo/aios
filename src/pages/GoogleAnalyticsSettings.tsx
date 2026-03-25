import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { ArrowLeft, BarChart3, RefreshCw, Loader2, ExternalLink, CheckCircle2, AlertCircle, Zap, Copy, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";

export default function GoogleAnalyticsSettings() {
  const { currentTenantId } = useTenant();
  const { userId } = useCurrentUser();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState("make");
  const [webhookCopied, setWebhookCopied] = useState(false);

  // Webhook URL for Make.com
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-google-analytics-sync`;

  // Get ALL direct API integrations (multiple accounts)
  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['google-analytics-integrations', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'google_analytics')
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  const hasAnyDirectConnection = integrations.length > 0;

  // Get Make.com integration status
  const { data: makeIntegration, isLoading: makeLoading } = useQuery({
    queryKey: ['make-integration', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'make_api')
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenantId,
  });

  const makeSettings = makeIntegration?.settings as Record<string, unknown> | null;
  const hasMakeConnection = !!makeIntegration?.is_active && !!makeSettings?.api_token;
  const hasGaTemplate = !!(makeSettings?.google_analytics_template_scenario_id);

  // Connect to Google Analytics (direct API)
  const handleConnect = async (addNew = false) => {
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
        body: { tenantId: currentTenantId, userId, addNew },
        headers: { Authorization: `Bearer ${session.session.access_token}` },
        method: 'POST',
      });

      if (response.error) throw response.error;
      if (response.data?.authUrl) {
        window.location.href = response.data.authUrl;
      }
    } catch (error: unknown) {
      console.error('Error connecting to Google Analytics:', error);
      toast.error("שגיאה בהתחברות ל-Google Analytics");
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect direct API integration
  const disconnectMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      if (!integrationId) throw new Error("No integration to disconnect");
      
      const { error } = await supabase
        .from('tenant_integrations')
        .update({ is_active: false })
        .eq('id', integrationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-analytics-integrations'] });
      toast.success("החיבור ל-Google Analytics נותק");
    },
    onError: (error) => {
      console.error('Error disconnecting:', error);
      toast.error("שגיאה בניתוק החיבור");
    },
  });

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    toast.success("URL הועתק ללוח");
    setTimeout(() => setWebhookCopied(false), 2000);
  };


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

      {/* Connection Method Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="make" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Make.com
            <Badge variant="secondary" className="text-xs">מומלץ</Badge>
          </TabsTrigger>
          <TabsTrigger value="direct" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            API ישיר
          </TabsTrigger>
        </TabsList>

        {/* Make.com Tab */}
        <TabsContent value="make" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-purple-500" />
                    חיבור דרך Make.com
                  </CardTitle>
                  <CardDescription>
                    פשוט יותר - Make.com מטפל ב-OAuth עבורך
                  </CardDescription>
                </div>
                <Badge variant={hasMakeConnection ? "default" : "secondary"} className={hasMakeConnection ? "bg-green-500" : ""}>
                  {hasMakeConnection ? "Make.com מחובר" : "לא מחובר"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {makeLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !hasMakeConnection ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    נא לחבר קודם את Make.com בהגדרות האינטגרציות
                    <Button variant="link" className="p-0 h-auto mr-2" onClick={() => navigate(buildPath('make-settings'))}>
                      עבור להגדרות Make.com
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-6">
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Make.com מחובר! עכשיו צור Scenario לסנכרון נתוני Google Analytics
                    </AlertDescription>
                  </Alert>

                  {/* Webhook URL */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Webhook URL לשליחת נתונים</label>
                    <div className="flex gap-2">
                      <code className="flex-1 p-3 bg-muted rounded-md text-xs overflow-x-auto font-mono">
                        {webhookUrl}
                      </code>
                      <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
                        {webhookCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Template Status */}
                  {hasGaTemplate ? (
                    <Alert className="bg-purple-50 border-purple-200">
                      <CheckCircle2 className="h-4 w-4 text-purple-600" />
                      <AlertDescription className="text-purple-800">
                        Template Scenario מוגדר! המערכת תשכפל אותו אוטומטית לכל טבלת GA חדשה.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        הגדר Template Scenario בהגדרות Make.com לשכפול אוטומטי
                        <Button variant="link" className="p-0 h-auto mr-2" onClick={() => navigate(buildPath('make-settings'))}>
                          הגדר Template
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Make.com Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>איך ליצור Scenario ב-Make.com</CardTitle>
              <CardDescription>
                הוראות מפורטות ליצירת אוטומציה לסנכרון נתונים
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium shrink-0">1</div>
                <div>
                  <p className="font-medium">צור Scenario חדש ב-Make.com</p>
                  <p className="text-sm text-muted-foreground">לך ל-Scenarios ולחץ על "Create a new scenario"</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium shrink-0">2</div>
                <div>
                  <p className="font-medium">הוסף מודול Google Analytics</p>
                  <p className="text-sm text-muted-foreground">בחר "Google Analytics Data API" → "Run Report". התחבר לחשבון Google שלך (פעם אחת בלבד)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium shrink-0">3</div>
                <div>
                  <p className="font-medium">הגדר את הדוח</p>
                  <p className="text-sm text-muted-foreground">
                    בחר Property, הוסף Dimensions: date, sessionSource, sessionMedium.
                    הוסף Metrics: sessions, totalUsers, newUsers, screenPageViews, bounceRate, averageSessionDuration
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium shrink-0">4</div>
                <div>
                  <p className="font-medium">הוסף מודול HTTP</p>
                  <p className="text-sm text-muted-foreground">
                    בחר "HTTP" → "Make a request".<br />
                    Method: POST<br />
                    URL: הדבק את ה-Webhook URL מלמעלה<br />
                    Body type: JSON
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium shrink-0">5</div>
                <div>
                  <p className="font-medium">הגדר את ה-JSON Body</p>
                  <div className="mt-2 p-3 bg-muted rounded-md">
                    <pre className="text-xs overflow-x-auto">
{`{
  "table_id": "{{TABLE_ID}}",
  "records": [
    {{#each rows}}
    {
      "date": "{{date}}",
      "source_medium": "{{sessionSource}}/{{sessionMedium}}",
      "sessions": {{sessions}},
      "users": {{totalUsers}},
      "new_users": {{newUsers}},
      "pageviews": {{screenPageViews}},
      "bounce_rate": {{bounceRate}},
      "avg_session_duration": {{averageSessionDuration}}
    }{{#unless @last}},{{/unless}}
    {{/each}}
  ]
}`}
                    </pre>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    החלף את TABLE_ID במזהה הטבלה שלך (תקבל אותו כשתיצור טבלה דינמית)
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium shrink-0">6</div>
                <div>
                  <p className="font-medium">הפעל את ה-Scenario</p>
                  <p className="text-sm text-muted-foreground">שמור ולחץ "Run once" לבדיקה, או הגדר תזמון (יומי/שבועי)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Direct API Tab */}
        <TabsContent value="direct" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>חיבור ישיר ל-API</CardTitle>
                  <CardDescription>
                    חיבור דרך OAuth - דורש הגדרה ב-Google Cloud Console
                  </CardDescription>
                </div>
                <Badge variant={integration ? "default" : "secondary"} className={integration ? "bg-green-500" : ""}>
                  {hasAnyDirectConnection ? `${integrations.length} חשבונות מחוברים` : "לא מחובר"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : hasAnyDirectConnection ? (
                <div className="space-y-4">
                  {/* List connected accounts */}
                  {integrations.map((integ) => {
                    const s = integ.settings as Record<string, unknown> | null;
                    const email = (s?.google_email as string) || 'חשבון לא ידוע';
                    return (
                      <div key={integ.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                          <div>
                            <p className="font-medium text-sm">{email}</p>
                            {s?.connected_at && (
                              <p className="text-xs text-muted-foreground">
                                חובר: {new Date(s.connected_at as string).toLocaleDateString('he-IL')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => disconnectMutation.mutate(integ.id)}
                            disabled={disconnectMutation.isPending}
                          >
                            נתק
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add another account */}
                  <Button 
                    variant="outline" 
                    onClick={() => handleConnect(true)}
                    disabled={isConnecting}
                    className="w-full border-dashed"
                  >
                    {isConnecting ? (
                      <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 ml-2" />
                    )}
                    + חבר חשבון Google נוסף
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      חיבור ישיר דורש הגדרה ב-Google Cloud Console. אם אתה נתקל בבעיות OAuth, מומלץ לנסות את אפשרות Make.com.
                    </AlertDescription>
                  </Alert>

                  <Button 
                    onClick={() => handleConnect(false)} 
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
              <CardTitle>הגדרות נדרשות ב-Google Cloud Console</CardTitle>
              <CardDescription>
                וודא שהגדרות אלו מוגדרות כראוי
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-medium">1</div>
                <div>
                  <p className="font-medium">הפעל את ה-APIs</p>
                  <p className="text-sm text-muted-foreground">
                    <a href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      Google Analytics Data API <ExternalLink className="h-3 w-3 inline" />
                    </a>
                    {" ו-"}
                    <a href="https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      Google Analytics Admin API <ExternalLink className="h-3 w-3 inline" />
                    </a>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-medium">2</div>
                <div>
                  <p className="font-medium">הוסף Scopes</p>
                  <p className="text-sm text-muted-foreground">
                    ב-OAuth consent screen → Scopes, הוסף:
                    <code className="block mt-1 text-xs bg-muted p-1 rounded">https://www.googleapis.com/auth/analytics.readonly</code>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-medium">3</div>
                <div>
                  <p className="font-medium">הגדר Redirect URI</p>
                  <p className="text-sm text-muted-foreground">
                    ב-OAuth 2.0 Client ID, הוסף:
                    <code className="block mt-1 text-xs bg-muted p-1 rounded overflow-x-auto">
                      {import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-analytics-auth?action=oauth_callback
                    </code>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Available Data Card */}
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
              { label: "Source/Medium", desc: "מקורות תנועה" },
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

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Unlink, RefreshCw, CheckCircle2, AlertCircle, ArrowLeft, Loader2, Copy, ExternalLink, Webhook, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";

// Google Ads icon component
const GoogleAdsIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.316 3.051a1.5 1.5 0 0 1 2.183 0l7.495 8.099a1.5 1.5 0 0 1-.168 2.169l-7.495 6.084a1.5 1.5 0 0 1-2.183-.168l-7.495-8.099a1.5 1.5 0 0 1 .168-2.169l7.495-5.916z" fill="#4285F4"/>
    <circle cx="17.5" cy="18.5" r="2.5" fill="#34A853"/>
    <path d="M3.5 14.5l5 5.5L4 21.5l-1.5-5z" fill="#FBBC04"/>
    <path d="M7 3l6 6.5L10 12 4 6z" fill="#EA4335"/>
  </svg>
);

// Make.com icon
const MakeIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" fill="#6D29D9"/>
    <path d="M8 12l3 3 5-6" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function GoogleAdsSettings() {
  const { tenant: currentTenant } = useCurrentTenant();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const [activeTab, setActiveTab] = useState("api");

  // Fetch Google Ads integration
  const { data: googleAdsIntegration, isLoading: loadingIntegration } = useQuery({
    queryKey: ['google-ads-integration', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('integration_type', 'google_ads')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch Make integration settings
  const { data: makeIntegration } = useQuery({
    queryKey: ['google-ads-make-integration', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('integration_type', 'google_ads_make')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  // Generate or get webhook secret
  const makeSettings = makeIntegration?.settings as { webhook_secret?: string } | null;
  const webhookSecret = makeSettings?.webhook_secret || 
    `make_${currentTenant?.id?.substring(0, 8)}_${Date.now().toString(36)}`;
  
  const webhookUrl = `https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/webhook-google-ads-sync`;

  // Save Make integration settings
  const saveMakeSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id || !user?.id) throw new Error('Missing tenant or user');
      
      const settings = {
        webhook_secret: webhookSecret,
        configured_at: new Date().toISOString(),
      };

      if (makeIntegration?.id) {
        const { error } = await supabase
          .from('tenant_integrations')
          .update({ 
            settings, 
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', makeIntegration.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_integrations')
          .insert({
            tenant_id: currentTenant.id,
            integration_type: 'google_ads_make',
            is_active: true,
            settings,
            created_by: user.id
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('הגדרות Make נשמרו בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['google-ads-make-integration'] });
    },
    onError: (error) => {
      toast.error('שגיאה בשמירת הגדרות: ' + (error as Error).message);
    },
  });

  // Connect to Google Ads mutation (direct API)
  const connectMutation = useMutation({
    mutationFn: async () => {
      const redirectUri = `${window.location.origin}/t/${currentTenant?.slug}/integrations`;
      
      const { data, error } = await supabase.functions.invoke('google-ads-auth?action=get_auth_url', {
        body: {
          tenant_id: currentTenant?.id,
          user_id: user?.id,
          redirect_uri: redirectUri,
        },
      });

      if (error) throw error;
      
      if (data?.auth_url) {
        window.location.href = data.auth_url;
      } else {
        throw new Error('No auth URL received');
      }
      
      return data;
    },
    onError: (error) => {
      toast.error('שגיאה בהתחברות ל-Google Ads: ' + (error as Error).message);
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!googleAdsIntegration?.id) throw new Error('No integration found');
      const { error } = await supabase
        .from('tenant_integrations')
        .update({ is_active: false, api_key: null })
        .eq('id', googleAdsIntegration.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('החיבור ל-Google Ads נותק בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['google-ads-integration'] });
    },
    onError: (error) => {
      toast.error('שגיאה בניתוק: ' + (error as Error).message);
    },
  });

  // Check status mutation
  const checkStatusMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('google-ads-auth?action=check_status', {
        body: {
          tenant_id: currentTenant?.id,
          user_id: user?.id,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.connected) {
        toast.success('החיבור ל-Google Ads פעיל');
      } else {
        toast.warning('החיבור ל-Google Ads לא פעיל: ' + (data?.message || ''));
      }
      queryClient.invalidateQueries({ queryKey: ['google-ads-integration'] });
    },
    onError: (error) => {
      toast.error('שגיאה בבדיקת סטטוס: ' + (error as Error).message);
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} הועתק ללוח`);
  };

  const isConnected = googleAdsIntegration?.is_active && googleAdsIntegration?.api_key;
  const isMakeConfigured = makeIntegration?.is_active;
  const settings = googleAdsIntegration?.settings as any;

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(buildPath('/integrations'))}>
          <ArrowLeft className="h-5 w-5 rotate-180" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <GoogleAdsIcon className="h-8 w-8" />
            הגדרות Google Ads
          </h1>
          <p className="text-muted-foreground mt-1">
            חבר את חשבון Google Ads שלך לסנכרון נתוני קמפיינים
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="api" className="gap-2">
            <GoogleAdsIcon className="h-4 w-4" />
            חיבור ישיר (API)
          </TabsTrigger>
          <TabsTrigger value="make" className="gap-2">
            <MakeIcon className="h-4 w-4" />
            חיבור דרך Make
          </TabsTrigger>
        </TabsList>

        {/* Direct API Connection Tab */}
        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-row-reverse">
                {isConnected ? (
                  <Badge variant="default" className="bg-green-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    מחובר
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    לא מחובר
                  </Badge>
                )}
                <span className="text-right">Google Ads API</span>
              </CardTitle>
              <CardDescription className="text-right">
                חיבור ישיר ל-API של Google Ads (דורש Developer Token מאושר)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isConnected ? (
                <div className="space-y-4">
                  <Alert className="text-right">
                    <AlertTitle className="flex items-center gap-2 flex-row-reverse justify-end">
                      <GoogleAdsIcon className="h-4 w-4" />
                      התחבר ל-Google Ads
                    </AlertTitle>
                    <AlertDescription className="text-right">
                      <p>לחץ על הכפתור למטה כדי לאשר גישה לחשבונות Google Ads שלך.</p>
                      <p className="text-amber-600 mt-2">
                        <strong>שים לב:</strong> חיבור זה דורש Developer Token מאושר על ידי Google.
                        אם עדיין לא קיבלת אישור, השתמש באפשרות "חיבור דרך Make".
                      </p>
                    </AlertDescription>
                  </Alert>
                  <Button
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending}
                    className="bg-[#4285F4] hover:bg-[#3367D6] gap-2"
                  >
                    <GoogleAdsIcon className="h-4 w-4" />
                    {connectMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        מתחבר...
                      </>
                    ) : (
                      'התחבר עם Google'
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert className="border-green-200 bg-green-50 text-right">
                    <AlertTitle className="text-green-800 flex items-center gap-2 flex-row-reverse justify-end">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      מחובר בהצלחה
                    </AlertTitle>
                    <AlertDescription className="text-green-700 text-right">
                      {settings?.customer_name && (
                        <span>חשבון: {settings.customer_name}</span>
                      )}
                      {settings?.customer_id && (
                        <span className="block text-xs opacity-70">ID: {settings.customer_id}</span>
                      )}
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      onClick={() => checkStatusMutation.mutate()}
                      disabled={checkStatusMutation.isPending}
                      className="gap-2"
                    >
                      {checkStatusMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      בדוק חיבור
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => disconnectMutation.mutate()}
                      disabled={disconnectMutation.isPending}
                      className="gap-2"
                    >
                      {disconnectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Unlink className="h-4 w-4" />
                      )}
                      נתק חיבור
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Make.com Connection Tab */}
        <TabsContent value="make" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-row-reverse">
                {isMakeConfigured ? (
                  <Badge variant="default" className="bg-purple-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    מוגדר
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Settings className="h-3 w-3" />
                    טרם הוגדר
                  </Badge>
                )}
                <span className="text-right flex items-center gap-2">
                  <MakeIcon className="h-5 w-5" />
                  חיבור דרך Make.com
                </span>
              </CardTitle>
              <CardDescription className="text-right">
                השתמש ב-Make.com כדי לסנכרן נתונים מ-Google Ads ללא צורך ב-Developer Token
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="border-purple-200 bg-purple-50 text-right">
                <AlertTitle className="text-purple-800 flex items-center gap-2 flex-row-reverse justify-end">
                  <MakeIcon className="h-4 w-4" />
                  למה Make?
                </AlertTitle>
                <AlertDescription className="text-purple-700 text-right">
                  Make.com כבר מאושר כ-Google Partner עם Developer Token פעיל. 
                  בעזרת Make תוכל לסנכרן נתוני Google Ads ללא צורך באישור ישיר מ-Google.
                </AlertDescription>
              </Alert>

              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="font-semibold text-right">פרטי Webhook</h3>
                
                <div className="space-y-2">
                  <Label className="text-right block">Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={webhookUrl} 
                      readOnly 
                      className="font-mono text-sm"
                      dir="ltr"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-right block">Webhook Secret</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={webhookSecret} 
                      readOnly 
                      className="font-mono text-sm"
                      dir="ltr"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => copyToClipboard(webhookSecret, 'Webhook Secret')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    הוסף את ה-Secret בתור Header עם שם "x-webhook-secret"
                  </p>
                </div>

                <Button 
                  onClick={() => saveMakeSettingsMutation.mutate()}
                  disabled={saveMakeSettingsMutation.isPending}
                  className="gap-2"
                >
                  {saveMakeSettingsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  שמור הגדרות
                </Button>
              </div>

              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="font-semibold text-right">הוראות הגדרה ב-Make</h3>
                
                <ol className="list-decimal list-inside space-y-3 text-right text-sm">
                  <li>
                    <strong>צור Scenario חדש ב-Make</strong>
                    <Button 
                      variant="link" 
                      className="p-0 h-auto mr-2"
                      onClick={() => window.open('https://www.make.com/en/register', '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 ml-1" />
                      הרשמה ל-Make
                    </Button>
                  </li>
                  
                  <li>
                    <strong>הוסף Trigger מסוג Schedule</strong>
                    <p className="text-muted-foreground mr-4">
                      הגדר את התדירות: כל שעה, יום או שבוע
                    </p>
                  </li>
                  
                  <li>
                    <strong>הוסף מודול Google Ads - Get Campaign Performance</strong>
                    <ul className="list-disc list-inside mr-4 text-muted-foreground">
                      <li>התחבר לחשבון Google Ads שלך</li>
                      <li>בחר את החשבון/קמפיינים הרלוונטיים</li>
                      <li>הגדר טווח תאריכים (למשל: 30 ימים אחרונים)</li>
                    </ul>
                  </li>
                  
                  <li>
                    <strong>הוסף Iterator</strong>
                    <p className="text-muted-foreground mr-4">
                      כדי לעבור על כל הקמפיינים שהתקבלו
                    </p>
                  </li>
                  
                  <li>
                    <strong>הוסף Array Aggregator</strong>
                    <p className="text-muted-foreground mr-4">
                      לאיחוד כל הנתונים למערך אחד
                    </p>
                  </li>
                  
                  <li>
                    <strong>הוסף מודול HTTP - Make a Request</strong>
                    <ul className="list-disc list-inside mr-4 text-muted-foreground">
                      <li><strong>URL:</strong> {webhookUrl}</li>
                      <li><strong>Method:</strong> POST</li>
                      <li><strong>Headers:</strong> x-webhook-secret: {webhookSecret}</li>
                      <li><strong>Body:</strong> JSON עם table_id ו-records</li>
                    </ul>
                  </li>
                </ol>

                <div className="bg-muted p-3 rounded-lg text-right">
                  <Label className="font-semibold">דוגמת Body לבקשה:</Label>
                  <pre className="text-xs mt-2 overflow-x-auto" dir="ltr">
{`{
  "table_id": "YOUR_TABLE_ID",
  "records": [
    {
      "campaign_id": "123456789",
      "campaign_name": "Campaign Name",
      "date": "2024-01-15",
      "impressions": 1000,
      "clicks": 50,
      "cost": 150.5,
      "conversions": 5,
      "ctr": 5.0,
      "cpc": 3.01,
      "cost_per_conversion": 30.1
    }
  ]
}`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info about usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-right">איך ליצור טבלת Google Ads?</CardTitle>
        </CardHeader>
        <CardContent className="text-right space-y-2 text-muted-foreground">
          <p>1. הגדר חיבור (API ישיר או דרך Make) בלשונית המתאימה למעלה</p>
          <p>2. לך לדף "טבלאות דינמיות" וצור טבלה חדשה מסוג Google Ads</p>
          <p>3. אם משתמש ב-Make: העתק את ה-table_id מכתובת הדף והזן אותו ב-Scenario</p>
          <p>4. הפעל את ה-Scenario ב-Make והנתונים יסונכרנו אוטומטית</p>
        </CardContent>
      </Card>
    </div>
  );
}

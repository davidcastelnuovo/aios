import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Facebook, Unlink, RefreshCw, CheckCircle2, AlertCircle, Copy, Webhook, Target, ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { FacebookFormMappingSection } from "@/components/forms/FacebookFormMappingSection";

interface FacebookPage {
  id: string;
  name: string;
  access_token?: string;
}

export default function FacebookSettings() {
  const { tenant: currentTenant } = useCurrentTenant();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  
  const [selectedPage, setSelectedPage] = useState<string>("");
  const [pixelId, setPixelId] = useState<string>("");
  const [testEventCode, setTestEventCode] = useState<string>("");

  const projectUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const webhookUrl = `${projectUrl}/functions/v1/facebook-lead-webhook`;

  // Fetch Lead Ads integration
  const { data: leadAdsIntegration, isLoading: loadingLeadAds } = useQuery({
    queryKey: ['facebook-lead-ads-integration', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('integration_type', 'facebook_lead_ads')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch CAPI integration
  const { data: capiIntegration, isLoading: loadingCapi } = useQuery({
    queryKey: ['facebook-capi-integration', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('integration_type', 'facebook_capi')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch agencies for form mapping
  const { data: agencies } = useQuery({
    queryKey: ['agencies', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'active');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenant?.id,
  });

  // Initialize pixel ID from existing integration
  useEffect(() => {
    if (capiIntegration?.settings) {
      const settings = capiIntegration.settings as any;
      setPixelId(settings.pixel_id || '');
      setTestEventCode(settings.test_event_code || '');
    }
  }, [capiIntegration]);

  // Connect to Facebook mutation
  const connectMutation = useMutation({
    mutationFn: async (integrationType: string) => {
      const redirectUri = `${window.location.origin}/t/${currentTenant?.slug}/facebook-callback`;
      
      const { data, error } = await supabase.functions.invoke('facebook-auth?action=get_auth_url', {
        body: {
          tenant_id: currentTenant?.id,
          user_id: user?.id,
          integration_type: integrationType,
          redirect_uri: redirectUri,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.auth_url) {
        window.location.href = data.auth_url;
      }
    },
    onError: (error) => {
      toast.error('שגיאה בהתחברות לפייסבוק: ' + (error as Error).message);
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const { error } = await supabase
        .from('tenant_integrations')
        .update({ is_active: false, api_key: null })
        .eq('id', integrationId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('החיבור לפייסבוק נותק בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['facebook-lead-ads-integration'] });
      queryClient.invalidateQueries({ queryKey: ['facebook-capi-integration'] });
    },
    onError: (error) => {
      toast.error('שגיאה בניתוק: ' + (error as Error).message);
    },
  });

  // Subscribe page mutation
  const subscribePageMutation = useMutation({
    mutationFn: async ({ integrationId, pageId }: { integrationId: string; pageId: string }) => {
      const { data, error } = await supabase.functions.invoke('facebook-auth?action=subscribe_page', {
        body: {
          integration_id: integrationId,
          page_id: pageId,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('העמוד נרשם בהצלחה לקבלת לידים');
      queryClient.invalidateQueries({ queryKey: ['facebook-lead-ads-integration'] });
    },
    onError: (error) => {
      toast.error('שגיאה ברישום העמוד: ' + (error as Error).message);
    },
  });

  // Save CAPI settings mutation
  const saveCapiMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');
      
      const integrationData = {
        tenant_id: currentTenant.id,
        integration_type: 'facebook_capi',
        is_active: true,
        settings: {
          pixel_id: pixelId,
          test_event_code: testEventCode || null,
        },
        updated_at: new Date().toISOString(),
      };

      if (capiIntegration?.id) {
        const { error } = await supabase
          .from('tenant_integrations')
          .update(integrationData)
          .eq('id', capiIntegration.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_integrations')
          .insert(integrationData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('הגדרות CAPI נשמרו בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['facebook-capi-integration'] });
    },
    onError: (error) => {
      toast.error('שגיאה בשמירת ההגדרות: ' + (error as Error).message);
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('הועתק ללוח');
  };

  const leadAdsSettings = leadAdsIntegration?.settings as any;
  const pages = leadAdsSettings?.pages || [];
  const selectedPageName = leadAdsSettings?.page_name;

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(buildPath('/integrations'))}>
          <ArrowLeft className="h-5 w-5 rotate-180" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Facebook className="h-8 w-8 text-[#1877F2]" />
            הגדרות Facebook
          </h1>
          <p className="text-muted-foreground mt-1">
            חבר את חשבון הפייסבוק שלך לקבלת לידים אוטומטית ושליחת אירועי המרה
          </p>
        </div>
      </div>

      <Tabs defaultValue="lead-ads" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="lead-ads" className="gap-2">
            <Target className="h-4 w-4" />
            Lead Ads
          </TabsTrigger>
          <TabsTrigger value="capi" className="gap-2">
            <Webhook className="h-4 w-4" />
            Conversions API
          </TabsTrigger>
        </TabsList>

        {/* Lead Ads Tab */}
        <TabsContent value="lead-ads" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-row-reverse">
                {leadAdsIntegration?.is_active ? (
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
                <span className="text-right">Facebook Lead Ads</span>
              </CardTitle>
              <CardDescription className="text-right">
                קבל לידים אוטומטית מקמפיינים של Facebook Lead Ads ישירות למערכת
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!leadAdsIntegration?.is_active ? (
                <div className="space-y-4">
                  <Alert className="text-right">
                    <AlertTitle className="flex items-center gap-2 flex-row-reverse justify-end">
                      <Facebook className="h-4 w-4" />
                      התחבר לפייסבוק
                    </AlertTitle>
                    <AlertDescription className="text-right">
                      לחץ על הכפתור למטה כדי לאשר גישה לעמודי הפייסבוק שלך וטפסי Lead Ads
                    </AlertDescription>
                  </Alert>
                  <Button
                    onClick={() => connectMutation.mutate('facebook_lead_ads')}
                    disabled={connectMutation.isPending}
                    className="bg-[#1877F2] hover:bg-[#166FE5] gap-2"
                  >
                    <Facebook className="h-4 w-4" />
                    {connectMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        מתחבר...
                      </>
                    ) : (
                      'התחבר עם Facebook'
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Connection Status */}
                  <Alert className="bg-green-50 border-green-200 text-right">
                    <AlertTitle className="text-green-800 flex items-center gap-2 flex-row-reverse justify-end">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      מחובר בהצלחה!
                    </AlertTitle>
                    <AlertDescription className="text-green-700 text-right">
                      החשבון שלך מחובר. לידים חדשים יתקבלו אוטומטית למערכת.
                    </AlertDescription>
                  </Alert>

                  {/* Webhook URL */}
                  <div className="space-y-2 text-right">
                    <Label>Webhook URL</Label>
                    <div className="flex gap-2 flex-row-reverse">
                      <Input value={webhookUrl} readOnly className="font-mono text-sm text-left" dir="ltr" />
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrl)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      הוסף URL זה כ-Webhook בהגדרות ה-Facebook App
                    </p>
                  </div>

                  {/* Page Selection */}
                  {pages.length > 0 && (
                    <div className="space-y-2 text-right">
                      <Label>בחר עמוד פייסבוק</Label>
                      <div className="flex gap-2 flex-row-reverse">
                        <Select value={selectedPage || leadAdsSettings?.page_id || ''} onValueChange={setSelectedPage}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="בחר עמוד" />
                          </SelectTrigger>
                          <SelectContent>
                            {pages.map((page: FacebookPage) => (
                              <SelectItem key={page.id} value={page.id}>
                                {page.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={() => {
                            if (selectedPage && leadAdsIntegration?.id) {
                              subscribePageMutation.mutate({
                                integrationId: leadAdsIntegration.id,
                                pageId: selectedPage,
                              });
                            }
                          }}
                          disabled={!selectedPage || subscribePageMutation.isPending}
                          className="gap-2"
                        >
                          <RefreshCw className={`h-4 w-4 ${subscribePageMutation.isPending ? 'animate-spin' : ''}`} />
                          עדכן
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedPageName && (
                    <Alert className="text-right">
                      <AlertTitle className="flex items-center gap-2 flex-row-reverse justify-end">
                        <CheckCircle2 className="h-4 w-4" />
                        עמוד פעיל
                      </AlertTitle>
                      <AlertDescription className="text-right">
                        לידים מהעמוד "{selectedPageName}" יתקבלו אוטומטית למערכת
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Disconnect */}
                  <div className="pt-4 border-t">
                    <Button
                      variant="destructive"
                      onClick={() => leadAdsIntegration?.id && disconnectMutation.mutate(leadAdsIntegration.id)}
                      disabled={disconnectMutation.isPending}
                      className="gap-2"
                    >
                      <Unlink className="h-4 w-4" />
                      נתק חיבור
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Form Mapping Section */}
          {leadAdsIntegration?.is_active && (
            <FacebookFormMappingSection
              tenantId={currentTenant?.id || ''}
              integrationId={leadAdsIntegration?.id || null}
              accessToken={leadAdsIntegration?.api_key || null}
              agencies={agencies || []}
            />
          )}

          {/* Lead Ads Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-right">הגדרת Webhook בפייסבוק</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-right">
              <ol className="list-decimal space-y-2 mr-5 list-inside">
                <li>עבור ל-<a href="https://developers.facebook.com" target="_blank" rel="noopener" className="text-primary underline">Meta for Developers</a></li>
                <li>בחר את ה-App המשותף</li>
                <li>הוסף את המוצר "Webhooks"</li>
                <li>הגדר webhook עבור "Page" עם השדה "leadgen"</li>
                <li>הדבק את ה-Webhook URL שלמעלה</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conversions API Tab */}
        <TabsContent value="capi" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-row-reverse">
                {capiIntegration?.is_active && (capiIntegration.settings as any)?.pixel_id ? (
                  <Badge variant="default" className="bg-green-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    פעיל
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    לא מוגדר
                  </Badge>
                )}
                <span className="text-right">Facebook Conversions API</span>
              </CardTitle>
              <CardDescription className="text-right">
                שלח אירועי המרה לפייסבוק לשיפור אופטימיזציה של קמפיינים
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-right">
              <div className="space-y-2">
                <Label htmlFor="pixel-id">Pixel ID *</Label>
                <Input
                  id="pixel-id"
                  value={pixelId || (capiIntegration?.settings as any)?.pixel_id || ''}
                  onChange={(e) => setPixelId(e.target.value)}
                  placeholder="לדוגמה: 123456789012345"
                  dir="ltr"
                  className="text-left"
                />
                <p className="text-xs text-muted-foreground">
                  מצא את ה-Pixel ID ב-Events Manager של פייסבוק
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-event-code">Test Event Code (אופציונלי)</Label>
                <Input
                  id="test-event-code"
                  value={testEventCode || (capiIntegration?.settings as any)?.test_event_code || ''}
                  onChange={(e) => setTestEventCode(e.target.value)}
                  placeholder="לדוגמה: TEST12345"
                  dir="ltr"
                  className="text-left"
                />
                <p className="text-xs text-muted-foreground">
                  קוד לבדיקת אירועים ב-Test Events של פייסבוק (לא חובה)
                </p>
              </div>

              <Alert className="text-right">
                <AlertTitle className="flex items-center gap-2 flex-row-reverse justify-end">
                  <AlertCircle className="h-4 w-4" />
                  Access Token
                </AlertTitle>
                <AlertDescription className="text-right">
                  אם התחברת דרך Lead Ads, אותו Token ישמש גם עבור CAPI. אחרת, התחבר קודם בטאב Lead Ads.
                </AlertDescription>
              </Alert>

              <Button
                onClick={() => saveCapiMutation.mutate()}
                disabled={!pixelId || saveCapiMutation.isPending}
              >
                {saveCapiMutation.isPending ? 'שומר...' : 'שמור הגדרות'}
              </Button>
            </CardContent>
          </Card>

          {/* CAPI Events Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-right">אירועים נתמכים</CardTitle>
              <CardDescription className="text-right">
                המערכת שולחת אוטומטית את האירועים הבאים לפייסבוק
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg flex-row-reverse">
                  <div className="text-right">
                    <p className="font-medium">Lead</p>
                    <p className="text-xs text-muted-foreground">כאשר ליד חדש נוצר במערכת</p>
                  </div>
                  <Badge>אוטומטי</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg flex-row-reverse">
                  <div className="text-right">
                    <p className="font-medium">Contact</p>
                    <p className="text-xs text-muted-foreground">כאשר יוצרים קשר עם ליד</p>
                  </div>
                  <Badge variant="secondary">עתידי</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg flex-row-reverse">
                  <div className="text-right">
                    <p className="font-medium">Lead Qualified</p>
                    <p className="text-xs text-muted-foreground">כאשר ליד עובר לסטטוס proposal</p>
                  </div>
                  <Badge variant="secondary">עתידי</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg flex-row-reverse">
                  <div className="text-right">
                    <p className="font-medium">Purchase</p>
                    <p className="text-xs text-muted-foreground">כאשר ליד נסגר (won)</p>
                  </div>
                  <Badge variant="secondary">עתידי</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Facebook, Link, Unlink, RefreshCw, CheckCircle2, AlertCircle, Copy, Webhook, Target, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";

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

  // Initialize pixel ID from existing integration
  useState(() => {
    if (capiIntegration?.settings) {
      const settings = capiIntegration.settings as any;
      setPixelId(settings.pixel_id || '');
      setTestEventCode(settings.test_event_code || '');
    }
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(buildPath('/lead-integrations'))}>
          <ArrowLeft className="h-5 w-5" />
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
              <CardTitle className="flex items-center justify-between">
                <span>Facebook Lead Ads</span>
                {leadAdsIntegration?.is_active ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 ml-1" />
                    מחובר
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <AlertCircle className="h-3 w-3 ml-1" />
                    לא מחובר
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                קבל לידים אוטומטית מקמפיינים של Facebook Lead Ads ישירות למערכת
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!leadAdsIntegration?.is_active ? (
                <div className="space-y-4">
                  <Alert>
                    <Facebook className="h-4 w-4" />
                    <AlertTitle>התחבר לפייסבוק</AlertTitle>
                    <AlertDescription>
                      לחץ על הכפתור למטה כדי לאשר גישה לעמודי הפייסבוק שלך וטפסי Lead Ads
                    </AlertDescription>
                  </Alert>
                  <Button
                    onClick={() => connectMutation.mutate('facebook_lead_ads')}
                    disabled={connectMutation.isPending}
                    className="bg-[#1877F2] hover:bg-[#166FE5]"
                  >
                    <Facebook className="h-4 w-4 ml-2" />
                    {connectMutation.isPending ? 'מתחבר...' : 'התחבר עם Facebook'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Webhook URL */}
                  <div className="space-y-2">
                    <Label>Webhook URL</Label>
                    <div className="flex gap-2">
                      <Input value={webhookUrl} readOnly className="font-mono text-sm" />
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrl)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      הוסף URL זה כ-Webhook בהגדרות ה-Facebook App שלך
                    </p>
                  </div>

                  {/* Page Selection */}
                  {pages.length > 0 && (
                    <div className="space-y-2">
                      <Label>בחר עמוד פייסבוק</Label>
                      <div className="flex gap-2">
                        <Select value={selectedPage || leadAdsSettings?.page_id || ''} onValueChange={setSelectedPage}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="בחר עמוד" />
                          </SelectTrigger>
                          <SelectContent>
                            {pages.map((page: any) => (
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
                        >
                          <RefreshCw className={`h-4 w-4 ml-2 ${subscribePageMutation.isPending ? 'animate-spin' : ''}`} />
                          עדכן
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedPageName && (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>עמוד פעיל</AlertTitle>
                      <AlertDescription>
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
                    >
                      <Unlink className="h-4 w-4 ml-2" />
                      נתק חיבור
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lead Ads Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>הגדרת Facebook App</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <ol className="list-decimal list-inside space-y-2">
                <li>עבור ל-<a href="https://developers.facebook.com" target="_blank" rel="noopener" className="text-primary underline">Meta for Developers</a></li>
                <li>צור App חדש או בחר App קיים</li>
                <li>הוסף את המוצר "Webhooks"</li>
                <li>הגדר webhook עבור "Page" עם השדה "leadgen"</li>
                <li>השתמש ב-Verify Token שתבחר</li>
                <li>הוסף את המוצר "Facebook Login"</li>
                <li>הוסף את ה-permissions הנדרשים: pages_manage_ads, leads_retrieval, pages_read_engagement</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conversions API Tab */}
        <TabsContent value="capi" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Facebook Conversions API</span>
                {capiIntegration?.is_active && (capiIntegration.settings as any)?.pixel_id ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 ml-1" />
                    פעיל
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <AlertCircle className="h-3 w-3 ml-1" />
                    לא מוגדר
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                שלח אירועי המרה לפייסבוק לשיפור אופטימיזציה של קמפיינים
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pixel-id">Pixel ID *</Label>
                <Input
                  id="pixel-id"
                  value={pixelId || (capiIntegration?.settings as any)?.pixel_id || ''}
                  onChange={(e) => setPixelId(e.target.value)}
                  placeholder="לדוגמה: 123456789012345"
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
                />
                <p className="text-xs text-muted-foreground">
                  קוד לבדיקת אירועים ב-Test Events של פייסבוק (לא חובה)
                </p>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Access Token</AlertTitle>
                <AlertDescription>
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
              <CardTitle>אירועים נתמכים</CardTitle>
              <CardDescription>
                המערכת שולחת אוטומטית את האירועים הבאים לפייסבוק
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">Lead</p>
                    <p className="text-xs text-muted-foreground">כאשר ליד חדש נוצר במערכת</p>
                  </div>
                  <Badge>אוטומטי</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">Contact</p>
                    <p className="text-xs text-muted-foreground">כאשר יוצרים קשר עם ליד</p>
                  </div>
                  <Badge variant="secondary">עתידי</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">Lead Qualified</p>
                    <p className="text-xs text-muted-foreground">כאשר ליד עובר לסטטוס proposal</p>
                  </div>
                  <Badge variant="secondary">עתידי</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
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

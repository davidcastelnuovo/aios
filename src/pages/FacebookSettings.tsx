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
import { Facebook, Link, Unlink, RefreshCw, CheckCircle2, AlertCircle, Copy, Webhook, Target, ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
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
  const [appId, setAppId] = useState<string>("");
  const [appSecret, setAppSecret] = useState<string>("");
  const [manualAccessToken, setManualAccessToken] = useState<string>("");
  const [loadedPages, setLoadedPages] = useState<FacebookPage[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [pageSearchQuery, setPageSearchQuery] = useState("");

  // Fetch Facebook App credentials from tenant_settings
  const { data: appCredentials, isLoading: loadingCredentials } = useQuery({
    queryKey: ['facebook-app-credentials', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('setting_value')
        .eq('tenant_id', currentTenant.id)
        .eq('setting_key', 'facebook_app_credentials')
        .maybeSingle();
      if (error) throw error;
      if (data?.setting_value) {
        const creds = data.setting_value as { app_id?: string; app_secret?: string };
        setAppId(creds.app_id || '');
        setAppSecret(creds.app_secret || '');
        return creds;
      }
      return null;
    },
    enabled: !!currentTenant?.id,
  });

  // Save Facebook App credentials mutation
  const saveAppCredentialsMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');
      if (!appId.trim() || !appSecret.trim()) throw new Error('App ID and App Secret are required');

      // Upsert the credentials
      const { error } = await supabase
        .from('tenant_settings')
        .upsert({
          tenant_id: currentTenant.id,
          setting_key: 'facebook_app_credentials',
          setting_value: {
            app_id: appId.trim(),
            app_secret: appSecret.trim(),
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,setting_key',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('הגדרות Facebook App נשמרו בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['facebook-app-credentials'] });
    },
    onError: (error) => {
      toast.error('שגיאה בשמירת ההגדרות: ' + (error as Error).message);
    },
  });

  // Save manual Access Token mutation
  const saveAccessTokenMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');
      if (!manualAccessToken.trim()) throw new Error('Access Token is required');
      
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) throw new Error('No user');

      // Check if integration exists
      const { data: existing } = await supabase
        .from('tenant_integrations')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .eq('integration_type', 'facebook_lead_ads')
        .eq('user_id', user.user.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('tenant_integrations')
          .update({
            api_key: manualAccessToken.trim(),
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('tenant_integrations')
          .insert({
            tenant_id: currentTenant.id,
            user_id: user.user.id,
            integration_type: 'facebook_lead_ads',
            api_key: manualAccessToken.trim(),
            is_active: true,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Access Token נשמר בהצלחה - האינטגרציה פעילה!');
      queryClient.invalidateQueries({ queryKey: ['facebook-lead-ads-integration'] });
      setManualAccessToken('');
    },
    onError: (error) => {
      toast.error('שגיאה בשמירת ה-Token: ' + (error as Error).message);
    },
  });

  // Load Facebook pages function
  const loadFacebookPages = async (token: string) => {
    setIsLoadingPages(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-facebook-forms', {
        body: { tenant_id: currentTenant?.id, access_token: token },
      });
      
      if (error) throw error;
      
      const pages = data?.pages || [];
      setLoadedPages(pages);
      
      if (pages.length > 0) {
        toast.success(`נמצאו ${pages.length} עמודים!`);
        
        // Save pages to integration settings
        if (leadAdsIntegration?.id) {
          const currentSettings = leadAdsIntegration.settings || {};
          await supabase
            .from('tenant_integrations')
            .update({ 
              settings: { ...currentSettings as any, pages },
              updated_at: new Date().toISOString(),
            })
            .eq('id', leadAdsIntegration.id);
          queryClient.invalidateQueries({ queryKey: ['facebook-lead-ads-integration'] });
        }
      } else {
        toast.error('לא נמצאו עמודים - וודא שה-Token כולל את כל ההרשאות הנדרשות');
      }
      
      return pages;
    } catch (error) {
      console.error('Error loading pages:', error);
      toast.error('שגיאה בטעינת עמודים: ' + (error as Error).message);
      return [];
    } finally {
      setIsLoadingPages(false);
    }
  };

  // Graph API Explorer URL with permissions
  const graphExplorerUrl = `https://developers.facebook.com/tools/explorer/?permissions=pages_show_list%2Cpages_manage_metadata%2Cpages_manage_ads%2Cleads_retrieval%2Cpages_read_engagement`;

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
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(buildPath('/lead-integrations'))}>
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

      {/* Facebook App Credentials Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5 text-[#1877F2]" />
            הגדרות Facebook App
          </CardTitle>
          <CardDescription>
            הזן את פרטי ה-Facebook App שלך (מ-Meta for Developers)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="app-id">App ID</Label>
            <Input
              id="app-id"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="לדוגמה: 123456789012345"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="app-secret">App Secret</Label>
            <Input
              id="app-secret"
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder="••••••••••••••••"
            />
          </div>
          <Button
            onClick={() => saveAppCredentialsMutation.mutate()}
            disabled={saveAppCredentialsMutation.isPending || !appId.trim() || !appSecret.trim()}
          >
            {saveAppCredentialsMutation.isPending ? 'שומר...' : 'שמור הגדרות'}
          </Button>
          {appCredentials && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                הגדרות App נשמרו. App ID: {appCredentials.app_id?.slice(0, 6)}...
              </AlertDescription>
            </Alert>
          )}
          
          {/* Manual Access Token Section */}
          <div className="border-t pt-4 mt-4 space-y-4">
            <div>
              <Label className="text-base font-medium">הזנה ידנית של Access Token</Label>
              <p className="text-sm text-muted-foreground mt-1">
                קבל Access Token מ-Graph API Explorer עם כל ההרשאות הנדרשות
              </p>
            </div>
            
            {/* Graph API Explorer Link */}
            <Alert className="bg-blue-50 border-blue-200">
              <Facebook className="h-4 w-4 text-[#1877F2]" />
              <AlertTitle className="text-blue-800">איך לקבל Access Token?</AlertTitle>
              <AlertDescription className="text-blue-700 space-y-2">
                <ol className="list-decimal pr-5 space-y-1 text-sm">
                  <li>לחץ על הקישור למטה לפתיחת Graph API Explorer</li>
                  <li>בחר את ה-App שלך בצד ימין</li>
                  <li>לחץ "Generate Access Token" (ההרשאות כבר מסומנות)</li>
                  <li>העתק את ה-Token שנוצר והדבק כאן</li>
                </ol>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-2"
                  onClick={() => window.open(graphExplorerUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  פתח Graph API Explorer
                </Button>
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="access-token">Access Token</Label>
              <Input
                id="access-token"
                value={manualAccessToken}
                onChange={(e) => setManualAccessToken(e.target.value)}
                placeholder="EAAxxxxxxxx..."
                className="font-mono text-sm"
              />
            </div>
            <Button
              onClick={() => saveAccessTokenMutation.mutate()}
              disabled={saveAccessTokenMutation.isPending || !manualAccessToken.trim()}
              variant="secondary"
            >
              {saveAccessTokenMutation.isPending ? 'שומר...' : 'שמור Access Token'}
            </Button>
            {leadAdsIntegration?.is_active && leadAdsIntegration?.api_key && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Access Token פעיל - האינטגרציה מחוברת!
                </AlertDescription>
              </Alert>
            )}

            {/* Load Pages Button */}
            {leadAdsIntegration?.is_active && leadAdsIntegration?.api_key && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">עמודי פייסבוק שלך</Label>
                  <Button
                    onClick={() => loadFacebookPages(leadAdsIntegration.api_key!)}
                    disabled={isLoadingPages}
                    variant="outline"
                    className="gap-2"
                  >
                    {isLoadingPages ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {isLoadingPages ? 'טוען...' : 'טען עמודים'}
                  </Button>
                </div>
                
                {loadedPages.length > 0 && (
                  <div className="space-y-3">
                    {/* Search Input */}
                    <Input
                      placeholder="חפש לפי שם עמוד..."
                      value={pageSearchQuery}
                      onChange={(e) => setPageSearchQuery(e.target.value)}
                      className="max-w-sm"
                    />
                    
                    {/* Pages Count */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>נמצאו {loadedPages.length} עמודים</span>
                      {pageSearchQuery && (
                        <span>
                          (מציג {loadedPages.filter(p => p.name.toLowerCase().includes(pageSearchQuery.toLowerCase())).length})
                        </span>
                      )}
                    </div>
                    
                    {/* Pages List */}
                    <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                      {loadedPages
                        .filter(page => page.name.toLowerCase().includes(pageSearchQuery.toLowerCase()))
                        .map((page) => (
                          <div key={page.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div className="flex items-center gap-2">
                              <Facebook className="h-4 w-4 text-[#1877F2]" />
                              <span className="font-medium">{page.name}</span>
                            </div>
                            <Badge variant="outline" className="font-mono text-xs">
                              {page.id}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                
                {loadedPages.length === 0 && !isLoadingPages && (
                  <p className="text-sm text-muted-foreground">
                    לחץ על "טען עמודים" כדי לראות את העמודים שאתה מנהל
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
                    className="bg-[#1877F2] hover:bg-[#166FE5] gap-2"
                  >
                    <Facebook className="h-4 w-4" />
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
                          className="gap-2"
                        >
                          <RefreshCw className={`h-4 w-4 ${subscribePageMutation.isPending ? 'animate-spin' : ''}`} />
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
              <CardTitle>הגדרת Facebook App</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <ol className="list-decimal space-y-2 pr-5">
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

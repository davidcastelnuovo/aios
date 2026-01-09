import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Unlink, RefreshCw, CheckCircle2, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
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

export default function GoogleAdsSettings() {
  const { tenant: currentTenant } = useCurrentTenant();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();

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

  // Connect to Google Ads mutation
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
      
      // Redirect immediately if we have auth_url
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

  const isConnected = googleAdsIntegration?.is_active && googleAdsIntegration?.api_key;
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
            <span className="text-right">Google Ads</span>
          </CardTitle>
          <CardDescription className="text-right">
            סנכרון אוטומטי של נתוני קמפיינים מ-Google Ads
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
                  לחץ על הכפתור למטה כדי לאשר גישה לחשבונות Google Ads שלך
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

      {/* Info about usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-right">איך זה עובד?</CardTitle>
        </CardHeader>
        <CardContent className="text-right space-y-2 text-muted-foreground">
          <p>1. התחבר לחשבון Google Ads שלך באמצעות הכפתור למעלה</p>
          <p>2. צור טבלה דינמית חדשה מסוג "Google Ads" בדף הטבלאות</p>
          <p>3. בחר את חשבון המודעות שברצונך לסנכרן</p>
          <p>4. הנתונים יסונכרנו אוטומטית עם פירוט יומי</p>
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Webhook, Facebook, MessageCircle, ArrowLeft, Settings, TrendingUp, Calculator, Zap, Search, Video, Mail } from "lucide-react";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

interface IntegrationCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
  isConnected: boolean;
  route: string;
  gradient: string;
}

function IntegrationCard({ icon, title, description, features, isConnected, route, gradient }: IntegrationCardProps) {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className={`p-4 ${gradient}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            {icon}
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"} className={isConnected ? "bg-green-500/90 hover:bg-green-500" : ""}>
            {isConnected ? "✓ מחובר" : "לא מוגדר"}
          </Badge>
        </div>
      </div>
      <CardContent className="p-5 space-y-4">
        <p className="text-muted-foreground text-sm">{description}</p>
        <ul className="space-y-1.5">
          {features.map((feature, index) => (
            <li key={index} className="text-sm flex items-center gap-2">
              <span className="text-primary">•</span>
              {feature}
            </li>
          ))}
        </ul>
        <Button 
          className="w-full" 
          variant="outline"
          onClick={() => navigate(buildPath(route))}
        >
          <Settings className="h-4 w-4 ml-2" />
          הגדרות
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Integrations() {
  const { currentTenantId } = useTenant();

  // Check Green API connection status
  const { data: greenApiIntegration } = useQuery({
    queryKey: ['green-api-integration', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'green_api')
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenantId,
  });

  // Check Facebook integration status
  const { data: facebookIntegration } = useQuery({
    queryKey: ['facebook-integration', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'facebook')
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenantId,
  });

  // Check ManyChat integration status
  const { data: manychatIntegration } = useQuery({
    queryKey: ['manychat-integration', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'manychat')
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenantId,
  });

  // Check Google Ads integration status
  const { data: googleAdsIntegration } = useQuery({
    queryKey: ['google-ads-integration', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'google_ads')
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenantId,
  });

  // Check Make.com (Google Ads via Make) integration status
  const { data: makeIntegration } = useQuery({
    queryKey: ['make-integration', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'google_ads_make')
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenantId,
  });

  // Check Google Analytics integration status
  const { data: googleAnalyticsIntegration } = useQuery({
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

  // Check Google Search Console integration status
  const { data: googleSearchConsoleIntegration } = useQuery({
    queryKey: ['google-search-console-integration', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'google_search_console')
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenantId,
  });

  // Check Ahrefs integration status
  const { data: ahrefsIntegration } = useQuery({
    queryKey: ['ahrefs-integration', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'ahrefs')
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenantId,
  });

  // Check DataForSEO / SerpAPI integration status
  const { data: dataForSeoIntegration } = useQuery({
    queryKey: ['dataforseo-integration', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      // Check DataForSEO first
      const { data: dfData } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'dataforseo')
        .eq('is_active', true)
        .maybeSingle();
      if (dfData) return dfData;
      // Fallback to SerpAPI
      const { data: serpData } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'serpapi')
        .eq('is_active', true)
        .maybeSingle();
      return serpData;
    },
    enabled: !!currentTenantId,
  });

  // Check Sumit integration status
  const { data: sumitIntegration } = useQuery({
    queryKey: ['sumit-integration', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'sumit')
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenantId,
  });

  // Check Zoom integration status
  const { data: zoomIntegration } = useQuery({
    queryKey: ['zoom-integration', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .eq('integration_type', 'zoom')
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: !!currentTenantId,
  });

  // Check Gmail connection status
  const { data: gmailStatus } = useQuery({
    queryKey: ['gmail-status-integrations'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('gmail-auth', {
        body: { action: 'status' },
      });
      if (error) return null;
      return data as { connected: boolean } | null;
    },
  });

  const integrations: IntegrationCardProps[] = [
    {
      icon: <Webhook className="h-6 w-6" />,
      title: "Webhook",
      description: "קליטת לידים אוטומטית ממקורות חיצוניים",
      features: [
        "חיבור ל-Make / Zapier",
        "קליטה מטפסי אתר",
        "בונה JSON אינטראקטיבי",
      ],
      isConnected: true,
      route: "lead-integrations",
      gradient: "bg-gradient-to-r from-purple-600 to-purple-800",
    },
    {
      icon: <Facebook className="h-6 w-6" />,
      title: "Facebook",
      description: "חיבור ל-Facebook Lead Ads ו-Conversions API",
      features: [
        "קליטת לידים מ-Lead Ads",
        "שליחת אירועי המרה ל-CAPI",
        "סנכרון טפסים אוטומטי",
      ],
      isConnected: !!facebookIntegration,
      route: "facebook-settings",
      gradient: "bg-gradient-to-r from-blue-600 to-blue-800",
    },
    {
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
        </svg>
      ),
      title: "Google Ads",
      description: "סנכרון נתוני קמפיינים מ-Google Ads",
      features: [
        "נתוני ביצועים יומיים",
        "מעקב המרות ועלויות",
        "סנכרון אוטומטי לטבלאות",
      ],
      isConnected: !!googleAdsIntegration,
      route: "google-ads-settings",
      gradient: "bg-gradient-to-r from-yellow-500 to-red-500",
    },
    {
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      ),
      title: "Google Analytics",
      description: "סנכרון נתוני תנועה ומעקב אתר",
      features: [
        "Sessions, Users, Pageviews",
        "Bounce Rate ו-Session Duration",
        "מקורות תנועה",
      ],
      isConnected: !!googleAnalyticsIntegration,
      route: "google-analytics-settings",
      gradient: "bg-gradient-to-r from-orange-500 to-orange-600",
    },
    {
      icon: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
      ),
      title: "Google Search Console",
      description: "נתוני SEO וביצועים בחיפוש",
      features: [
        "Clicks, Impressions, CTR",
        "מילות מפתח מובילות",
        "מיקום ממוצע בחיפוש",
      ],
      isConnected: !!googleSearchConsoleIntegration,
      route: "google-search-console-settings",
      gradient: "bg-gradient-to-r from-blue-600 to-indigo-600",
    },
    {
      icon: <MessageCircle className="h-6 w-6" />,
      title: "Green API",
      description: "חיבור WhatsApp ישיר לצ'אט עם לקוחות ולידים",
      features: [
        "שליחת וקבלת הודעות",
        "סנכרון שיחות בזמן אמת",
        "תמיכה בקבצים ותמונות",
      ],
      isConnected: !!greenApiIntegration,
      route: "green-api-settings",
      gradient: "bg-gradient-to-r from-green-600 to-green-800",
    },
    {
      icon: <MessageCircle className="h-6 w-6" />,
      title: "ManyChat",
      description: "פלטפורמת צ'אט והודעות עם אוטומציות מתקדמות",
      features: [
        "אינטגרציה עם Facebook Messenger",
        "סנכרון אוטומטי של contacts",
        "תמיכה בטאגים ואוטומציות",
      ],
      isConnected: !!manychatIntegration,
      route: "manychat-settings",
      gradient: "bg-gradient-to-r from-blue-500 to-indigo-600",
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Ahrefs",
      description: "נתוני SEO מתקדמים - דירוגים, בקלינקים ומילות מפתח",
      features: [
        "מעקב דירוגים יומי",
        "ניתוח בקלינקים ודומיינים",
        "מחקר מילות מפתח",
      ],
      isConnected: !!ahrefsIntegration,
      route: "ahrefs-settings",
      gradient: "bg-gradient-to-r from-orange-500 to-red-600",
    },
    {
      icon: <Search className="h-6 w-6" />,
      title: "DataForSEO - Rank Tracking",
      description: "מעקב דירוגים בזמן אמת - מחיר Pay-as-you-go נמוך",
      features: [
        "מיקום מדויק בזמן אמת",
        "היסטוריית דירוגים וגרפים",
        "מעקב אחרי מתחרים",
        "~$0.0015 לחיפוש בלבד",
      ],
      isConnected: !!dataForSeoIntegration,
      route: "integrations/serpapi",
      gradient: "bg-gradient-to-r from-emerald-500 to-teal-600",
    },
    {
      icon: <Calculator className="h-6 w-6" />,
      title: "Sumit",
      description: "סנכרון אוטומטי של לקוחות וחשבוניות לתוכנת הנה\"ח",
      features: [
        "סנכרון לקוחות",
        "יצירת חשבוניות אוטומטית",
        "מעקב תשלומים",
      ],
      isConnected: !!sumitIntegration,
      route: "accounting-settings",
      gradient: "bg-gradient-to-r from-emerald-600 to-teal-700",
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Make.com",
      description: "חיבור API ישיר ל-Make.com - גישה לכל ה-Connections והסינריואים",
      features: [
        "חיבור לכל שירותי Make.com",
        "הפעלת Scenarios מהמערכת",
        "צפייה בכל ה-Connections",
      ],
      isConnected: !!makeIntegration,
      route: "make-settings",
      gradient: "bg-gradient-to-r from-violet-600 to-purple-700",
    },
    {
      icon: <Video className="h-6 w-6" />,
      title: "Zoom",
      description: "קבלת הקלטות פגישות אוטומטית דרך Webhook",
      features: [
        "קבלת הקלטות מסך ואודיו",
        "שיוך הקלטות ללקוח או ליד",
        "תמיכה ב-Zoom Webhook Events",
      ],
      isConnected: !!zoomIntegration,
      route: "zoom-settings",
      gradient: "bg-gradient-to-r from-blue-500 to-blue-700",
    },
    {
      icon: <Mail className="h-6 w-6" />,
      title: "Gmail",
      description: "חיבור תיבת Gmail לשליחה, קבלה וארגון מיילים",
      features: [
        "שליחה וקבלה של מיילים",
        "ארגון לפי קטגוריות",
        "חסימת שולחים",
        "חיפוש מתקדם",
      ],
      isConnected: !!gmailStatus?.connected,
      route: "gmail-settings",
      gradient: "bg-gradient-to-r from-red-500 to-red-700",
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">אינטגרציות</h1>
        <p className="text-muted-foreground mt-2">
          חבר את המערכת למקורות לידים חיצוניים ולפלטפורמות צ'אט
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((integration) => (
          <IntegrationCard key={integration.title} {...integration} />
        ))}
      </div>
    </div>
  );
}

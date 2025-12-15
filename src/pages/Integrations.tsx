import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Webhook, Facebook, MessageCircle, ArrowLeft, Settings } from "lucide-react";
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

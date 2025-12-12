import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Share2, CheckCircle2 } from "lucide-react";

interface SharedFacebookConnectionBannerProps {
  integration: {
    id: string;
    shared_from_integration_id?: string | null;
    settings?: any;
  } | null;
}

export function SharedFacebookConnectionBanner({ integration }: SharedFacebookConnectionBannerProps) {
  // Fetch source integration details
  const { data: sourceIntegration } = useQuery({
    queryKey: ['source-facebook-integration', integration?.shared_from_integration_id],
    queryFn: async () => {
      if (!integration?.shared_from_integration_id) return null;
      
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select(`
          id,
          tenant_id,
          settings,
          api_key,
          tenants:tenant_id (
            name
          )
        `)
        .eq('id', integration.shared_from_integration_id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!integration?.shared_from_integration_id,
  });

  if (!integration?.shared_from_integration_id || !sourceIntegration) {
    return null;
  }

  const sourceTenantName = (sourceIntegration.tenants as any)?.name || 'ארגון אחר';
  const sourceSettings = sourceIntegration.settings as any;
  const pageName = sourceSettings?.page_name;

  return (
    <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800 text-right">
      <AlertTitle className="flex items-center gap-2 flex-row-reverse justify-end text-blue-800 dark:text-blue-200">
        <Share2 className="h-4 w-4" />
        חיבור משותף
        <Badge variant="secondary" className="mr-2 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          פעיל
        </Badge>
      </AlertTitle>
      <AlertDescription className="text-blue-700 dark:text-blue-300 text-right mt-2">
        אינטגרציה זו משותפת מ-<strong>{sourceTenantName}</strong>.
        {pageName && (
          <> לידים מהעמוד "{pageName}" יתקבלו אוטומטית.</>
        )}
        <br />
        <span className="text-sm opacity-80">
          ניתן להגדיר Form Mapping ייחודי לארגון זה.
        </span>
      </AlertDescription>
    </Alert>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Link2, Unlink, RefreshCw, Search, MousePointerClick, Eye, Target } from "lucide-react";

interface GscIntegrationProps {
  tenantId: string;
  clientId: string;
  domain?: string;
  keywords?: string[];
  onDataLoaded?: (data: GscKeywordData[]) => void;
}

export interface GscKeywordData {
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export function GscIntegration({ tenantId, clientId, domain, keywords, onDataLoaded }: GscIntegrationProps) {
  const queryClient = useQueryClient();
  const [selectedSite, setSelectedSite] = useState<string>("");

  // Check for existing GSC integration
  const { data: gscIntegration, isLoading: isLoadingIntegration } = useQuery({
    queryKey: ['gsc-integration', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'google_search_console')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const settings = gscIntegration?.settings as any;
  const availableSites = settings?.available_sites || [];
  const connectedSiteUrl = selectedSite || settings?.site_url || '';

  // Auto-match domain to GSC site
  const matchedSite = domain
    ? availableSites.find((s: any) =>
        s.siteUrl?.includes(domain.replace(/^www\./, '')) ||
        s.siteUrl?.includes(domain)
      )
    : null;

  const effectiveSiteUrl = connectedSiteUrl || matchedSite?.siteUrl || '';

  // Fetch GSC data for keywords
  const { data: gscData, isLoading: isLoadingData, refetch: refetchData } = useQuery({
    queryKey: ['gsc-keyword-data', gscIntegration?.id, effectiveSiteUrl, keywords?.join(',')],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('fetch-gsc-data', {
        body: {
          integrationId: gscIntegration!.id,
          siteUrl: effectiveSiteUrl,
          keywords: keywords || [],
        },
      });

      if (response.error) throw response.error;
      const rows = response.data?.rows || [];
      onDataLoaded?.(rows);
      return rows as GscKeywordData[];
    },
    enabled: !!gscIntegration?.id && !!effectiveSiteUrl,
  });

  // Connect GSC mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke(
        'google-search-console-auth?action=authorize',
        {
          body: {
            tenantId,
            userId: session.user.id,
            siteUrl: domain || '',
          },
        }
      );

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      if (data?.authUrl) {
        window.open(data.authUrl, '_blank', 'width=600,height=700');
      }
    },
    onError: (error) => {
      toast.error('שגיאה בחיבור ל-Google Search Console');
      console.error(error);
    },
  });

  // Update site URL
  const updateSiteMutation = useMutation({
    mutationFn: async (siteUrl: string) => {
      if (!gscIntegration?.id) return;
      const { error } = await supabase
        .from('tenant_integrations')
        .update({
          settings: { ...settings, site_url: siteUrl },
        })
        .eq('id', gscIntegration.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gsc-integration'] });
      queryClient.invalidateQueries({ queryKey: ['gsc-keyword-data'] });
      toast.success('האתר עודכן');
    },
  });

  if (isLoadingIntegration) return null;

  // Not connected - show connect button
  if (!gscIntegration) {
    return (
      <Card className="border-dashed border-primary/30">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              חבר Google Search Console כדי להשלים נתוני קליקים, חשיפות ו-CTR
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="gap-2"
          >
            <Link2 className="h-4 w-4" />
            {connectMutation.isPending ? 'מתחבר...' : 'חבר GSC'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Connected - show site selector and data
  return (
    <Card className="border-primary/20">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Google Search Console</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {settings?.google_email || 'מחובר'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {availableSites.length > 1 && (
              <Select
                value={effectiveSiteUrl}
                onValueChange={(val) => {
                  setSelectedSite(val);
                  updateSiteMutation.mutate(val);
                }}
              >
                <SelectTrigger className="h-7 text-xs w-[200px]">
                  <SelectValue placeholder="בחר אתר" />
                </SelectTrigger>
                <SelectContent>
                  {availableSites.map((site: any) => (
                    <SelectItem key={site.siteUrl} value={site.siteUrl}>
                      {site.siteUrl.replace('sc-domain:', '').replace('https://', '')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => refetchData()}
              disabled={isLoadingData}
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingData ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Summary stats */}
      {gscData && gscData.length > 0 && (
        <CardContent className="px-4 pb-3 pt-0">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <MousePointerClick className="h-3 w-3" />
                קליקים
              </div>
              <p className="text-sm font-bold">
                {gscData.reduce((s: number, r: GscKeywordData) => s + r.clicks, 0).toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Eye className="h-3 w-3" />
                חשיפות
              </div>
              <p className="text-sm font-bold">
                {gscData.reduce((s: number, r: GscKeywordData) => s + r.impressions, 0).toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Target className="h-3 w-3" />
                CTR ממוצע
              </div>
              <p className="text-sm font-bold">
                {(gscData.reduce((s: number, r: GscKeywordData) => s + r.ctr, 0) / gscData.length).toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      )}

      {effectiveSiteUrl && !gscData && !isLoadingData && (
        <CardContent className="px-4 pb-3 pt-0">
          <p className="text-xs text-muted-foreground text-center">אין נתונים זמינים</p>
        </CardContent>
      )}
    </Card>
  );
}

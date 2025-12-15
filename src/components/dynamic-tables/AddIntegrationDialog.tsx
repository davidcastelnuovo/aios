import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { Loader2, Facebook, BarChart3, Search, ExternalLink, Plus, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Google Ads Icon
const GoogleAdsIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="#4285F4"/>
  </svg>
);

interface AddIntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableId: string;
  existingIntegrations: Array<{ type: string }>;
  onIntegrationAdded: () => void;
}

type IntegrationType = 'facebook_insights' | 'google_ads' | 'google_analytics' | 'google_search_console';

interface PlatformConfig {
  type: IntegrationType;
  name: string;
  icon: React.ReactNode;
  color: string;
  integrationType: string;
  settingsRoute: string;
}

const PLATFORMS: PlatformConfig[] = [
  {
    type: 'facebook_insights',
    name: 'Facebook Insights',
    icon: <Facebook className="h-5 w-5" />,
    color: 'bg-blue-600',
    integrationType: 'facebook',
    settingsRoute: 'facebook-settings',
  },
  {
    type: 'google_ads',
    name: 'Google Ads',
    icon: <GoogleAdsIcon />,
    color: 'bg-blue-500',
    integrationType: 'google_ads',
    settingsRoute: 'google-ads-settings',
  },
  {
    type: 'google_analytics',
    name: 'Google Analytics',
    icon: <BarChart3 className="h-5 w-5" />,
    color: 'bg-orange-500',
    integrationType: 'google_analytics',
    settingsRoute: 'google-analytics-settings',
  },
  {
    type: 'google_search_console',
    name: 'Search Console',
    icon: <Search className="h-5 w-5" />,
    color: 'bg-green-500',
    integrationType: 'google_search_console',
    settingsRoute: 'google-search-console-settings',
  },
];

export function AddIntegrationDialog({ 
  open, 
  onOpenChange, 
  tableId, 
  existingIntegrations,
  onIntegrationAdded 
}: AddIntegrationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentTenant, currentTenantId: activeTenantId } = useTenant();
  
  const [selectedPlatform, setSelectedPlatform] = useState<IntegrationType | null>(null);
  const [selectedResource, setSelectedResource] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Check which platforms are already connected
  const existingTypes = existingIntegrations.map(i => i.type);
  const availablePlatforms = PLATFORMS.filter(p => !existingTypes.includes(p.type));

  // Fetch user integrations for the selected platform
  const { data: integration, isLoading: integrationLoading } = useQuery({
    queryKey: ['platform-integration', selectedPlatform, activeTenantId],
    queryFn: async () => {
      if (!selectedPlatform) return null;
      const platform = PLATFORMS.find(p => p.type === selectedPlatform);
      if (!platform) return null;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .eq('integration_type', platform.integrationType)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      
      return data;
    },
    enabled: !!selectedPlatform && !!activeTenantId,
  });

  // Fetch resources based on platform type
  const { data: resources, isLoading: resourcesLoading } = useQuery({
    queryKey: ['platform-resources', selectedPlatform, integration?.id],
    queryFn: async () => {
      if (!integration || !selectedPlatform) return [];
      
      switch (selectedPlatform) {
        case 'facebook_insights': {
          const { data } = await supabase.functions.invoke('get-facebook-ad-accounts', {
            body: { integrationId: integration.id }
          });
          return data?.adAccounts?.map((a: any) => ({ id: a.id, name: a.name })) || [];
        }
        case 'google_ads': {
          const settings = integration.settings as any;
          if (settings?.customers) {
            return settings.customers.map((c: any) => ({ id: c.id, name: c.descriptiveName || c.id }));
          }
          return [];
        }
        case 'google_analytics': {
          const { data } = await supabase.functions.invoke('google-analytics-auth', {
            body: { action: 'get_properties', integrationId: integration.id }
          });
          return data?.properties?.map((p: any) => ({ id: p.propertyId, name: p.displayName })) || [];
        }
        case 'google_search_console': {
          const { data } = await supabase.functions.invoke('google-search-console-auth', {
            body: { action: 'get_sites', integrationId: integration.id }
          });
          return data?.sites?.map((s: any) => ({ id: s.siteUrl, name: s.siteUrl })) || [];
        }
        default:
          return [];
      }
    },
    enabled: !!integration && !!selectedPlatform,
  });

  const handleAddIntegration = async () => {
    if (!selectedPlatform || !selectedResource || !integration) {
      toast({ title: "נא לבחור פלטפורמה ומשאב", variant: "destructive" });
      return;
    }

    setIsAdding(true);
    try {
      // Fetch current table
      const { data: table, error: fetchError } = await supabase
        .from('crm_tables')
        .select('integrations')
        .eq('id', tableId)
        .single();

      if (fetchError) throw fetchError;

      const currentIntegrations = (table?.integrations as any[]) || [];
      const resource = resources?.find((r: any) => r.id === selectedResource);
      
      const newIntegration = {
        type: selectedPlatform,
        integrationId: integration.id,
        resourceId: selectedResource,
        resourceName: resource?.name || selectedResource,
        addedAt: new Date().toISOString(),
      };

      // Update table with new integration
      const { error: updateError } = await supabase
        .from('crm_tables')
        .update({ 
          integrations: [...currentIntegrations, newIntegration],
          updated_at: new Date().toISOString()
        })
        .eq('id', tableId);

      if (updateError) throw updateError;

      toast({ title: "החיבור נוסף בהצלחה!" });
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      queryClient.invalidateQueries({ queryKey: ['crm-table', tableId] });
      onIntegrationAdded();
      onOpenChange(false);
      setSelectedPlatform(null);
      setSelectedResource("");
    } catch (error: any) {
      toast({ title: "שגיאה בהוספת החיבור", description: error.message, variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  const selectedPlatformConfig = PLATFORMS.find(p => p.type === selectedPlatform);
  const isLoading = integrationLoading || resourcesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            הוסף חיבור לטבלה
          </DialogTitle>
          <DialogDescription>
            בחר פלטפורמה נוספת לחיבור לטבלה זו
          </DialogDescription>
        </DialogHeader>

        {availablePlatforms.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            כל הפלטפורמות כבר מחוברות לטבלה זו
          </div>
        ) : (
          <div className="space-y-4">
            {/* Platform Selection */}
            <div className="grid grid-cols-2 gap-3">
              {availablePlatforms.map((platform) => (
                <Card 
                  key={platform.type}
                  className={`cursor-pointer transition-all ${
                    selectedPlatform === platform.type 
                      ? 'ring-2 ring-primary' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => { setSelectedPlatform(platform.type); setSelectedResource(""); }}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${platform.color} text-white`}>
                      {platform.icon}
                    </div>
                    <span className="font-medium text-sm">{platform.name}</span>
                    {selectedPlatform === platform.type && (
                      <Check className="h-4 w-4 text-primary mr-auto" />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Resource Selection */}
            {selectedPlatform && (
              <div className="space-y-3 pt-2">
                {isLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !integration ? (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      לא נמצא חיבור {selectedPlatformConfig?.name} פעיל
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/t/${currentTenant?.slug}/${selectedPlatformConfig?.settingsRoute}`}>
                        <ExternalLink className="h-4 w-4 ml-2" />
                        חבר {selectedPlatformConfig?.name}
                      </a>
                    </Button>
                  </div>
                ) : resources && resources.length > 0 ? (
                  <div className="space-y-2">
                    <Label>בחר משאב</Label>
                    <Select value={selectedResource} onValueChange={setSelectedResource}>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר..." />
                      </SelectTrigger>
                      <SelectContent>
                        {resources.map((resource: any) => (
                          <SelectItem key={resource.id} value={resource.id}>
                            {resource.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    לא נמצאו משאבים זמינים
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleAddIntegration} 
                disabled={isAdding || !selectedResource}
                className="flex-1"
              >
                {isAdding ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                הוסף חיבור
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                ביטול
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

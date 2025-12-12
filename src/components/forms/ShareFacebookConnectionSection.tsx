import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Share2, Loader2, CheckCircle2 } from "lucide-react";

interface ShareFacebookConnectionSectionProps {
  integrationId: string;
  currentTenantId: string;
}

export function ShareFacebookConnectionSection({ 
  integrationId, 
  currentTenantId 
}: ShareFacebookConnectionSectionProps) {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);

  // Fetch all tenants the user belongs to (except current)
  const { data: userTenants, isLoading: loadingTenants } = useQuery({
    queryKey: ['user-all-tenants-for-sharing', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('tenant_users')
        .select(`
          tenant_id,
          role,
          tenants:tenant_id (
            id,
            name,
            slug
          )
        `)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      // Filter out current tenant and flatten
      return (data || [])
        .filter(tu => tu.tenant_id !== currentTenantId && tu.tenants)
        .map(tu => ({
          id: (tu.tenants as any).id,
          name: (tu.tenants as any).name,
          slug: (tu.tenants as any).slug,
        }));
    },
    enabled: !!user?.id && !!currentTenantId,
  });

  // Fetch existing shares for this integration
  const { data: existingShares, isLoading: loadingShares } = useQuery({
    queryKey: ['facebook-integration-shares', integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('tenant_id')
        .eq('shared_from_integration_id', integrationId)
        .eq('is_active', true);
      
      if (error) throw error;
      return data?.map(d => d.tenant_id) || [];
    },
    enabled: !!integrationId,
  });

  // Initialize selected tenants from existing shares
  useEffect(() => {
    if (existingShares) {
      setSelectedTenants(existingShares);
    }
  }, [existingShares]);

  // Save shares mutation
  const saveSharesMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not found');

      // Get current shares
      const currentShares = existingShares || [];
      
      // Find tenants to add
      const toAdd = selectedTenants.filter(t => !currentShares.includes(t));
      
      // Find tenants to remove
      const toRemove = currentShares.filter(t => !selectedTenants.includes(t));

      // Add new shares
      for (const tenantId of toAdd) {
        await supabase.from('tenant_integrations').insert({
          tenant_id: tenantId,
          user_id: user.id,
          integration_type: 'facebook_lead_ads',
          is_active: true,
          shared_from_integration_id: integrationId,
          settings: { shared: true },
        });
      }

      // Remove old shares
      for (const tenantId of toRemove) {
        await supabase
          .from('tenant_integrations')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('shared_from_integration_id', integrationId);
      }
    },
    onSuccess: () => {
      toast.success('השיתופים נשמרו בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['facebook-integration-shares'] });
    },
    onError: (error) => {
      toast.error('שגיאה בשמירת השיתופים: ' + (error as Error).message);
    },
  });

  const handleToggleTenant = (tenantId: string) => {
    setSelectedTenants(prev => 
      prev.includes(tenantId) 
        ? prev.filter(t => t !== tenantId)
        : [...prev, tenantId]
    );
  };

  const hasChanges = () => {
    const current = existingShares || [];
    if (current.length !== selectedTenants.length) return true;
    return !current.every(t => selectedTenants.includes(t));
  };

  if (loadingTenants || loadingShares) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!userTenants || userTenants.length === 0) {
    return null; // No other tenants to share with
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-row-reverse justify-end text-right">
          <Share2 className="h-5 w-5" />
          שתף חיבור עם ארגונים אחרים
        </CardTitle>
        <CardDescription className="text-right">
          בחר ארגונים נוספים שיוכלו להשתמש בחיבור Facebook שלך לקבלת לידים
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {userTenants.map((tenant) => (
            <div 
              key={tenant.id} 
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors flex-row-reverse"
            >
              <Checkbox
                id={`share-${tenant.id}`}
                checked={selectedTenants.includes(tenant.id)}
                onCheckedChange={() => handleToggleTenant(tenant.id)}
              />
              <Label 
                htmlFor={`share-${tenant.id}`} 
                className="flex-1 cursor-pointer text-right"
              >
                {tenant.name}
              </Label>
              {selectedTenants.includes(tenant.id) && (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  משותף
                </Badge>
              )}
            </div>
          ))}
        </div>

        <Button
          onClick={() => saveSharesMutation.mutate()}
          disabled={!hasChanges() || saveSharesMutation.isPending}
          className="w-full gap-2"
        >
          {saveSharesMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              שומר...
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" />
              שמור שיתופים
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

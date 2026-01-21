import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Building2, Loader2 } from "lucide-react";

interface ShareIntegrationTenantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string;
  integrationName: string;
}

export function ShareIntegrationTenantsDialog({
  open,
  onOpenChange,
  integrationId,
  integrationName,
}: ShareIntegrationTenantsDialogProps) {
  const { tenantId } = useCurrentTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});

  // Fetch all available tenants (excluding current)
  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['all-tenants-for-sharing', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, slug')
        .neq('id', tenantId)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!tenantId,
  });

  // Fetch current access
  const { data: currentAccess = [], isLoading: accessLoading } = useQuery({
    queryKey: ['integration-tenant-access', integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_tenant_access')
        .select('accessing_tenant_id')
        .eq('integration_id', integrationId);

      if (error) throw error;
      return data?.map(a => a.accessing_tenant_id) || [];
    },
    enabled: open && !!integrationId,
  });

  // Toggle access mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ tenantIdToToggle, grant }: { tenantIdToToggle: string; grant: boolean }) => {
      if (grant) {
        const { error } = await supabase
          .from('integration_tenant_access')
          .insert({
            integration_id: integrationId,
            accessing_tenant_id: tenantIdToToggle,
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('integration_tenant_access')
          .delete()
          .eq('integration_id', integrationId)
          .eq('accessing_tenant_id', tenantIdToToggle);
        if (error) throw error;
      }
    },
    onSuccess: (_, { tenantIdToToggle, grant }) => {
      queryClient.invalidateQueries({ queryKey: ['integration-tenant-access', integrationId] });
      setPendingChanges(prev => {
        const next = { ...prev };
        delete next[tenantIdToToggle];
        return next;
      });
      toast({
        title: grant ? "גישה ניתנה" : "גישה הוסרה",
        description: grant 
          ? "הארגון יכול כעת לראות הודעות מאינטגרציה זו"
          : "הגישה לאינטגרציה הוסרה מהארגון",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "שגיאה בעדכון הרשאות",
        description: error.message,
      });
    },
  });

  const handleToggle = (targetTenantId: string) => {
    const currentlyHasAccess = currentAccess.includes(targetTenantId);
    const isPending = pendingChanges[targetTenantId] !== undefined 
      ? pendingChanges[targetTenantId] 
      : currentlyHasAccess;
    
    const newState = !isPending;
    setPendingChanges(prev => ({ ...prev, [targetTenantId]: newState }));
    
    toggleMutation.mutate({
      tenantIdToToggle: targetTenantId,
      grant: newState,
    });
  };

  const isChecked = (targetTenantId: string) => {
    if (pendingChanges[targetTenantId] !== undefined) {
      return pendingChanges[targetTenantId];
    }
    return currentAccess.includes(targetTenantId);
  };

  const isLoading = tenantsLoading || accessLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            שיתוף אינטגרציה בין ארגונים
          </DialogTitle>
          <DialogDescription>
            בחר אילו ארגונים יוכלו לראות הודעות מהאינטגרציה: {integrationName}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {tenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isChecked(tenant.id)}
                      onCheckedChange={() => handleToggle(tenant.id)}
                      disabled={toggleMutation.isPending && pendingChanges[tenant.id] !== undefined}
                    />
                    <div>
                      <p className="font-medium">{tenant.name}</p>
                      <p className="text-xs text-muted-foreground">/{tenant.slug}</p>
                    </div>
                  </div>
                  {isChecked(tenant.id) && (
                    <Badge variant="secondary">משותף</Badge>
                  )}
                </div>
              ))}
              
              {tenants.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  אין ארגונים נוספים לשיתוף
                </p>
              )}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            סגור
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

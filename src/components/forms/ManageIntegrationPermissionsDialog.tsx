import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIntegrationPermissions } from "@/hooks/useIntegrationPermissions";
import { Users, Shield } from "lucide-react";

interface ManageIntegrationPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string;
  integrationName: string;
  integrationOwnerId?: string | null;
}

export function ManageIntegrationPermissionsDialog({
  open,
  onOpenChange,
  integrationId,
  integrationName,
  integrationOwnerId,
}: ManageIntegrationPermissionsDialogProps) {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const { permissions, grantPermission, revokePermission } = useIntegrationPermissions(integrationId);

  // Fetch all users in the tenant using tenant_users table
  const { data: tenantUsers, isLoading, error: usersError } = useQuery({
    queryKey: ['tenant-users', tenantId, open],
    queryFn: async () => {
      if (!tenantId) {
        console.log('No tenantId available');
        return [];
      }
      
      console.log('Fetching users for tenant:', tenantId);
      
      const { data, error } = await supabase
        .from('tenant_users')
        .select(`
          user_id,
          role,
          profiles:user_id (
            id,
            full_name,
            email
          )
        `)
        .eq('tenant_id', tenantId);
      
      if (error) {
        console.error('Error fetching tenant users:', error);
        throw error;
      }
      
      console.log('Fetched users:', data);
      
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  const hasPermission = (userId: string) => {
    return permissions?.some(p => p.user_id === userId);
  };

  const isOwner = (userId: string) => {
    return userId === integrationOwnerId;
  };

  const handleTogglePermission = async (targetUserId: string) => {
    if (hasPermission(targetUserId)) {
      await revokePermission.mutateAsync({ userId: targetUserId });
    } else {
      await grantPermission.mutateAsync({ userId: targetUserId });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            ניהול הרשאות - {integrationName}
          </DialogTitle>
          <DialogDescription>
            בחר משתמשים שיוכלו להשתמש באינטגרציה זו
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              טוען משתמשים...
            </div>
          ) : usersError ? (
            <div className="text-center py-8 text-destructive">
              שגיאה בטעינת משתמשים: {usersError.message}
            </div>
          ) : tenantUsers && tenantUsers.length > 0 ? (
            <div className="space-y-2">
              {tenantUsers.map((tenantUser) => {
                const profile = tenantUser.profiles as any;
                const isCurrentOwner = isOwner(tenantUser.user_id);
                const hasAccess = hasPermission(tenantUser.user_id);
                const isCurrentUser = tenantUser.user_id === userId;
                
                return (
                  <div
                    key={tenantUser.user_id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Checkbox
                        checked={isCurrentOwner || hasAccess}
                        disabled={isCurrentOwner || grantPermission.isPending || revokePermission.isPending}
                        onCheckedChange={() => handleTogglePermission(tenantUser.user_id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {profile?.full_name || 'ללא שם'}
                          </span>
                          {isCurrentUser && (
                            <Badge variant="secondary" className="text-xs">
                              אתה
                            </Badge>
                          )}
                          {isCurrentOwner && (
                            <Badge variant="default" className="text-xs">
                              בעלים
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {profile?.email}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>אין משתמשים נוספים בארגון</p>
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            סגור
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
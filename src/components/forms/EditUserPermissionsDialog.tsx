import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { MAIN_MODULES, SALES_MODULES, SETTINGS_MODULES, SPECIAL_PERMISSIONS } from "@/lib/modules";

interface EditUserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
}

export function EditUserPermissionsDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
}: EditUserPermissionsDialogProps) {
  const queryClient = useQueryClient();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const { tenantId } = useCurrentTenant();

  // Check if user is owner in current tenant
  const { data: isOwnerInTenant } = useQuery({
    queryKey: ["user-is-owner", userId, tenantId],
    queryFn: async () => {
      if (!userId || !tenantId) return false;
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "owner");

      if (error) throw error;
      
      // Check if user is owner AND is part of current tenant
      if (!data || data.length === 0) return false;
      
      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("id")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      
      return !!tenantUser;
    },
    enabled: open && !!userId && !!tenantId,
  });

  // Fetch current user's permissions
  const { data: currentPermissions } = useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("module, can_access")
        .eq("user_id", userId);

      if (error) throw error;

      const permissionsMap: Record<string, boolean> = {};
      
      // If user is owner in current tenant, set all permissions to true by default
      if (isOwnerInTenant) {
        [...MAIN_MODULES, ...SALES_MODULES, ...SETTINGS_MODULES, ...SPECIAL_PERMISSIONS].forEach(module => {
          permissionsMap[module.id] = true;
        });
      } else {
        // Set all modules to true by default
        [...MAIN_MODULES, ...SETTINGS_MODULES, ...SPECIAL_PERMISSIONS].forEach(module => {
          permissionsMap[module.id] = true;
        });
        
        // Set sales modules to false by default
        SALES_MODULES.forEach(module => {
          permissionsMap[module.id] = false;
        });
      }

      // Override with actual values from database (only for current tenant)
      data?.forEach((perm) => {
        permissionsMap[perm.module] = perm.can_access;
      });

      return permissionsMap;
    },
    enabled: open && !!userId,
  });

  useEffect(() => {
    if (currentPermissions) {
      setPermissions(currentPermissions);
    }
  }, [currentPermissions, isOwnerInTenant]);

  const updatePermissionsMutation = useMutation({
    mutationFn: async (perms: Record<string, boolean>) => {
      // Delete existing permissions
      await supabase
        .from("user_permissions")
        .delete()
        .eq("user_id", userId);

      // Insert new permissions
      const permissionsToInsert = Object.entries(perms).map(([module, canAccess]) => ({
        user_id: userId,
        module,
        can_access: canAccess,
      }));

      const { error } = await supabase
        .from("user_permissions")
        .insert(permissionsToInsert);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
      toast.success("ההרשאות עודכנו בהצלחה");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("שגיאה בעדכון הרשאות: " + error.message);
    },
  });

  const handleSave = () => {
    updatePermissionsMutation.mutate(permissions);
  };

  const togglePermission = (moduleId: string) => {
    setPermissions(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>הרשאות משתמש</DialogTitle>
          <DialogDescription>
            ניהול הרשאות גישה למודולים עבור: {userEmail}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">מודולים כלליים</h3>
            <div className="space-y-3">
              {MAIN_MODULES.map((module) => (
                <div key={module.id} className="flex items-start space-x-3 space-x-reverse">
                  <Checkbox
                    id={`module-${module.id}`}
                    checked={permissions[module.id] ?? true}
                    onCheckedChange={() => togglePermission(module.id)}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor={`module-${module.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {module.label}
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {module.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3">מודולי מכירות</h3>
            <p className="text-sm text-muted-foreground mb-3">
              ברירת מחדל: ללא גישה למודולי מכירות
            </p>
            <div className="space-y-3">
              {SALES_MODULES.map((module) => (
                <div key={module.id} className="flex items-start space-x-3 space-x-reverse">
                  <Checkbox
                    id={`sales-${module.id}`}
                    checked={permissions[module.id] ?? false}
                    onCheckedChange={() => togglePermission(module.id)}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor={`sales-${module.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {module.label}
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {module.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3">הגדרות ואינטגרציות</h3>
            <div className="space-y-3">
              {SETTINGS_MODULES.map((module) => (
                <div key={module.id} className="flex items-start space-x-3 space-x-reverse">
                  <Checkbox
                    id={`settings-${module.id}`}
                    checked={permissions[module.id] ?? false}
                    onCheckedChange={() => togglePermission(module.id)}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor={`settings-${module.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {module.label}
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {module.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3">הרשאות מיוחדות</h3>
            <div className="space-y-3">
              {SPECIAL_PERMISSIONS.map((perm) => (
                <div key={perm.id} className="flex items-start space-x-3 space-x-reverse">
                  <Checkbox
                    id={`perm-${perm.id}`}
                    checked={permissions[perm.id] ?? true}
                    onCheckedChange={() => togglePermission(perm.id)}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor={`perm-${perm.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {perm.label}
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {perm.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={updatePermissionsMutation.isPending}
              className="flex-1"
            >
              {updatePermissionsMutation.isPending ? "שומר..." : "שמור שינויים"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updatePermissionsMutation.isPending}
            >
              ביטול
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { getAllModules } from "@/lib/modules";
import { PermissionsSelector } from "@/components/forms/PermissionsSelector";

// ─── Props ──────────────────────────────────────────────────────────────────
interface EditUserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function EditUserPermissionsDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
}: EditUserPermissionsDialogProps) {
  const queryClient = useQueryClient();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const { tenantId } = useCurrentTenant();

  // כל המודולים (שטוח) – לאתחול ברירת מחדל
  const allModules = getAllModules();

  // בדיקה אם המשתמש הוא בעלים בטנאנט הנוכחי
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

  // טעינת הרשאות קיימות
  const { data: currentPermissions } = useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("module, can_access")
        .eq("user_id", userId);

      if (error) throw error;

      // ברירת מחדל: כל המודולים כבויים
      const permissionsMap: Record<string, boolean> = {};
      allModules.forEach(module => {
        permissionsMap[module.id] = isOwnerInTenant ? true : false;
      });

      // דריסה עם הערכים מה-DB
      data?.forEach(perm => {
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

  // שמירת הרשאות
  const updatePermissionsMutation = useMutation({
    mutationFn: async (perms: Record<string, boolean>) => {
      await supabase
        .from("user_permissions")
        .delete()
        .eq("user_id", userId);

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

  // ספירת הרשאות פעילות
  const activeCount = Object.values(permissions).filter(Boolean).length;
  const totalCount = allModules.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">הרשאות משתמש</DialogTitle>
          <DialogDescription className="flex items-center justify-between">
            <span>ניהול הרשאות גישה למודולים עבור: <strong>{userEmail}</strong></span>
            <Badge variant="secondary" className="mr-2 text-xs">
              {activeCount} / {totalCount} מודולים פעילים
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <PermissionsSelector
            value={permissions}
            onChange={setPermissions}
            idPrefix="edit-perms"
          />
        </div>

        {/* כפתורי פעולה */}
        <div className="flex gap-2 pt-2 border-t sticky bottom-0 bg-background pb-1">
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
      </DialogContent>
    </Dialog>
  );
}

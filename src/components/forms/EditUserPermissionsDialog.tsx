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

  const togglePermission = (moduleId: string) => {
    setPermissions(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  // בחירת/ביטול כל הקטגוריה
  const toggleCategory = (categoryId: string, value: boolean) => {
    const cat = PERMISSION_CATEGORIES.find(c => c.id === categoryId);
    if (!cat) return;
    setPermissions(prev => {
      const next = { ...prev };
      cat.modules.forEach(m => { next[m.id] = value; });
      return next;
    });
  };

  // האם כל הקטגוריה מסומנת
  const isCategoryFullyChecked = (categoryId: string): boolean => {
    const cat = PERMISSION_CATEGORIES.find(c => c.id === categoryId);
    if (!cat) return false;
    return cat.modules.every(m => permissions[m.id] === true);
  };

  // האם חלק מהקטגוריה מסומן
  const isCategoryPartiallyChecked = (categoryId: string): boolean => {
    const cat = PERMISSION_CATEGORIES.find(c => c.id === categoryId);
    if (!cat) return false;
    const checked = cat.modules.filter(m => permissions[m.id] === true).length;
    return checked > 0 && checked < cat.modules.length;
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

        <div className="space-y-4 py-2">
          {PERMISSION_CATEGORIES.map((category) => {
            const fullyChecked = isCategoryFullyChecked(category.id);
            const partiallyChecked = isCategoryPartiallyChecked(category.id);
            const colorClass = CATEGORY_COLORS[category.id] ?? "bg-gray-100 text-gray-800";
            const icon = CATEGORY_ICONS[category.id];
            const categoryActiveCount = category.modules.filter(m => permissions[m.id]).length;

            return (
              <div
                key={category.id}
                className="rounded-lg border bg-card overflow-hidden"
              >
                {/* כותרת קטגוריה */}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
                  <div className="flex items-center gap-2">
                    {/* Checkbox לבחירת כל הקטגוריה */}
                    <Checkbox
                      id={`cat-${category.id}`}
                      checked={fullyChecked}
                      data-state={partiallyChecked ? "indeterminate" : undefined}
                      className={partiallyChecked ? "opacity-70" : ""}
                      onCheckedChange={(checked) =>
                        toggleCategory(category.id, !!checked)
                      }
                    />
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
                      {icon}
                      {category.label}
                    </span>
                    {category.description && (
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {category.description}
                      </span>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {categoryActiveCount}/{category.modules.length}
                  </Badge>
                </div>

                {/* מודולים */}
                <div className="divide-y">
                  {category.modules.map((module) => (
                    <div
                      key={module.id}
                      className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
                    >
                      <Checkbox
                        id={`module-${module.id}`}
                        checked={permissions[module.id] ?? false}
                        onCheckedChange={() => togglePermission(module.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <label
                          htmlFor={`module-${module.id}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {module.label}
                        </label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {module.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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

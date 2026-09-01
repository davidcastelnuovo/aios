import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMMAND_CENTER_PERMISSION_MODULES,
  COMMAND_CENTER_TIER_DESCRIPTIONS,
  COMMAND_CENTER_TIER_LABELS,
  permissionRowsForTier,
  tierFromPermissionMap,
  type CommandCenterAccessTier,
} from "@/lib/commandCenterAccess";

type TenantUserRow = {
  user_id: string;
  email: string;
  full_name: string | null;
};

interface CommandCenterSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIER_OPTIONS: Array<{ value: CommandCenterAccessTier | "none"; label: string }> = [
  { value: "none", label: "ללא גישה (ברירת מחדל)" },
  { value: "full", label: COMMAND_CENTER_TIER_LABELS.full },
  { value: "sidecar", label: COMMAND_CENTER_TIER_LABELS.sidecar },
  { value: "bugfix", label: COMMAND_CENTER_TIER_LABELS.bugfix },
];

export function CommandCenterSettingsDialog({
  open,
  onOpenChange,
}: CommandCenterSettingsDialogProps) {
  const { tenantId } = useCurrentTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, CommandCenterAccessTier | "none">>({});

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["cc-settings-users", tenantId],
    enabled: open && !!tenantId,
    queryFn: async () => {
      const { data: tenantUsers, error: tuErr } = await supabase
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenantId!);
      if (tuErr) throw tuErr;
      const ids = (tenantUsers ?? []).map((r) => r.user_id);
      if (!ids.length) return [] as TenantUserRow[];

      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", ids)
        .order("full_name");
      if (pErr) throw pErr;

      return (profiles ?? []).map((p) => ({
        user_id: p.id,
        email: p.email ?? "",
        full_name: p.full_name,
      }));
    },
  });

  const { data: permissionMap = {} } = useQuery({
    queryKey: ["cc-settings-perms", tenantId, users.map((u) => u.user_id).join(",")],
    enabled: open && users.length > 0,
    queryFn: async () => {
      const ids = users.map((u) => u.user_id);
      const { data, error } = await supabase
        .from("user_permissions")
        .select("user_id, module, can_access")
        .in("user_id", ids)
        .in("module", Object.values(COMMAND_CENTER_PERMISSION_MODULES));
      if (error) throw error;

      const map: Record<string, CommandCenterAccessTier | "none"> = {};
      for (const u of users) {
        const rows = (data ?? []).filter((r) => r.user_id === u.user_id);
        const perms: Record<string, boolean> = {};
        rows.forEach((r) => { perms[r.module] = r.can_access; });
        map[u.user_id] = tierFromPermissionMap(perms) ?? "none";
      }
      return map;
    },
  });

  useEffect(() => {
    if (permissionMap) setDraft(permissionMap);
  }, [permissionMap]);

  const saveMutation = useMutation({
    mutationFn: async (next: Record<string, CommandCenterAccessTier | "none">) => {
      for (const [userId, tier] of Object.entries(next)) {
        await supabase
          .from("user_permissions")
          .delete()
          .eq("user_id", userId)
          .in("module", Object.values(COMMAND_CENTER_PERMISSION_MODULES));

        if (tier !== "none") {
          const rows = permissionRowsForTier(tier).map((r) => ({
            user_id: userId,
            module: r.module,
            can_access: r.can_access,
          }));
          const { error } = await supabase.from("user_permissions").insert(rows);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cc-settings-perms"] });
      queryClient.invalidateQueries({ queryKey: ["command-center-access"] });
      queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
      toast({ title: "נשמר", description: "הרשאות מרכז הבקרה עודכנו" });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>הגדרות מרכז בקרה — הרשאות משתמשים</DialogTitle>
          <DialogDescription>
            שלוש רמות: גישה מלאה, סיידבר בלבד, או תיקוני באגים ל-Cursor בלבד.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">טוען משתמשים…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין משתמשים בטנאנט.</p>
        ) : (
          <div className="space-y-4 py-2">
            {users.map((u) => {
              const tier = draft[u.user_id] ?? "none";
              return (
                <div key={u.user_id} className="rounded-lg border p-3 space-y-2">
                  <div>
                    <p className="text-sm font-medium">{u.full_name || u.email}</p>
                    {u.full_name && (
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`cc-tier-${u.user_id}`} className="text-xs">
                      רמת גישה
                    </Label>
                    <Select
                      value={tier}
                      onValueChange={(v) =>
                        setDraft((prev) => ({
                          ...prev,
                          [u.user_id]: v as CommandCenterAccessTier | "none",
                        }))
                      }
                    >
                      <SelectTrigger id={`cc-tier-${u.user_id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIER_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {tier !== "none" && (
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {COMMAND_CENTER_TIER_DESCRIPTIONS[tier]}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t">
          <Button
            className="flex-1"
            disabled={saveMutation.isPending || isLoading}
            onClick={() => saveMutation.mutate(draft)}
          >
            {saveMutation.isPending ? "שומר…" : "שמור"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CommandCenterSettingsButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        title="הגדרות הרשאות מרכז בקרה"
        onClick={() => setOpen(true)}
        className={className}
      >
        <Settings className="h-4 w-4" />
      </button>
      <CommandCenterSettingsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

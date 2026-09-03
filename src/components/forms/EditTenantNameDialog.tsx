import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isValidTenantSlug,
  normalizeTenantSlugInput,
  tenantSlugValidationMessage,
} from "@/lib/tenantSlug";

interface EditTenantNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: {
    id: string;
    name: string;
    slug?: string | null;
  } | null;
}

export function EditTenantNameDialog({
  open,
  onOpenChange,
  tenant,
}: EditTenantNameDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentTenantId } = useTenant();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (tenant && open) {
      setName(tenant.name);
      setSlug(tenant.slug || "");
    }
  }, [tenant, open]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!tenant) return;

      const trimmedName = name.trim();
      const normalizedSlug = normalizeTenantSlugInput(slug);
      const slugError = tenantSlugValidationMessage(normalizedSlug);
      if (!trimmedName) throw new Error("יש להזין שם ארגון");
      if (slugError) throw new Error(slugError);

      if (normalizedSlug !== (tenant.slug || "")) {
        const { data: existing } = await supabase
          .from("tenants")
          .select("id")
          .eq("slug", normalizedSlug)
          .neq("id", tenant.id)
          .maybeSingle();

        if (existing) throw new Error("הסלאג הזה כבר תפוס — בחר אחר");
      }

      const { error } = await supabase
        .from("tenants")
        .update({ name: trimmedName, slug: normalizedSlug })
        .eq("id", tenant.id);

      if (error) {
        if (error.code === "23505") throw new Error("הסלאג הזה כבר תפוס — בחר אחר");
        throw error;
      }

      return { normalizedSlug };
    },
    onSuccess: (result) => {
      toast({
        title: "הצלחה",
        description: "פרטי הארגון עודכנו בהצלחה",
      });
      queryClient.invalidateQueries({ queryKey: ["user-tenants"] });
      queryClient.invalidateQueries({ queryKey: ["current-tenant"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-by-slug"] });
      onOpenChange(false);

      const newSlug = result?.normalizedSlug;
      if (
        tenant &&
        newSlug &&
        newSlug !== tenant.slug &&
        currentTenantId === tenant.id
      ) {
        const { pathname, search, hash } = window.location;
        const oldPrefix = `/t/${tenant.slug}`;
        const newPrefix = `/t/${newSlug}`;
        const nextPath = pathname.startsWith(oldPrefix)
          ? `${newPrefix}${pathname.slice(oldPrefix.length)}`
          : `/t/${newSlug}/tenants`;
        window.location.href = `${nextPath}${search}${hash}`;
      }
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה בעדכון הארגון",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  const previewSlug = normalizeTenantSlugInput(slug);
  const slugIsValid = isValidTenantSlug(previewSlug);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>עריכת ארגון</DialogTitle>
          <DialogDescription>
            עדכן את שם הארגון ואת הסלאג שמופיע בכתובת
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">שם הארגון</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="הזן שם ארגון"
                dir="rtl"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="slug">סלאג (מזהה URL)</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(normalizeTenantSlugInput(e.target.value))}
                placeholder="my-organization"
                dir="ltr"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground" dir="ltr">
                {slugIsValid
                  ? `/t/${previewSlug}/...`
                  : "3-64 chars: a-z, 0-9, - or _"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

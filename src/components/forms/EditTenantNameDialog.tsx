import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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

interface EditTenantNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: {
    id: string;
    name: string;
  } | null;
}

export function EditTenantNameDialog({
  open,
  onOpenChange,
  tenant,
}: EditTenantNameDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  // Reset name when tenant changes or dialog opens
  useEffect(() => {
    if (tenant && open) {
      setName(tenant.name);
    }
  }, [tenant, open]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!tenant) return;

      const { error } = await supabase
        .from("tenants")
        .update({ name: name.trim() })
        .eq("id", tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "הצלחה",
        description: "שם הארגון עודכן בהצלחה",
      });
      queryClient.invalidateQueries({ queryKey: ["user-tenants"] });
      queryClient.invalidateQueries({ queryKey: ["current-tenant"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה בעדכון שם הארגון",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "שגיאה",
        description: "יש להזין שם ארגון",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>עריכת שם ארגון</DialogTitle>
          <DialogDescription>
            שנה את שם הארגון "{tenant?.name}"
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

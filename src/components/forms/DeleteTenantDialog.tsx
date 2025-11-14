import { useState } from "react";
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
import { AlertTriangle } from "lucide-react";

interface DeleteTenantDialogProps {
  tenant: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteTenantDialog({ tenant, open, onOpenChange }: DeleteTenantDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState("");

  const deleteMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('לא מחובר למערכת');

      const response = await supabase.functions.invoke('delete-tenant', {
        body: { tenant_id: tenantId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-tenants"] });
      toast({
        title: "הארגון נמחק בהצלחה",
        description: "כל הנתונים הקשורים לארגון נמחקו",
      });
      onOpenChange(false);
      setConfirmText("");
    },
    onError: (error: Error) => {
      toast({
        title: "שגיאה במחיקת הארגון",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (tenant && confirmText === tenant.name) {
      deleteMutation.mutate(tenant.id);
    }
  };

  const isConfirmed = confirmText === tenant?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            מחיקת ארגון
          </DialogTitle>
          <DialogDescription className="space-y-2 pt-2">
            <p className="font-semibold">פעולה זו תמחק לצמיתות:</p>
            <ul className="list-disc pr-5 space-y-1 text-sm">
              <li>את כל הסוכנויות והלקוחות</li>
              <li>את כל המשימות והלידים</li>
              <li>את כל הקמפיינרים והאנשי מכירות</li>
              <li>את כל הנתונים הפיננסיים</li>
              <li>את כל המשתמשים והרשאותיהם</li>
            </ul>
            <p className="text-destructive font-semibold pt-2">
              פעולה זו אינה ניתנת לביטול!
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Label htmlFor="confirm">
              הקלד את שם הארגון <span className="font-bold">"{tenant?.name}"</span> לאישור המחיקה:
            </Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={tenant?.name}
              className="mt-2"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setConfirmText("");
            }}
          >
            ביטול
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "מוחק..." : "מחק ארגון"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

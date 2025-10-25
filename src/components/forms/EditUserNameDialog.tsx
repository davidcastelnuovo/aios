import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface EditUserNameDialogProps {
  userId: string | null;
  userEmail: string;
  currentFullName: string | null;
  onClose: () => void;
}

export function EditUserNameDialog({
  userId,
  userEmail,
  currentFullName,
  onClose,
}: EditUserNameDialogProps) {
  const [fullName, setFullName] = useState(currentFullName || "");
  const queryClient = useQueryClient();

  useEffect(() => {
    setFullName(currentFullName || "");
  }, [currentFullName]);

  const updateNameMutation = useMutation({
    mutationFn: async (newFullName: string) => {
      if (!userId) throw new Error("User ID is required");

      const { error } = await supabase
        .from("profiles")
        .update({ full_name: newFullName })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("השם עודכן בהצלחה");
      onClose();
    },
    onError: (error: Error) => {
      toast.error("שגיאה בעדכון שם: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateNameMutation.mutate(fullName);
  };

  return (
    <Dialog open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ערוך שם משתמש</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="user-email">אימייל</Label>
            <Input
              id="user-email"
              value={userEmail}
              disabled
              className="bg-muted"
            />
          </div>
          <div>
            <Label htmlFor="full-name">שם מלא</Label>
            <Input
              id="full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="הזן שם מלא"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={updateNameMutation.isPending}
              className="flex-1"
            >
              {updateNameMutation.isPending ? "שומר..." : "שמור"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              ביטול
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

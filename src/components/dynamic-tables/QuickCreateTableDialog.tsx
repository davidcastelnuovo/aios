import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenantPath } from "@/hooks/useTenantPath";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface QuickCreateTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickCreateTableDialog({ open, onOpenChange }: QuickCreateTableDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const [name, setName] = useState("");

  const createMutation = useMutation({
    mutationFn: async (tableName: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Auto-generate slug from name
      const slug = tableName
        .toLowerCase()
        .replace(/[^a-z0-9\u0590-\u05FF]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const response = await supabase.functions.invoke('crm-tables', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { name: tableName, slug, description: "" },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      toast.success('הטבלה נוצרה בהצלחה');
      handleClose();
      // Navigate to the new table
      navigate(buildPath(`table/${data.slug}`));
    },
    onError: (error) => {
      toast.error('שגיאה ביצירת הטבלה: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('נא למלא את שם הטבלה');
      return;
    }

    createMutation.mutate(name);
  };

  const handleClose = () => {
    setName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>טבלה חדשה</DialogTitle>
          <DialogDescription>
            תן שם לטבלה החדשה שלך
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">שם הטבלה</Label>
            <Input
              id="name"
              placeholder="לדוגמה: פרויקטים"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              ביטול
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "יוצר..." : "צור טבלה"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

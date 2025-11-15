import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";

interface SimpleTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SimpleTableDialog({ open, onOpenChange }: SimpleTableDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const [tableName, setTableName] = useState("");

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const slug = name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-\u0590-\u05FF]/g, '');

      const response = await supabase.functions.invoke('crm-tables', {
        method: 'POST',
        body: { name, slug, description: '' },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      toast.success('הטבלה נוצרה בהצלחה');
      handleClose();
      navigate(buildPath(`/table/${data.slug}`));
    },
    onError: (error: any) => {
      toast.error('שגיאה ביצירת הטבלה: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) {
      toast.error('נא למלא את שם הטבלה');
      return;
    }
    createMutation.mutate(tableName);
  };

  const handleClose = () => {
    setTableName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>טבלה חדשה</DialogTitle>
          <DialogDescription>
            צור טבלה חדשה לניהול נתונים
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="table-name">שם הטבלה</Label>
            <Input
              id="table-name"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="לדוגמה: פרויקטים, משימות..."
              dir="rtl"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              ביטול
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'יוצר...' : 'צור טבלה'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

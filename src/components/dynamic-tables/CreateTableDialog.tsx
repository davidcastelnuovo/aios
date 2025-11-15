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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface CreateTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTableDialog({ open, onOpenChange }: CreateTableDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; slug: string; description: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('crm-tables', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: data,
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      toast.success('הטבלה נוצרה בהצלחה');
      handleClose();
    },
    onError: (error) => {
      toast.error('שגיאה ביצירת הטבלה: ' + error.message);
    },
  });

  const handleNameChange = (value: string) => {
    setName(value);
    // Auto-generate slug from name (simple version)
    const slugValue = value
      .toLowerCase()
      .replace(/[^a-z0-9\u0590-\u05FF]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(slugValue);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !slug.trim()) {
      toast.error('נא למלא את שם הטבלה');
      return;
    }

    createMutation.mutate({ name, slug, description });
  };

  const handleClose = () => {
    setName("");
    setSlug("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>יצירת טבלה חדשה</DialogTitle>
          <DialogDescription>
            צור טבלה דינמית עם שדות מותאמים אישית
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">שם הטבלה *</Label>
            <Input
              id="name"
              placeholder="לדוגמה: פרויקטים"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">מזהה ייחודי (Slug) *</Label>
            <Input
              id="slug"
              placeholder="projects"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              pattern="[a-z0-9\u0590-\u05FF-]+"
            />
            <p className="text-xs text-muted-foreground">
              משמש לזיהוי הטבלה במערכת (אנגלית/עברית, מספרים ומקפים בלבד)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">תיאור</Label>
            <Textarea
              id="description"
              placeholder="תאר את מטרת הטבלה..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
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
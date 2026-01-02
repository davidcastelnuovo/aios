import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Copy } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: {
    id: string;
    name: string;
  };
}

export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  tenant,
}: SaveAsTemplateDialogProps) {
  const queryClient = useQueryClient();
  const { userId } = useCurrentUser();
  const [formData, setFormData] = useState({
    name: `טמפלייט - ${tenant.name}`,
    description: "",
    is_public: false,
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: result, error } = await supabase
        .from("tenant_templates")
        .insert({
          source_tenant_id: tenant.id,
          name: data.name,
          description: data.description || null,
          is_public: data.is_public,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-templates"] });
      toast.success("הטמפלייט נשמר בהצלחה!");
      setFormData({
        name: "",
        description: "",
        is_public: false,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("שגיאה בשמירת הטמפלייט: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveTemplateMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            שמירה כטמפלייט
          </DialogTitle>
          <DialogDescription>
            שמור את הגדרות הארגון "{tenant.name}" כטמפלייט לשימוש בארגונים חדשים.
            <br />
            <span className="text-xs text-muted-foreground">
              יועתקו: שדות מותאמים, תפריטים, טרמינולוגיה, אוטומציות, שלבי Pipeline וסטטוסים.
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
          <div className="space-y-2">
            <Label htmlFor="template-name">שם הטמפלייט *</Label>
            <Input
              id="template-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="שם לטמפלייט"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">תיאור</Label>
            <Textarea
              id="template-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="תיאור קצר של הטמפלייט..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="is-public" className="cursor-pointer">
                טמפלייט ציבורי
              </Label>
              <p className="text-xs text-muted-foreground">
                אפשר לארגונים אחרים להשתמש בטמפלייט זה
              </p>
            </div>
            <Switch
              id="is-public"
              checked={formData.is_public}
              onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saveTemplateMutation.isPending}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={saveTemplateMutation.isPending}>
              {saveTemplateMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  שומר...
                </>
              ) : (
                <>
                  <Copy className="ml-2 h-4 w-4" />
                  שמור טמפלייט
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

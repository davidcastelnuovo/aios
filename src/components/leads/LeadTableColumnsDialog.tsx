import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Columns3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCustomFieldLabels } from "@/hooks/useCustomFieldLabels";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  LEAD_TABLE_COLUMN_FIELDS,
  LEAD_TABLE_TOGGLEABLE_COLUMNS,
  isLeadTableColumnVisible,
} from "@/lib/leadTableColumns";

type StoredField = {
  id: string;
  field_key: string;
};

export function LeadTableColumnsDialog({
  trigger,
}: {
  trigger?: ReactNode;
}) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isFieldVisible, getFieldLabel } = useCustomFieldLabels("lead");
  const [open, setOpen] = useState(false);

  const { data: existingFields = [] } = useQuery({
    queryKey: ["custom-fields", tenantId, "lead"],
    queryFn: async () => {
      if (!tenantId) return [] as StoredField[];
      const { data, error } = await supabase
        .from("custom_fields")
        .select("id, field_key")
        .eq("tenant_id", tenantId)
        .eq("entity_type", "lead");
      if (error) throw error;
      return (data || []) as StoredField[];
    },
    enabled: !!tenantId && open,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ key, visible }: { key: string; visible: boolean }) => {
      if (!tenantId) throw new Error("חסר ארגון");
      const catalog = LEAD_TABLE_COLUMN_FIELDS.find((field) => field.key === key);
      if (!catalog || catalog.required) return;

      const existing = existingFields.find((field) => field.field_key === key);
      if (existing) {
        const { error } = await supabase
          .from("custom_fields")
          .update({ is_visible: visible })
          .eq("id", existing.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("custom_fields").insert({
        tenant_id: tenantId,
        entity_type: "lead",
        field_key: key,
        field_label: catalog.label,
        field_type: catalog.type,
        is_visible: visible,
        is_required: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["custom-field-labels", tenantId] });
    },
    onError: (error: Error) => {
      toast({
        title: "לא ניתן לעדכן עמודות",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" title="עמודות טבלה">
            <Columns3 className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>עמודות טבלת לידים</DialogTitle>
          <DialogDescription>
            ההגדרה היא ברמת הארגון — כל המשתמשים בארגון רואים את אותן עמודות.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {LEAD_TABLE_TOGGLEABLE_COLUMNS.map((field) => {
            const visible = isLeadTableColumnVisible(field.key, isFieldVisible);
            return (
              <div key={field.key} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <Label htmlFor={`lead-col-${field.key}`} className="cursor-pointer">
                  {getFieldLabel(field.key, field.label)}
                </Label>
                <Switch
                  id={`lead-col-${field.key}`}
                  checked={visible}
                  disabled={toggleMutation.isPending}
                  onCheckedChange={(checked) =>
                    toggleMutation.mutate({ key: field.key, visible: checked })
                  }
                />
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface CrmField {
  id: string;
  key: string;
  name: string;
  type: string;
  is_required: boolean;
  is_visible: boolean;
  config: any;
  position: number;
}

interface CrmRecord {
  id: string;
  data: Record<string, any>;
}

interface AddRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableId: string;
  fields: CrmField[];
  editingRecord?: CrmRecord | null;
}

export function AddRecordDialog({
  open,
  onOpenChange,
  tableId,
  fields,
  editingRecord,
}: AddRecordDialogProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm({
    defaultValues: editingRecord?.data || {},
  });

  const mutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("crm-records", {
        method: editingRecord ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: editingRecord
          ? { record_id: editingRecord.id, data }
          : { table_id: tableId, data },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-records", tableId] });
      toast.success(editingRecord ? "הרשומה עודכנה בהצלחה" : "הרשומה נוספה בהצלחה");
      reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`שגיאה: ${error.message}`);
    },
  });

  const onSubmit = (data: Record<string, any>) => {
    // Filter out empty values and convert types
    const cleanedData: Record<string, any> = {};
    
    fields.forEach(field => {
      const value = data[field.key];
      
      if (value === "" || value === null || value === undefined) {
        if (field.is_required) {
          return; // Will be caught by form validation
        }
        return; // Skip empty optional fields
      }

      switch (field.type) {
        case "number":
          cleanedData[field.key] = parseFloat(value);
          break;
        case "date":
          cleanedData[field.key] = value;
          break;
        default:
          cleanedData[field.key] = value;
      }
    });

    mutation.mutate(cleanedData);
  };

  const renderField = (field: CrmField) => {
    const value = watch(field.key);

    switch (field.type) {
      case "textarea":
        return (
          <Textarea
            {...register(field.key, { required: field.is_required })}
            placeholder={`הזן ${field.name}`}
            className="resize-none"
            rows={3}
          />
        );

      case "number":
        return (
          <Input
            type="number"
            step="any"
            {...register(field.key, { 
              required: field.is_required,
              valueAsNumber: true,
            })}
            placeholder={`הזן ${field.name}`}
          />
        );

      case "date":
        return (
          <Input
            type="date"
            {...register(field.key, { required: field.is_required })}
          />
        );

      case "email":
        return (
          <Input
            type="email"
            {...register(field.key, { 
              required: field.is_required,
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "כתובת אימייל לא תקינה"
              }
            })}
            placeholder={`הזן ${field.name}`}
          />
        );

      case "url":
        return (
          <Input
            type="url"
            {...register(field.key, { 
              required: field.is_required,
              pattern: {
                value: /^https?:\/\/.+/,
                message: "כתובת URL לא תקינה"
              }
            })}
            placeholder="https://example.com"
          />
        );

      case "single_select":
        const options = field.config?.options || [];
        return (
          <Select
            value={value || ""}
            onValueChange={(val) => setValue(field.key, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder={`בחר ${field.name}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option: string) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      default:
        return (
          <Input
            {...register(field.key, { required: field.is_required })}
            placeholder={`הזן ${field.name}`}
          />
        );
    }
  };

  // Sort fields by position
  const sortedFields = [...fields].sort((a, b) => a.position - b.position);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRecord ? "עריכת רשומה" : "הוספת רשומה חדשה"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {sortedFields.map(field => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.key}>
                {field.name}
                {field.is_required && <span className="text-destructive mr-1">*</span>}
              </Label>
              {renderField(field)}
              {errors[field.key] && (
                <p className="text-sm text-destructive">
                  {field.is_required ? "שדה חובה" : errors[field.key]?.message as string}
                </p>
              )}
            </div>
          ))}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "שומר..." : editingRecord ? "עדכן" : "הוסף"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { AddFieldDialog } from "./AddFieldDialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CrmTable {
  id: string;
  name: string;
  slug: string;
}

interface CrmField {
  id: string;
  table_id: string;
  name: string;
  key: string;
  type: string;
  position: number;
  is_required: boolean;
  is_visible: boolean;
  config: any;
}

interface ManageFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: CrmTable;
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'טקסט',
  long_text: 'טקסט ארוך',
  number: 'מספר',
  date: 'תאריך',
  datetime: 'תאריך ושעה',
  checkbox: 'תיבת סימון',
  single_select: 'בחירה יחידה',
  multi_select: 'בחירה מרובה',
  reference: 'קישור',
  email: 'אימייל',
  phone: 'טלפון',
  url: 'קישור',
};

export function ManageFieldsDialog({ open, onOpenChange, table }: ManageFieldsDialogProps) {
  const queryClient = useQueryClient();
  const [showAddField, setShowAddField] = useState(false);

  // Fetch fields
  const { data: fields, isLoading } = useQuery({
    queryKey: ['crm-fields', table.id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke(`crm-fields?table_id=${table.id}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      return response.data.fields as CrmField[];
    },
    enabled: open && !!table.id,
  });

  // Delete field mutation
  const deleteMutation = useMutation({
    mutationFn: async (fieldId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke(`crm-fields/${fieldId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-fields', table.id] });
      toast.success('השדה נמחק בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה במחיקת השדה: ' + error.message);
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ניהול שדות - {table.name}</DialogTitle>
            <DialogDescription>
              הוסף, ערוך ומחק שדות בטבלה זו
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Button onClick={() => setShowAddField(true)} className="w-full">
              <Plus className="h-4 w-4 ml-2" />
              הוסף שדה חדש
            </Button>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : fields && fields.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>שם השדה</TableHead>
                      <TableHead>מפתח</TableHead>
                      <TableHead>סוג</TableHead>
                      <TableHead>חובה</TableHead>
                      <TableHead>גלוי</TableHead>
                      <TableHead className="w-24">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field) => (
                      <TableRow key={field.id}>
                        <TableCell>
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell className="font-medium">{field.name}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {field.key}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {FIELD_TYPE_LABELS[field.type] || field.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {field.is_required ? (
                            <Badge variant="destructive">חובה</Badge>
                          ) : (
                            <span className="text-muted-foreground">אופציונלי</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {field.is_visible ? (
                            <Badge variant="outline">גלוי</Badge>
                          ) : (
                            <span className="text-muted-foreground">מוסתר</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(field.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>אין שדות בטבלה זו</p>
                <p className="text-sm mt-1">הוסף שדה ראשון כדי להתחיל</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AddFieldDialog
        open={showAddField}
        onOpenChange={setShowAddField}
        tableId={table.id}
      />
    </>
  );
}
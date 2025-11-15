import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AddRecordDialog } from "./AddRecordDialog";

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
  created_at: string;
  updated_at: string;
}

interface DynamicGridProps {
  tableId: string;
  tableName: string;
  fields: CrmField[];
}

export function DynamicGrid({ tableId, tableName, fields }: DynamicGridProps) {
  const [editingRecord, setEditingRecord] = useState<CrmRecord | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Sort fields by position and filter visible ones
  const visibleFields = fields
    .filter(f => f.is_visible)
    .sort((a, b) => a.position - b.position);

  // Fetch records
  const { data: records, isLoading } = useQuery({
    queryKey: ["crm-records", tableId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("crm-records", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { table_id: tableId },
      });

      if (response.error) throw response.error;
      return response.data as CrmRecord[];
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (recordId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("crm-records", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { record_id: recordId },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-records", tableId] });
      toast.success("הרשומה נמחקה בהצלחה");
    },
    onError: (error: any) => {
      toast.error(`שגיאה במחיקת הרשומה: ${error.message}`);
    },
  });

  const formatCellValue = (field: CrmField, value: any) => {
    if (!value && value !== 0) return "-";

    switch (field.type) {
      case "date":
        return format(new Date(value), "dd/MM/yyyy");
      case "number":
        return value.toLocaleString("he-IL");
      case "single_select":
        return value;
      case "email":
        return <a href={`mailto:${value}`} className="text-primary hover:underline">{value}</a>;
      case "url":
        return <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">קישור</a>;
      case "textarea":
        return <div className="max-w-xs truncate">{value}</div>;
      default:
        return value;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="border rounded-lg">
          <Skeleton className="h-12 w-full" />
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-16 w-full mt-2" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{tableName}</h2>
            <p className="text-sm text-muted-foreground">
              {records?.length || 0} רשומות
            </p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            רשומה חדשה
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleFields.map(field => (
                  <TableHead key={field.id} className="text-right">
                    {field.name}
                    {field.is_required && <span className="text-destructive mr-1">*</span>}
                  </TableHead>
                ))}
                <TableHead className="text-center w-24">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records && records.length > 0 ? (
                records.map(record => (
                  <TableRow key={record.id}>
                    {visibleFields.map(field => (
                      <TableCell key={field.id} className="text-right">
                        {formatCellValue(field, record.data[field.key])}
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingRecord(record)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(record.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={visibleFields.length + 1} className="text-center py-8 text-muted-foreground">
                    אין רשומות עדיין. לחץ על "רשומה חדשה" כדי להוסיף.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AddRecordDialog
        open={isAddDialogOpen || !!editingRecord}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) setEditingRecord(null);
        }}
        tableId={tableId}
        fields={fields}
        editingRecord={editingRecord}
      />
    </>
  );
}

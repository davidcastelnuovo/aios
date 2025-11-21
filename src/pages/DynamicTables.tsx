import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Table2, FileSpreadsheet, Pencil, Trash2 } from "lucide-react";
import { SimpleTableDialog } from "@/components/dynamic-tables/SimpleTableDialog";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface CrmTable {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
}

export default function DynamicTables() {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTable, setEditingTable] = useState<CrmTable | null>(null);
  const [deletingTable, setDeletingTable] = useState<CrmTable | null>(null);
  const [editName, setEditName] = useState("");

  const { data: tables, isLoading } = useQuery({
    queryKey: ['crm-tables'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('crm-tables', {
        method: 'GET',
      });

      if (response.error) throw response.error;
      return response.data as CrmTable[];
    },
  });

  const deleteTableMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await supabase.functions.invoke('crm-tables', {
        method: 'DELETE',
        body: { table_id: tableId },
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      setDeletingTable(null);
      toast.success('הטבלה נמחקה בהצלחה');
    },
    onError: (error: any) => {
      toast.error('שגיאה במחיקת הטבלה: ' + error.message);
    },
  });

  const updateTableMutation = useMutation({
    mutationFn: async ({ tableId, name }: { tableId: string; name: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await supabase.functions.invoke('crm-tables', {
        method: 'PATCH',
        body: { table_id: tableId, name },
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      setEditingTable(null);
      toast.success('הטבלה עודכנה בהצלחה');
    },
    onError: (error: any) => {
      toast.error('שגיאה בעדכון הטבלה: ' + error.message);
    },
  });

  const handleEdit = (table: CrmTable, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTable(table);
    setEditName(table.name);
  };

  const handleDelete = (table: CrmTable, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingTable(table);
  };

  const handleSaveEdit = () => {
    if (!editingTable || !editName.trim()) return;
    updateTableMutation.mutate({ tableId: editingTable.id, name: editName });
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">ניהול טבלאות</h1>
          <p className="text-muted-foreground mt-1">
            צור וערוך טבלאות נתונים עם webhook integration
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="ml-2 h-4 w-4" />
          טבלה חדשה
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : !tables || tables.length === 0 ? (
        <Card className="p-12 text-center">
          <Table2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">אין טבלאות עדיין</h3>
          <p className="text-muted-foreground mb-4">
            צור את הטבלה הראשונה שלך כדי להתחיל
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="ml-2 h-4 w-4" />
            צור טבלה ראשונה
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tables.map((table) => (
            <Card
              key={table.id}
              className="cursor-pointer hover:shadow-lg transition-shadow relative"
              onClick={() => navigate(buildPath(`/table/${table.slug}`))}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    {table.name}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleEdit(table, e)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDelete(table, e)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {table.description && (
                  <CardDescription>{table.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  לחץ לצפייה וניהול
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SimpleTableDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editingTable} onOpenChange={(open) => !open && setEditingTable(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>עריכת טבלה</DialogTitle>
            <DialogDescription>ערוך את שם הטבלה</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="table-name">שם הטבלה</Label>
              <Input
                id="table-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="שם הטבלה"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTable(null)}>
              ביטול
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={updateTableMutation.isPending || !editName.trim()}
            >
              {updateTableMutation.isPending ? 'שומר...' : 'שמור'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingTable} onOpenChange={(open) => !open && setDeletingTable(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>האם למחוק את הטבלה?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק את הטבלה "{deletingTable?.name}" וכל הנתונים שבה. לא ניתן לשחזר את הנתונים לאחר המחיקה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTable && deleteTableMutation.mutate(deletingTable.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

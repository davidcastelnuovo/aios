import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Table2, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CreateTableDialog } from "@/components/dynamic-tables/CreateTableDialog";
import { ManageFieldsDialog } from "@/components/dynamic-tables/ManageFieldsDialog";
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

interface CrmTable {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  created_at: string;
}

export default function DynamicTables() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTable, setSelectedTable] = useState<CrmTable | null>(null);
  const [showFieldsDialog, setShowFieldsDialog] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<CrmTable | null>(null);

  // Fetch tables
  const { data: tables, isLoading } = useQuery({
    queryKey: ['crm-tables', tenantId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('crm-tables', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      return response.data.tables as CrmTable[];
    },
    enabled: !!tenantId,
  });

  // Delete table mutation
  const deleteMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke(`crm-tables/${tableId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      toast.success('הטבלה נמחקה בהצלחה');
      setTableToDelete(null);
    },
    onError: (error) => {
      toast.error('שגיאה במחיקת הטבלה: ' + error.message);
    },
  });

  const handleManageFields = (table: CrmTable) => {
    setSelectedTable(table);
    setShowFieldsDialog(true);
  };

  const handleDeleteTable = (table: CrmTable) => {
    setTableToDelete(table);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">טבלאות דינמיות</h1>
          <p className="text-muted-foreground mt-2">
            נהל טבלאות מותאמות אישית עם שדות דינמיים
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 ml-2" />
          טבלה חדשה
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-full mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-10 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tables && tables.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tables.map((table) => (
            <Card key={table.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Table2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{table.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {table.description || 'אין תיאור'}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleManageFields(table)}
                  >
                    <Settings className="h-4 w-4 ml-2" />
                    נהל שדות
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDeleteTable(table)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Table2 className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">אין טבלאות עדיין</h3>
            <p className="text-muted-foreground text-center mb-4">
              צור את הטבלה הדינמית הראשונה שלך כדי להתחיל
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 ml-2" />
              צור טבלה ראשונה
            </Button>
          </CardContent>
        </Card>
      )}

      <CreateTableDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {selectedTable && (
        <ManageFieldsDialog
          open={showFieldsDialog}
          onOpenChange={setShowFieldsDialog}
          table={selectedTable}
        />
      )}

      <AlertDialog open={!!tableToDelete} onOpenChange={() => setTableToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>האם למחוק את הטבלה?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק את הטבלה "{tableToDelete?.name}" וכל הנתונים שבה. לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => tableToDelete && deleteMutation.mutate(tableToDelete.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
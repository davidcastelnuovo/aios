import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Table2 } from "lucide-react";
import { SimpleTableDialog } from "@/components/dynamic-tables/SimpleTableDialog";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [showCreateDialog, setShowCreateDialog] = useState(false);

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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">טבלאות דינמיות</h1>
          <p className="text-muted-foreground mt-1">
            צור וניהל טבלאות מותאמות אישית לנתונים שלך
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
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(buildPath(`/table/${table.slug}`))}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Table2 className="h-5 w-5" />
                  {table.name}
                </CardTitle>
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
    </div>
  );
}

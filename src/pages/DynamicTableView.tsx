import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DynamicGrid } from "@/components/dynamic-tables/DynamicGrid";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Settings, ArrowRight } from "lucide-react";
import { useState } from "react";
import { ManageFieldsDialog } from "@/components/dynamic-tables/ManageFieldsDialog";
import { useTenantPath } from "@/hooks/useTenantPath";

interface CrmTable {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
}

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

export default function DynamicTableView() {
  const { tableSlug } = useParams<{ tableSlug: string }>();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const [isManageFieldsOpen, setIsManageFieldsOpen] = useState(false);

  // Fetch table by slug
  const { data: table, isLoading: isLoadingTable } = useQuery({
    queryKey: ["crm-table", tableSlug],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("crm-tables", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      
      const tables = response.data as CrmTable[];
      const foundTable = tables.find(t => t.slug === tableSlug);
      
      if (!foundTable) {
        throw new Error("Table not found");
      }
      
      return foundTable;
    },
    enabled: !!tableSlug,
  });

  // Fetch fields for this table
  const { data: fields, isLoading: isLoadingFields } = useQuery({
    queryKey: ["crm-fields", table?.id],
    queryFn: async () => {
      if (!table?.id) return [];

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke(`crm-fields?table_id=${table.id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      return response.data as CrmField[];
    },
    enabled: !!table?.id,
  });

  if (isLoadingTable || isLoadingFields) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!table || !fields) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-foreground mb-2">טבלה לא נמצאה</h2>
          <p className="text-muted-foreground mb-4">הטבלה שחיפשת אינה קיימת</p>
          <Button onClick={() => navigate(buildPath("dynamic-tables"))}>
            חזור לניהול טבלאות
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(buildPath("dynamic-tables"))}
                className="mr-2"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
              <h1 className="text-3xl font-bold text-foreground">{table.name}</h1>
            </div>
            {table.description && (
              <p className="text-muted-foreground text-sm">{table.description}</p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => setIsManageFieldsOpen(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            ניהול שדות
          </Button>
        </div>

        {fields.length > 0 ? (
          <DynamicGrid
            tableId={table.id}
            tableName={table.name}
            fields={fields}
          />
        ) : (
          <div className="text-center py-12 border rounded-lg bg-muted/20">
            <h3 className="text-xl font-semibold text-foreground mb-2">
              אין שדות בטבלה זו
            </h3>
            <p className="text-muted-foreground mb-4">
              הוסף שדות כדי להתחיל לעבוד עם הטבלה
            </p>
            <Button onClick={() => setIsManageFieldsOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              הוסף שדות
            </Button>
          </div>
        )}
      </div>

      <ManageFieldsDialog
        open={isManageFieldsOpen}
        onOpenChange={setIsManageFieldsOpen}
        table={table}
      />
    </>
  );
}

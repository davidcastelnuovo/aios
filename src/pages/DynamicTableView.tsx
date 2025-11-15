import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";

interface CrmTable {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export default function DynamicTableView() {
  const { tableSlug } = useParams<{ tableSlug: string }>();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();

  const { data: tables, isLoading: tablesLoading } = useQuery({
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

  const table = tables?.find((t) => t.slug === tableSlug);

  if (tablesLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!table) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="p-12 text-center">
          <h2 className="text-2xl font-bold mb-2">טבלה לא נמצאה</h2>
          <p className="text-muted-foreground mb-4">
            הטבלה שחיפשת לא קיימת במערכת
          </p>
          <Button onClick={() => navigate(buildPath('/dynamic-tables'))}>
            <ArrowRight className="ml-2 h-4 w-4" />
            חזור לטבלאות
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(buildPath('/dynamic-tables'))}
        >
          <ArrowRight className="ml-2 h-4 w-4" />
          חזור
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{table.name}</h1>
          {table.description && (
            <p className="text-muted-foreground mt-1">{table.description}</p>
          )}
        </div>
      </div>

      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          תצוגת טבלה פשוטה - בפיתוח
        </p>
      </Card>
    </div>
  );
}

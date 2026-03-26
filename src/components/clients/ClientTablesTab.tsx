import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileSpreadsheet, Facebook, ShoppingCart, ExternalLink, LayoutDashboard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { TableCardAlerts } from "@/components/dynamic-tables/TableCardAlerts";

interface ClientTablesTabProps {
  clientId: string;
  clientName: string;
}

export function ClientTablesTab({ clientId, clientName }: ClientTablesTabProps) {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();

  const { data: tables, isLoading } = useQuery({
    queryKey: ["client-tables", clientId],
    queryFn: async () => {
      const response = await supabase.functions.invoke("crm-tables", {
        method: "GET",
      });
      if (response.error) throw response.error;
      const allTables = Array.isArray(response.data) ? response.data : [];
      return allTables.filter((t: any) => t.client_id === clientId);
    },
    enabled: !!clientId,
  });

  const { data: dashboards = [] } = useQuery({
    queryKey: ["client-dashboards", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_dashboards")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3" dir="rtl">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const hasContent = (tables && tables.length > 0) || dashboards.length > 0;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Dashboards */}
      {dashboards.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-2 justify-end">
            <LayoutDashboard className="h-4 w-4 text-primary" />
            דשבורדים
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {dashboards.map((dash: any) => (
              <Card
                key={dash.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(buildPath(`/dashboard/${dash.id}`))}
              >
                <CardHeader className="p-4">
                  <CardTitle className="text-sm flex items-center gap-2 justify-between">
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{dash.name}</span>
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tables */}
      {tables && tables.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-2 justify-end">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            טבלאות
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {tables.map((table: any) => (
              <Card
                key={table.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(buildPath(`/table/${table.slug}`))}
              >
                <CardHeader className="p-4">
                  <CardTitle className="text-sm flex items-center gap-2 justify-between">
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex items-center gap-2 truncate">
                      {table.integration_type === "facebook_insights" ? (
                        <Facebook className="h-4 w-4 text-blue-600 shrink-0" />
                      ) : table.integration_type === "facebook_ecommerce" ? (
                        <ShoppingCart className="h-4 w-4 text-green-600 shrink-0" />
                      ) : table.integration_type === "google_ads" ? (
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                          <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="#4285F4"/>
                        </svg>
                      ) : (
                        <FileSpreadsheet className="h-4 w-4 shrink-0" />
                      )}
                      <span className="truncate">{table.name}</span>
                    </div>
                  </CardTitle>
                  {table.integration_type === "facebook_insights" || table.integration_type === "facebook_ecommerce" || table.integration_type === "google_ads" ? (
                    table.integration_settings?.ad_account_id || table.integration_settings?.customer_id ? (
                      <CardDescription className="text-green-600 text-xs">✓ מחובר</CardDescription>
                    ) : (
                      <CardDescription className="text-amber-600 text-xs">ממתין לחיבור</CardDescription>
                    )
                  ) : table.description ? (
                    <CardDescription className="text-xs">{table.description}</CardDescription>
                  ) : null}
                  {table.integration_type === "facebook_insights" && (
                    <TableCardAlerts tableId={table.id} />
                  )}
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!hasContent && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>אין טבלאות או דשבורדים משויכים ל{clientName}</p>
          <p className="text-xs mt-1">ניתן לשייך טבלאות מדף ניהול טבלאות</p>
        </div>
      )}
    </div>
  );
}

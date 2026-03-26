import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileSpreadsheet, Facebook, ShoppingCart, ExternalLink, LayoutDashboard, X, Plus, Maximize2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { TableCardAlerts } from "@/components/dynamic-tables/TableCardAlerts";
import { toast } from "sonner";

interface ClientTablesTabProps {
  clientId: string;
  clientName: string;
}

export function ClientTablesTab({ clientId, clientName }: ClientTablesTabProps) {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();

  const [dashboardSearch, setDashboardSearch] = useState("");
  const [showDashboardDropdown, setShowDashboardDropdown] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [showTableDropdown, setShowTableDropdown] = useState(false);

  // All tables for the tenant
  const { data: allTables = [], isLoading } = useQuery({
    queryKey: ["all-crm-tables"],
    queryFn: async () => {
      const response = await supabase.functions.invoke("crm-tables", { method: "GET" });
      if (response.error) throw response.error;
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  const tables = useMemo(() => allTables.filter((t: any) => t.client_id === clientId), [allTables, clientId]);

  // Available tables not linked to this client
  const availableTables = useMemo(() => {
    let filtered = allTables.filter((t: any) => t.client_id !== clientId);
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      filtered = filtered.filter((t: any) => t.name?.toLowerCase().includes(q));
    }
    return filtered;
  }, [allTables, clientId, tableSearch]);

  // Dashboards linked to this client
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

  // All dashboards for the tenant
  const { data: allDashboards = [] } = useQuery({
    queryKey: ["all-dashboards", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_dashboards")
        .select("id, name, client_id")
        .eq("tenant_id", tenantId!)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const availableDashboards = useMemo(() => {
    const linkedIds = new Set(dashboards.map((d: any) => d.id));
    let filtered = allDashboards.filter((d: any) => !linkedIds.has(d.id));
    if (dashboardSearch.trim()) {
      const q = dashboardSearch.toLowerCase();
      filtered = filtered.filter((d: any) => d.name?.toLowerCase().includes(q));
    }
    return filtered;
  }, [allDashboards, dashboards, dashboardSearch]);

  // Link/unlink table
  const linkTable = async (tableId: string) => {
    const { error } = await supabase.functions.invoke("crm-tables", {
      method: "PATCH",
      body: { table_id: tableId, client_id: clientId },
    });
    if (error) { toast.error("שגיאה בשיוך הטבלה"); return; }
    toast.success("טבלה שויכה בהצלחה");
    queryClient.invalidateQueries({ queryKey: ["all-crm-tables"] });
    setTableSearch("");
    setShowTableDropdown(false);
  };

  const unlinkTable = async (tableId: string) => {
    const { error } = await supabase.functions.invoke("crm-tables", {
      method: "PATCH",
      body: { table_id: tableId, client_id: null },
    });
    if (error) { toast.error("שגיאה בהסרת השיוך"); return; }
    toast.success("שיוך הטבלה הוסר");
    queryClient.invalidateQueries({ queryKey: ["all-crm-tables"] });
  };

  // Link/unlink dashboard
  const linkDashboard = async (dashboardId: string) => {
    const { error } = await supabase
      .from("crm_dashboards")
      .update({ client_id: clientId })
      .eq("id", dashboardId);
    if (error) { toast.error("שגיאה בשיוך הדשבורד"); return; }
    toast.success("דשבורד שויך בהצלחה");
    queryClient.invalidateQueries({ queryKey: ["client-dashboards", clientId] });
    queryClient.invalidateQueries({ queryKey: ["all-dashboards"] });
    setDashboardSearch("");
    setShowDashboardDropdown(false);
  };

  const unlinkDashboard = async (dashboardId: string) => {
    const { error } = await supabase
      .from("crm_dashboards")
      .update({ client_id: null })
      .eq("id", dashboardId);
    if (error) { toast.error("שגיאה בהסרת השיוך"); return; }
    toast.success("שיוך הדשבורד הוסר");
    queryClient.invalidateQueries({ queryKey: ["client-dashboards", clientId] });
    queryClient.invalidateQueries({ queryKey: ["all-dashboards"] });
  };

  if (isLoading) {
    return (
      <div className="space-y-3" dir="rtl">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const hasContent = tables.length > 0 || dashboards.length > 0;

  const renderTableIcon = (table: any) => {
    if (table.integration_type === "facebook_insights") return <Facebook className="h-4 w-4 text-blue-600 shrink-0" />;
    if (table.integration_type === "facebook_ecommerce") return <ShoppingCart className="h-4 w-4 text-green-600 shrink-0" />;
    if (table.integration_type === "google_ads") return (
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="#4285F4"/>
      </svg>
    );
    return <FileSpreadsheet className="h-4 w-4 shrink-0" />;
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Table selector */}
      <div className="flex flex-col items-end gap-1">
        <span className="text-muted-foreground text-sm flex items-center gap-1">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          :שייך טבלה
        </span>
        <div className="relative w-full">
          <Input
            placeholder="חפש טבלה לשיוך..."
            value={tableSearch}
            onChange={(e) => { setTableSearch(e.target.value); setShowTableDropdown(true); }}
            onFocus={() => setShowTableDropdown(true)}
            onBlur={() => setTimeout(() => setShowTableDropdown(false), 200)}
            className="h-7 text-xs text-right"
            dir="rtl"
          />
          {showTableDropdown && (
            <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto">
              {availableTables.length > 0 ? availableTables.map((t: any) => (
                <button
                  key={t.id}
                  className="w-full text-right px-3 py-1.5 text-xs hover:bg-accent transition-colors flex items-center justify-between"
                  onClick={() => linkTable(t.id)}
                >
                  <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                  <div className="flex items-center gap-1.5 truncate">
                    {renderTableIcon(t)}
                    <span className="truncate">{t.name}</span>
                  </div>
                </button>
              )) : (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center">אין טבלאות זמינות</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dashboard selector */}
      <div className="flex flex-col items-end gap-1">
        <span className="text-muted-foreground text-sm flex items-center gap-1">
          <LayoutDashboard className="h-3.5 w-3.5" />
          :שייך דשבורד
        </span>
        <div className="relative w-full">
          <Input
            placeholder="חפש דשבורד לשיוך..."
            value={dashboardSearch}
            onChange={(e) => { setDashboardSearch(e.target.value); setShowDashboardDropdown(true); }}
            onFocus={() => setShowDashboardDropdown(true)}
            onBlur={() => setTimeout(() => setShowDashboardDropdown(false), 200)}
            className="h-7 text-xs text-right"
            dir="rtl"
          />
          {showDashboardDropdown && (
            <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto">
              {availableDashboards.length > 0 ? availableDashboards.map((d: any) => (
                <button
                  key={d.id}
                  className="w-full text-right px-3 py-1.5 text-xs hover:bg-accent transition-colors flex items-center justify-between"
                  onClick={() => linkDashboard(d.id)}
                >
                  <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{d.name}</span>
                </button>
              )) : (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center">אין דשבורדים זמינים</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Linked tables */}
      {tables.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-2 justify-end">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            טבלאות משויכות
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {tables.map((table: any) => (
              <Card key={table.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="p-4">
                  <CardTitle className="text-sm flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0"
                        onClick={(e) => { e.stopPropagation(); unlinkTable(table.id); }}>
                        <X className="h-3 w-3" />
                      </Button>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 cursor-pointer"
                        onClick={() => navigate(buildPath(`/table/${table.slug}`))} />
                    </div>
                    <div className="flex items-center gap-2 truncate cursor-pointer"
                      onClick={() => navigate(buildPath(`/table/${table.slug}`))}>
                      {renderTableIcon(table)}
                      <span className="truncate">{table.name}</span>
                    </div>
                  </CardTitle>
                  {(table.integration_type === "facebook_insights" || table.integration_type === "facebook_ecommerce" || table.integration_type === "google_ads") ? (
                    (table.integration_settings?.ad_account_id || table.integration_settings?.customer_id) ? (
                      <CardDescription className="text-green-600 text-xs">✓ מחובר</CardDescription>
                    ) : (
                      <CardDescription className="text-amber-600 text-xs">ממתין לחיבור</CardDescription>
                    )
                  ) : table.description ? (
                    <CardDescription className="text-xs">{table.description}</CardDescription>
                  ) : null}
                  {table.integration_type === "facebook_insights" && <TableCardAlerts tableId={table.id} />}
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Linked dashboards */}
      {dashboards.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-2 justify-end">
            <LayoutDashboard className="h-4 w-4 text-primary" />
            דשבורדים משויכים
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {dashboards.map((dash: any) => (
              <Card key={dash.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="p-4">
                  <CardTitle className="text-sm flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0"
                        onClick={(e) => { e.stopPropagation(); unlinkDashboard(dash.id); }}>
                        <X className="h-3 w-3" />
                      </Button>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 cursor-pointer"
                        onClick={() => navigate(buildPath(`/dashboard/${dash.id}`))} />
                    </div>
                    <span className="truncate cursor-pointer"
                      onClick={() => navigate(buildPath(`/dashboard/${dash.id}`))}>
                      {dash.name}
                    </span>
                  </CardTitle>
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
          <p className="text-xs mt-1">ניתן לשייך מהשדות למעלה</p>
        </div>
      )}
    </div>
  );
}
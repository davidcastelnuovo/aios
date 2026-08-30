import { useState, useMemo, useEffect, useRef } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { FileSpreadsheet, ExternalLink, LayoutDashboard, X, Plus, Maximize2, ChevronDown, Settings, Power } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { TableCardAlerts } from "@/components/dynamic-tables/TableCardAlerts";
import { ClientReportPanel } from "@/components/clients/ClientReportPanel";
import { ClientDashboardPanel } from "@/components/clients/ClientDashboardPanel";
import { ClientReportScheduleSettings } from "@/components/clients/ClientReportScheduleSettings";
import { getIntegrationIcon } from "@/lib/integrationIcons";
import { fetchAccessibleDashboards } from "@/lib/crmDashboards";
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
  const [viewDashboard, setViewDashboard] = useState<{ id: string; name: string } | null>(null);
  const [showLinkSection, setShowLinkSection] = useState(false);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [contentKind, setContentKind] = useState<"table" | "dashboard">("table");
  const userSelectedRef = useRef(false);

  // Tables linked to this client (server-filtered)
  const { data: tables = [], isLoading } = useQuery({
    queryKey: ["client-crm-tables", tenantId, clientId],
    queryFn: async () => {
      const response = await supabase.functions.invoke(
        `crm-tables?tenant_id=${tenantId}&client_id=${clientId}`,
        { method: "GET" }
      );
      if (response.error) throw response.error;
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: !!tenantId && !!clientId,
  });

  // All tenant tables — only for the link-table picker
  const { data: allTables = [] } = useQuery({
    queryKey: ["all-crm-tables", tenantId],
    queryFn: async () => {
      const response = await supabase.functions.invoke(
        `crm-tables?tenant_id=${tenantId}`,
        { method: "GET" }
      );
      if (response.error) throw response.error;
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: !!tenantId && showLinkSection,
  });

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

  // All dashboards accessible from this tenant (own + shared agencies like DMM-MC)
  const { data: allDashboards = [] } = useQuery({
    queryKey: ["all-dashboards", tenantId],
    queryFn: async () => {
      const rows = await fetchAccessibleDashboards(tenantId!, {
        select: "id, name, client_id, tenant_id, agency_id, created_at",
      });
      return rows
        .map((d) => ({ id: d.id, name: d.name, client_id: d.client_id }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
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
  const serverErrorMessage = async (error: any, fallback: string) => {
    try {
      const details = await error?.context?.json();
      if (details?.error) return details.error as string;
    } catch { /* keep fallback */ }
    return fallback;
  };

  const linkTable = async (tableId: string) => {
    const { error } = await supabase.functions.invoke("crm-tables", {
      method: "PATCH",
      body: { table_id: tableId, client_id: clientId },
    });
    if (error) { toast.error(await serverErrorMessage(error, "שגיאה בשיוך הטבלה")); return; }
    toast.success("טבלה שויכה בהצלחה");
    queryClient.invalidateQueries({ queryKey: ["client-crm-tables", tenantId, clientId] });
    queryClient.invalidateQueries({ queryKey: ["all-crm-tables", tenantId] });
    setTableSearch("");
    setShowTableDropdown(false);
  };

  const unlinkTable = async (tableId: string) => {
    const { error } = await supabase.functions.invoke("crm-tables", {
      method: "PATCH",
      body: { table_id: tableId, client_id: null },
    });
    if (error) { toast.error(await serverErrorMessage(error, "שגיאה בהסרת השיוך")); return; }
    toast.success("שיוך הטבלה הוסר");
    queryClient.invalidateQueries({ queryKey: ["client-crm-tables", tenantId, clientId] });
    queryClient.invalidateQueries({ queryKey: ["all-crm-tables", tenantId] });
  };

  const toggleCampaignActive = async (table: any) => {
    const next = !(table.campaign_active ?? true);
    const { error } = await supabase.functions.invoke("crm-tables", {
      method: "PATCH",
      body: { table_id: table.id, campaign_active: next },
    });
    if (error) {
      toast.error(await serverErrorMessage(error, "עדכון מצב הקמפיין נכשל"));
      return;
    }
    toast.success(next
      ? "הקמפיין דלוק — כרמן תכלול אותו בדיווחים"
      : "הקמפיין כבוי — כרמן לא תדווח עליו");
    queryClient.invalidateQueries({ queryKey: ["client-crm-tables", tenantId, clientId] });
    queryClient.invalidateQueries({ queryKey: ["all-crm-tables", tenantId] });
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
    queryClient.invalidateQueries({ queryKey: ["all-dashboards", tenantId] });
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
    queryClient.invalidateQueries({ queryKey: ["all-dashboards", tenantId] });
  };

  const renderTableIcon = (table: any) => getIntegrationIcon(table?.integration_type);

  const allItems = useMemo(() => {
    const dashItems = dashboards.map((d: any) => ({
      id: `dash-${d.id}`,
      kind: "dashboard" as const,
      label: d.name,
      icon: <LayoutDashboard className="h-4 w-4 shrink-0" />,
      raw: d,
    }));
    const tableItems = tables.map((t: any) => ({
      id: `table-${t.id}`,
      kind: "table" as const,
      label: t.name,
      icon: renderTableIcon(t),
      raw: t,
    }));
    return [...dashItems, ...tableItems];
  }, [dashboards, tables]);

  const items = useMemo(
    () => allItems.filter((item) => item.kind === contentKind),
    [allItems, contentKind],
  );

  useEffect(() => {
    if (items.length > 0) return;
    if (contentKind === "table" && dashboards.length > 0) setContentKind("dashboard");
    if (contentKind === "dashboard" && tables.length > 0) setContentKind("table");
  }, [contentKind, dashboards.length, items.length, tables.length]);

  useEffect(() => {
    if (items.length === 0) {
      if (activeTabId !== null) setActiveTabId(null);
      return;
    }
    const currentExists = !!items.find((i) => i.id === activeTabId);
    if (!currentExists) {
      setActiveTabId(items[0].id);
    }
  }, [items]);

  if (isLoading) {
    return (
      <div className="space-y-3" dir="rtl">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const hasContent = allItems.length > 0;
  const hasActiveKindContent = items.length > 0;
  const activeItem = items.find((i) => i.id === activeTabId) || items[0];


  return (
    <div className="space-y-3 min-w-0" dir="rtl">
      {/* Reports and dashboards are independent surfaces. Keeping their
          selectors separate prevents similarly named items from replacing
          each other's active state. */}
      {hasContent && (
        <Tabs
          value={contentKind}
          onValueChange={(value) => {
            userSelectedRef.current = false;
            setActiveTabId(null);
            setContentKind(value as "table" | "dashboard");
          }}
          dir="rtl"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="table" disabled={tables.length === 0} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              דוחות נפרדים ({tables.length})
            </TabsTrigger>
            <TabsTrigger value="dashboard" disabled={dashboards.length === 0} className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              דשבורדים ({dashboards.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Tabs row + manage-links toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1 text-muted-foreground shrink-0"
          onClick={() => setShowLinkSection(!showLinkSection)}
        >
          <Settings className="h-3.5 w-3.5" />
          ניהול שיוכים
          <ChevronDown className={`h-3 w-3 transition-transform ${showLinkSection ? 'rotate-180' : ''}`} />
        </Button>

        {hasActiveKindContent && (
          <div className="flex-1 min-w-0">
            <Tabs value={activeItem?.id} onValueChange={(id) => { userSelectedRef.current = true; setActiveTabId(id); }} dir="rtl">
              <TabsList className="h-9 w-full justify-start overflow-x-auto flex-nowrap">
                {items.map((it) => (
                  <TabsTrigger
                    key={it.id}
                    value={it.id}
                    className="gap-1.5 text-xs shrink-0"
                  >
                    {it.icon}
                    <span className="truncate max-w-[140px]">{it.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}
      </div>

      {/* Collapsible link section */}
      {showLinkSection && (
        <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
          {/* Table selector */}
          <div className="flex flex-col items-end gap-1">
            <span className="text-muted-foreground text-xs flex items-center gap-1">
              <FileSpreadsheet className="h-3 w-3" />
              שייך טבלה:
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
            <span className="text-muted-foreground text-xs flex items-center gap-1">
              <LayoutDashboard className="h-3 w-3" />
              שייך דשבורד:
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
        </div>
      )}

      {/* Active item content — report/dashboard first, schedule settings below */}
      {activeItem && activeItem.kind === "dashboard" && (
        <div className="border rounded-lg min-w-0">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/40 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {(activeItem.raw.integration_type === "facebook_insights" ||
                activeItem.raw.integration_type === "facebook_ecommerce" ||
                activeItem.raw.integration_type === "google_ads") && (
                <Button
                  type="button"
                  variant={(activeItem.raw.campaign_active ?? true) ? "default" : "outline"}
                  size="sm"
                  className="h-7 gap-1.5"
                  onClick={() => toggleCampaignActive(activeItem.raw)}
                  title="קובע אם כרמן תכלול את הקמפיין בעדכונים ובבדיקות התקינות"
                >
                  <Power className="h-3.5 w-3.5" />
                  {(activeItem.raw.campaign_active ?? true) ? "קמפיין דלוק" : "קמפיין כבוי"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => unlinkDashboard(activeItem.raw.id)}
              >
                <X className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => navigate(buildPath(`/dashboard/${activeItem.raw.id}`))}
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <LayoutDashboard className="h-4 w-4" />
              <span>{activeItem.raw.name}</span>
            </div>
          </div>
          <div className="border-t p-3">
            <ClientDashboardPanel
              key={`${clientId}-${activeItem.raw.id}`}
              dashboard={{ id: activeItem.raw.id, name: activeItem.raw.name }}
              clientId={clientId}
              tenantId={tenantId || ""}
            />
          </div>
        </div>
      )}

      {activeItem && activeItem.kind === "table" && (
        <div className="border rounded-lg min-w-0">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/40 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => unlinkTable(activeItem.raw.id)}
              >
                <X className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => navigate(buildPath(`/table/${activeItem.raw.slug}`))}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium">
              {renderTableIcon(activeItem.raw)}
              <span>{activeItem.raw.name}</span>
              {(activeItem.raw.integration_type === "facebook_insights" || activeItem.raw.integration_type === "facebook_ecommerce" || activeItem.raw.integration_type === "google_ads") && (
                (activeItem.raw.integration_settings?.ad_account_id || activeItem.raw.integration_settings?.customer_id) ? (
                  <span className="text-green-600 text-xs">✓ מחובר</span>
                ) : (
                  <span className="text-amber-600 text-xs">ממתין לחיבור</span>
                )
              )}
            </div>
          </div>
          <div className="border-t p-3">
            <ClientReportPanel
              key={`${clientId}-${activeItem.raw.id}`}
              table={activeItem.raw}
              clientId={clientId}
              tenantId={tenantId || ""}
            />
          </div>
        </div>
      )}

      {activeItem && tenantId && (
        <ClientReportScheduleSettings
          key={`schedule-${activeItem.id}`}
          clientId={clientId}
          tenantId={tenantId}
          target={{
            kind: activeItem.kind,
            id: activeItem.raw.id,
            name: activeItem.raw.name,
          }}
        />
      )}

      {!hasContent && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>אין דוחות או דשבורדים משויכים ל{clientName}</p>
          <p className="text-xs mt-1">לחץ על "ניהול שיוכים" כדי לשייך</p>
        </div>
      )}
    </div>
  );
}

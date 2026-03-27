import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Table2, FileSpreadsheet, Pencil, Trash2, ChevronDown, ChevronRight, Facebook, Building2, User, X, Check, ChevronsUpDown, TrendingUp, AlertTriangle, ShoppingCart, LayoutDashboard } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SimpleTableDialog } from "@/components/dynamic-tables/SimpleTableDialog";
import { FacebookTableDialog } from "@/components/dynamic-tables/FacebookTableDialog";
import { FacebookEcommerceTableDialog } from "@/components/dynamic-tables/FacebookEcommerceTableDialog";
import { GoogleAdsTableDialog } from "@/components/dynamic-tables/GoogleAdsTableDialog";
import { GoogleAnalyticsTableDialog } from "@/components/dynamic-tables/GoogleAnalyticsTableDialog";
import { GoogleSearchConsoleTableDialog } from "@/components/dynamic-tables/GoogleSearchConsoleTableDialog";
import { AhrefsTableDialog } from "@/components/dynamic-tables/AhrefsTableDialog";
import { TableCardAlerts } from "@/components/dynamic-tables/TableCardAlerts";
import { CreateDashboardDialog } from "@/components/dynamic-tables/CreateDashboardDialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useAgency } from "@/contexts/AgencyContext";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useUserRole } from "@/hooks/useUserRole";

interface CrmTable {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  integration_type: string | null;
  integration_settings: any;
  agency_id: string | null;
  client_id: string | null;
}

export default function DynamicTables() {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const queryClient = useQueryClient();
  const { selectedAgency } = useAgency();
  const { tenantId } = useCurrentTenant();
  const { isCampaigner, isOwner, isTeamManager, isSuperAdmin, campaignerId } = useUserRole();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showFacebookDialog, setShowFacebookDialog] = useState(false);
  const [showFacebookEcommerceDialog, setShowFacebookEcommerceDialog] = useState(false);
  const [showGoogleAdsDialog, setShowGoogleAdsDialog] = useState(false);
  const [showGADialog, setShowGADialog] = useState(false);
  const [showGSCDialog, setShowGSCDialog] = useState(false);
  const [showAhrefsDialog, setShowAhrefsDialog] = useState(false);
  const [editingTable, setEditingTable] = useState<CrmTable | null>(null);
  const [deletingTable, setDeletingTable] = useState<CrmTable | null>(null);
  const [editName, setEditName] = useState("");
  const [editAgencyId, setEditAgencyId] = useState<string>("");
  const [editClientId, setEditClientId] = useState<string>("");
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreateDashboardDialog, setShowCreateDashboardDialog] = useState(false);
  const [mainTab, setMainTab] = useState<string>("tables");

  // For campaigners: fetch their assigned client IDs
  const { data: assignedClientIds } = useQuery({
    queryKey: ['campaigner-client-ids', campaignerId],
    queryFn: async () => {
      if (!campaignerId) return [];
      const { data, error } = await supabase
        .from('client_team')
        .select('client_id')
        .eq('campaigner_id', campaignerId);
      if (error) throw error;
      return data?.map(ct => ct.client_id) || [];
    },
    enabled: !!campaignerId && isCampaigner,
  });

  const canManageTables = isOwner || isTeamManager || isSuperAdmin;

  // Fetch agencies and clients for displaying names
  const { data: agencies = [] } = useQuery({
    queryKey: ['agencies', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-all', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, agency_id');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Filter clients by selected agency in edit dialog
  const editFilteredClients = useMemo(() => {
    if (!editAgencyId) return [];
    return clients.filter(c => c.agency_id === editAgencyId);
  }, [clients, editAgencyId]);

  const { data: tables, isLoading } = useQuery({
    queryKey: ['crm-tables', tenantId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('crm-tables', {
        method: 'GET',
      });

      if (response.error) throw response.error;
      // Ensure we always return an array
      return Array.isArray(response.data) ? response.data as CrmTable[] : [];
    },
    enabled: !!tenantId,
  });

  // Fetch dashboards
  const { data: dashboards = [], isLoading: dashboardsLoading } = useQuery({
    queryKey: ['crm-dashboards', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('crm_dashboards')
        .select('*, clients(name), agencies(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Filter tables by selected agency
  const filteredTables = useMemo(() => {
    if (!tables) return [];
    
    // When "all agencies" is selected, show all tables for this tenant
    // (tenant filtering is done in the Edge Function)
    if (!selectedAgency || selectedAgency === 'all') return tables;
    
    // Filter by selected agency - show general tables + agency-specific tables
    return tables.filter(table => 
      table.agency_id === null ||  // General tables always shown
      table.agency_id === selectedAgency
    );
  }, [tables, selectedAgency]);

  // Delete dashboard mutation
  const deleteDashboardMutation = useMutation({
    mutationFn: async (dashboardId: string) => {
      const { error } = await supabase
        .from('crm_dashboards')
        .delete()
        .eq('id', dashboardId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-dashboards'] });
      toast.success('הדשבורד נמחק בהצלחה');
    },
    onError: (error: any) => {
      toast.error('שגיאה במחיקת הדשבורד: ' + error.message);
    },
  });

  const deleteTableMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-tables`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ table_id: tableId }),
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete table');
      }
      
      return await response.json();
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
    mutationFn: async ({ tableId, name, agency_id, client_id }: { tableId: string; name: string; agency_id: string | null; client_id: string | null }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-tables`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ table_id: tableId, name, agency_id, client_id }),
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update table');
      }
      
      return await response.json();
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
    setEditAgencyId(table.agency_id || "");
    setEditClientId(table.client_id || "");
  };

  const handleDelete = (table: CrmTable, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingTable(table);
  };

  const handleSaveEdit = () => {
    if (!editingTable || !editName.trim()) return;
    updateTableMutation.mutate({ 
      tableId: editingTable.id, 
      name: editName,
      agency_id: editAgencyId || null,
      client_id: editClientId || null,
    });
  };

  const getAgencyName = (agencyId: string | null) => {
    if (!agencyId) return null;
    const agency = agencies.find(a => a.id === agencyId);
    return agency?.name || null;
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId) return null;
    const client = clients.find(c => c.id === clientId);
    return client?.name || null;
  };

  const groupedTables = useMemo(() => {
    if (!filteredTables) return {};
    
    const groups: Record<string, CrmTable[]> = {};
    filteredTables.forEach(table => {
      const category = table.category || 'ללא קבוצה';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(table);
    });
    
    return groups;
  }, [filteredTables]);

  // Get categories list for tabs
  const categories = useMemo(() => {
    return Object.keys(groupedTables);
  }, [groupedTables]);

  // Auto-select first category if none selected
  useMemo(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">ניהול טבלאות ודשבורדים</h1>
          <p className="text-muted-foreground mt-1">
            צור וערוך טבלאות נתונים ודשבורדים מאוחדים
          </p>
        </div>
      </div>

      {/* Main Tabs: Tables / Dashboards */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="tables" className="gap-2">
              <Table2 className="h-4 w-4" />
              טבלאות
            </TabsTrigger>
            <TabsTrigger value="dashboards" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              דשבורדים
            </TabsTrigger>
          </TabsList>

          {/* Action buttons based on tab */}
          {mainTab === 'tables' ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="ml-2 h-4 w-4" />
                  טבלה חדשה
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
                  <Table2 className="ml-2 h-4 w-4" />
                  טבלה רגילה
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowFacebookDialog(true)}>
                  <Facebook className="ml-2 h-4 w-4" />
                  טבלת Facebook Insights (לידים)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowFacebookEcommerceDialog(true)}>
                  <ShoppingCart className="ml-2 h-4 w-4" />
                  טבלת Facebook Ecommerce (מכירות)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowGoogleAdsDialog(true)}>
                  <svg className="ml-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="#4285F4"/>
                  </svg>
                  טבלת Google Ads
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowGADialog(true)}>
                  <svg className="ml-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path d="M22.84 2.998L12.842 20.998 2.84 2.998h20z" fill="#F9AB00"/>
                    <path d="M12.84 20.998l-5-9h10l-5 9z" fill="#E37400"/>
                  </svg>
                  טבלת Google Analytics
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowGSCDialog(true)}>
                  <svg className="ml-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#4285F4" strokeWidth="2" fill="none"/>
                    <path d="M12 6v6l4 2" stroke="#4285F4" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  טבלת Search Console
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAhrefsDialog(true)}>
                  <TrendingUp className="ml-2 h-4 w-4" />
                  טבלת Ahrefs
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={() => setShowCreateDashboardDialog(true)}>
              <Plus className="ml-2 h-4 w-4" />
              דשבורד חדש
            </Button>
          )}
        </div>

        {/* Tables Tab Content */}
        <TabsContent value="tables">
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
          ) : !filteredTables || filteredTables.length === 0 ? (
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
        <div className="space-y-6">
          {/* Horizontal Tabs */}
          <div className="flex flex-wrap gap-2 border-b pb-3">
            {Object.entries(groupedTables).map(([category, categoryTables]) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="gap-2"
              >
                <span>({categoryTables.length})</span>
                <span>{category}</span>
              </Button>
            ))}
          </div>

          {/* Tables Grid */}
          {selectedCategory && groupedTables[selectedCategory] && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groupedTables[selectedCategory].map((table) => (
                <Card
                  key={table.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow relative"
                  onClick={() => navigate(buildPath(`/table/${table.slug}`))}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        {table.integration_type === 'facebook_insights' ? (
                          <Facebook className="h-5 w-5 text-blue-600" />
                        ) : table.integration_type === 'facebook_ecommerce' ? (
                          <ShoppingCart className="h-5 w-5 text-green-600" />
                        ) : table.integration_type === 'google_ads' ? (
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                            <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="#4285F4"/>
                          </svg>
                        ) : (
                          <FileSpreadsheet className="h-5 w-5" />
                        )}
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
                    {/* Agency & Client Badges */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {table.agency_id && (
                        <Badge variant="outline" className="text-xs">
                          <Building2 className="h-3 w-3 ml-1" />
                          {getAgencyName(table.agency_id)}
                        </Badge>
                      )}
                      {table.client_id && (
                        <Badge variant="secondary" className="text-xs">
                          <User className="h-3 w-3 ml-1" />
                          {getClientName(table.client_id)}
                        </Badge>
                      )}
                    </div>
                    {/* Show connection status for integration tables, or description for others */}
                    {(table.integration_type === 'facebook_insights' || table.integration_type === 'facebook_ecommerce' || table.integration_type === 'google_ads') ? (
                      table.integration_settings?.ad_account_id || table.integration_settings?.customer_id || table.integration_settings?.make_scenario_id ? (
                        <CardDescription className="text-green-600">
                          ✓ מחובר לחשבון מודעות
                        </CardDescription>
                      ) : (
                        <CardDescription className="text-amber-600">
                          ממתין לחיבור חשבון מודעות
                        </CardDescription>
                      )
                    ) : table.description ? (
                      <CardDescription>{table.description}</CardDescription>
                    ) : null}
                    {/* Table Card Alerts */}
                    {table.integration_type === 'facebook_insights' && (
                      <TableCardAlerts tableId={table.id} />
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {table.integration_type === 'facebook_insights' ? (
                        <>
                          <span className="text-blue-600">Facebook Insights (לידים)</span>
                          {table.integration_settings?.last_sync_at && (
                            <span className="mr-2">
                              • עודכן {new Date(table.integration_settings.last_sync_at).toLocaleDateString('he-IL')}
                            </span>
                          )}
                        </>
                      ) : table.integration_type === 'facebook_ecommerce' ? (
                        <>
                          <span className="text-green-600">Facebook Ecommerce (מכירות)</span>
                          {table.integration_settings?.last_sync_at && (
                            <span className="mr-2">
                              • עודכן {new Date(table.integration_settings.last_sync_at).toLocaleDateString('he-IL')}
                            </span>
                          )}
                        </>
                      ) : table.integration_type === 'google_ads' ? (
                        <>
                          <span className="text-green-600">Google Ads</span>
                          {table.integration_settings?.last_sync_at && (
                            <span className="mr-2">
                              • עודכן {new Date(table.integration_settings.last_sync_at).toLocaleDateString('he-IL')}
                            </span>
                          )}
                        </>
                      ) : (
                        'לחץ לצפייה וניהול'
                      )}
                    </p>
                  </CardContent>
                </Card>
            ))}
            </div>
          )}
        </div>
          )}
        </TabsContent>

        {/* Dashboards Tab Content */}
        <TabsContent value="dashboards">
          {dashboardsLoading ? (
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
          ) : dashboards.length === 0 ? (
            <Card className="p-12 text-center">
              <LayoutDashboard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">אין דשבורדים עדיין</h3>
              <p className="text-muted-foreground mb-4">
                צור דשבורד כדי לראות נתונים מאוחדים מכל הפלטפורמות של לקוח
              </p>
              <Button onClick={() => setShowCreateDashboardDialog(true)}>
                <Plus className="ml-2 h-4 w-4" />
                צור דשבורד ראשון
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dashboards.map((dashboard: any) => (
                <Card
                  key={dashboard.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(buildPath(`/dashboard/${dashboard.id}`))}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <LayoutDashboard className="h-5 w-5" />
                        {dashboard.name}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('האם אתה בטוח שברצונך למחוק את הדשבורד?')) {
                            deleteDashboardMutation.mutate(dashboard.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {/* Dashboard Type Badge */}
                      <Badge 
                        variant={dashboard.dashboard_type === 'agency' ? 'default' : 'secondary'} 
                        className="text-xs"
                      >
                        {dashboard.dashboard_type === 'agency' ? (
                          <>
                            <Building2 className="h-3 w-3 ml-1" />
                            דשבורד סוכנות
                          </>
                        ) : (
                          <>
                            <User className="h-3 w-3 ml-1" />
                            דשבורד לקוח
                          </>
                        )}
                      </Badge>
                      {dashboard.clients?.name && dashboard.dashboard_type !== 'agency' && (
                        <Badge variant="outline" className="text-xs">
                          <User className="h-3 w-3 ml-1" />
                          {dashboard.clients.name}
                        </Badge>
                      )}
                      {dashboard.agencies?.name && (
                        <Badge variant="outline" className="text-xs">
                          <Building2 className="h-3 w-3 ml-1" />
                          {dashboard.agencies.name}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      נוצר {new Date(dashboard.created_at).toLocaleDateString('he-IL')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <SimpleTableDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      <FacebookTableDialog
        open={showFacebookDialog}
        onOpenChange={setShowFacebookDialog}
      />

      <GoogleAdsTableDialog
        open={showGoogleAdsDialog}
        onOpenChange={setShowGoogleAdsDialog}
      />

      <GoogleAnalyticsTableDialog
        open={showGADialog}
        onOpenChange={setShowGADialog}
      />

      <GoogleSearchConsoleTableDialog
        open={showGSCDialog}
        onOpenChange={setShowGSCDialog}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editingTable} onOpenChange={(open) => !open && setEditingTable(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>עריכת טבלה</DialogTitle>
            <DialogDescription>ערוך את פרטי הטבלה</DialogDescription>
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
            <div className="space-y-2">
              <Label>שיוך לסוכנות (אופציונלי)</Label>
              <div className="flex gap-2">
              <Select value={editAgencyId || "__none__"} onValueChange={(val) => {
                  const newVal = val === "__none__" ? "" : val;
                  setEditAgencyId(newVal);
                  if (newVal !== editAgencyId) setEditClientId("");
                }}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="ללא שיוך - כל הסוכנויות" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא שיוך - כל הסוכנויות</SelectItem>
                    {agencies.filter(a => a.id).map((agency) => (
                      <SelectItem key={agency.id} value={agency.id}>
                        {agency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editAgencyId && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => {
                      setEditAgencyId("");
                      setEditClientId("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            {editAgencyId && (
              <div className="space-y-2">
                <Label>שיוך ללקוח (אופציונלי)</Label>
                <div className="flex gap-2">
                  <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={clientPopoverOpen}
                        className="flex-1 justify-between"
                      >
                        {editClientId
                          ? editFilteredClients.find((c) => c.id === editClientId)?.name
                          : "ללא שיוך - כל הלקוחות"}
                        <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="חפש לקוח..." className="h-9" />
                        <CommandList>
                          <CommandEmpty>לא נמצאו לקוחות</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="__none__"
                              onSelect={() => {
                                setEditClientId("");
                                setClientPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "ml-2 h-4 w-4",
                                  !editClientId ? "opacity-100" : "opacity-0"
                                )}
                              />
                              ללא שיוך - כל הלקוחות
                            </CommandItem>
                            {editFilteredClients.filter(c => c.id).map((client) => (
                              <CommandItem
                                key={client.id}
                                value={client.name}
                                onSelect={() => {
                                  setEditClientId(client.id);
                                  setClientPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "ml-2 h-4 w-4",
                                    editClientId === client.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {client.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {editClientId && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setEditClientId("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
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

      <AhrefsTableDialog 
        open={showAhrefsDialog} 
        onOpenChange={setShowAhrefsDialog} 
      />

      <FacebookEcommerceTableDialog
        open={showFacebookEcommerceDialog}
        onOpenChange={setShowFacebookEcommerceDialog}
      />

      <CreateDashboardDialog
        open={showCreateDashboardDialog}
        onOpenChange={setShowCreateDashboardDialog}
      />
    </div>
  );
}

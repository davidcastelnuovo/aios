import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Table2, FileSpreadsheet, Pencil, Trash2, ChevronDown, ChevronRight, Facebook, Building2, User, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SimpleTableDialog } from "@/components/dynamic-tables/SimpleTableDialog";
import { FacebookTableDialog } from "@/components/dynamic-tables/FacebookTableDialog";
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
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showFacebookDialog, setShowFacebookDialog] = useState(false);
  const [editingTable, setEditingTable] = useState<CrmTable | null>(null);
  const [deletingTable, setDeletingTable] = useState<CrmTable | null>(null);
  const [editName, setEditName] = useState("");
  const [editAgencyId, setEditAgencyId] = useState<string>("");
  const [editClientId, setEditClientId] = useState<string>("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['ללא קבוצה', 'Facebook Insights']));

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

  // Filter tables by selected agency
  const filteredTables = useMemo(() => {
    if (!tables) return [];
    if (!selectedAgency || selectedAgency === 'all') return tables;
    
    return tables.filter(table => 
      table.agency_id === null ||  // General tables always shown
      table.agency_id === selectedAgency
    );
  }, [tables, selectedAgency]);

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

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">ניהול טבלאות</h1>
          <p className="text-muted-foreground mt-1">
            צור וערוך טבלאות נתונים עם webhook integration
          </p>
        </div>
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
              <Facebook className="ml-2 h-4 w-4 text-blue-600" />
              טבלת Facebook Insights
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
          {Object.entries(groupedTables).map(([category, categoryTables]) => (
            <Collapsible 
              key={category}
              open={expandedCategories.has(category)}
              onOpenChange={() => toggleCategory(category)}
            >
              <div className="flex items-center gap-2 mb-3">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    {expandedCategories.has(category) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="font-semibold text-lg">{category}</span>
                    <span className="text-muted-foreground">({categoryTables.length})</span>
                  </Button>
                </CollapsibleTrigger>
              </div>
              
              <CollapsibleContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mr-6">
                  {categoryTables.map((table) => (
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
                        {table.description && (
                          <CardDescription>{table.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {table.integration_type === 'facebook_insights' ? (
                            <>
                              <span className="text-blue-600">סנכרון אוטומטי</span>
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
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}

      <SimpleTableDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      <FacebookTableDialog
        open={showFacebookDialog}
        onOpenChange={setShowFacebookDialog}
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
                <Select value={editAgencyId} onValueChange={(val) => {
                  setEditAgencyId(val);
                  if (val !== editAgencyId) setEditClientId("");
                }}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="ללא שיוך - כל הסוכנויות" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ללא שיוך - כל הסוכנויות</SelectItem>
                    {agencies.map((agency) => (
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
                  <Select value={editClientId} onValueChange={setEditClientId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="ללא שיוך - כל הלקוחות" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">ללא שיוך - כל הלקוחות</SelectItem>
                      {editFilteredClients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
    </div>
  );
}

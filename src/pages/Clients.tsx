import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, Globe, Coins, Phone, Mail, LayoutGrid, Table as TableIcon, Edit, Search, Plus, Trash2, FolderOpen, ExternalLink } from "lucide-react";
import { AddClientForm } from "@/components/forms/AddClientForm";
import { ImportClientsSheet } from "@/components/forms/ImportClientsSheet";
import { ImportClientsCSV } from "@/components/forms/ImportClientsCSV";
import { EditClientDialog } from "@/components/forms/EditClientDialog";
import AddTaskForm from "@/components/forms/AddTaskForm";
import { useAgency } from "@/contexts/AgencyContext";
import { useUserAgencies } from "@/hooks/useUserAgencies";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

export default function Clients() {
  const { selectedAgency } = useAgency();
  const { userAgencyIds } = useUserAgencies();
  const { canViewFinance } = useUserPermissions();
  const { campaignerId, isCampaigner, isTeamManager, isOwner } = useUserRole();
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [editingClient, setEditingClient] = useState<any>(null);
  const [hideInactive, setHideInactive] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCampaigner, setSelectedCampaigner] = useState<string>("all");
  const [deletingClient, setDeletingClient] = useState<any>(null);
  const [editingFolderLink, setEditingFolderLink] = useState<{ clientId: string; link: string } | null>(null);
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", tenantId, campaignerId, isCampaigner, isTeamManager, isOwner],
    queryFn: async () => {
      if (!tenantId) return [] as any[];
      const selectStr = (isCampaigner && !isTeamManager && !isOwner)
        ? `
          *,
          agencies (name),
          client_team!inner (
            campaigner_id,
            campaigners!inner (
              id,
              full_name
            )
          )
        `
        : `
          *,
          agencies (name),
          client_team (
            campaigner_id,
            campaigners!inner (
              id,
              full_name
            )
          )
        `;

      let query = supabase
        .from("clients")
        .select(selectStr)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (isCampaigner && !isTeamManager && !isOwner && campaignerId) {
        query = query.eq("client_team.campaigner_id", campaignerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: (!(isCampaigner && !isTeamManager && !isOwner) || !!campaignerId) && !!tenantId,
  });

  const { data: agencies } = useQuery({
    queryKey: ["agencies", tenantId],
    queryFn: async () => {
      if (!tenantId) return [] as any[];
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: campaigners } = useQuery({
    queryKey: ["campaigners", tenantId],
    queryFn: async () => {
      if (!tenantId) return [] as any[];
      const { data, error } = await supabase
        .from("campaigners")
        .select("id, full_name")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch client-team mapping for campaigner filter (for managers/owners)
  const { data: clientTeam } = useQuery({
    queryKey: ["client-team"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_team")
        .select("client_id, campaigner_id");
      if (error) throw error;
      return data;
    },
  });

  // Get client IDs for the campaigner
  const { data: campaignerClientIds } = useQuery({
    queryKey: ["campaigner-client-ids", campaignerId],
    queryFn: async () => {
      if (!campaignerId) return null;
      const { data } = await supabase
        .from("client_team")
        .select("client_id")
        .eq("campaigner_id", campaignerId);
      return data?.map(ct => ct.client_id) || [];
    },
    enabled: !!campaignerId && isCampaigner && !isTeamManager && !isOwner,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ clientId, status }: { clientId: string; status: "active" | "paused" | "ended" | "onboarding" }) => {
      const { error } = await supabase
        .from("clients")
        .update({ status })
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הסטטוס עודכן בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: () => {
      toast.error("שגיאה בעדכון הסטטוס");
    },
  });

  const assignCampaignerMutation = useMutation({
    mutationFn: async ({ clientId, campaignerId }: { clientId: string; campaignerId: string }) => {
      // First, check if already assigned
      const { data: existing } = await supabase
        .from("client_team")
        .select("id")
        .eq("client_id", clientId)
        .eq("campaigner_id", campaignerId)
        .maybeSingle();

      if (existing) {
        toast.info("הקמפיינר כבר משויך ללקוח");
        return;
      }

      // Add new assignment
      const { error } = await supabase
        .from("client_team")
        .insert({
          client_id: clientId,
          campaigner_id: campaignerId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הקמפיינר שויך בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: () => {
      toast.error("שגיאה בשיוך הקמפיינר");
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הלקוח נמחק בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setDeletingClient(null);
    },
    onError: () => {
      toast.error("שגיאה במחיקת הלקוח");
    },
  });

  const updateFolderLinkMutation = useMutation({
    mutationFn: async ({ clientId, folderLink }: { clientId: string; folderLink: string }) => {
      const { error } = await supabase
        .from("clients")
        .update({ folder_link: folderLink })
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("קישור התיקיה עודכן בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setEditingFolderLink(null);
    },
    onError: () => {
      toast.error("שגיאה בעדכון קישור התיקיה");
    },
  });

  // Filter logic:
  // 1. Role-based access control
  // 2. Then apply global agency filter (selectedAgency)
  
  let accessibleClients = clients;

  if (!isOwner) {
    if (isCampaigner && !isTeamManager && Array.isArray(campaignerClientIds) && campaignerClientIds.length > 0) {
      // Pure campaigners see only their assigned clients
      accessibleClients = clients?.filter(client => 
        campaignerClientIds.includes(client.id)
      );
    } else if (isTeamManager && userAgencyIds && userAgencyIds.length > 0) {
      // Team managers see all clients in their agencies
      accessibleClients = clients?.filter(client => 
        userAgencyIds.includes(client.agency_id)
      );
    }
  }
  // Owner sees all clients (no filtering needed)

  // Global agency filter applies to ALL roles (including campaigners and team managers)
  if (selectedAgency && selectedAgency !== "all") {
    accessibleClients = accessibleClients?.filter(
      (client) => client.agency_id === selectedAgency
    );
  }

  const filteredClients = accessibleClients;

  // Filter by selected campaigner (only for team managers and owners)
  const campaignerFilteredClients = selectedCampaigner && selectedCampaigner !== "all"
    ? filteredClients?.filter(client => {
        const hasMatch = clientTeam?.some(ct => ct.client_id === client.id && ct.campaigner_id === selectedCampaigner);
        return !!hasMatch;
      })
    : filteredClients;

  const searchedClients = searchTerm 
    ? campaignerFilteredClients?.filter(client => 
        client.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : campaignerFilteredClients;

  const visibleClients = hideInactive 
    ? searchedClients?.filter(client => client.status === "active" || client.status === "onboarding")
    : searchedClients;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success/10 text-success border-success/20";
      case "onboarding":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "paused":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "ended":
        return "bg-muted text-muted-foreground border-border";
      default:
        return "";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "פעיל";
      case "onboarding":
        return "בקליטה";
      case "paused":
        return "מושהה";
      case "ended":
        return "הסתיים";
      default:
        return status;
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">טוען...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">לקוחות</h2>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-4 items-center">
          <div className="relative min-w-[200px]">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="חפש לקוח..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-9"
            />
          </div>
          
          {/* Campaigner Filter - Only for team managers and owners */}
          {(isTeamManager || isOwner) && (
            <>
              <div className="h-8 w-px bg-border"></div>
              <Select value={selectedCampaigner} onValueChange={setSelectedCampaigner}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="כל הקמפיינרים" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הקמפיינרים</SelectItem>
                  {campaigners?.map((campaigner) => (
                    <SelectItem key={campaigner.id} value={campaigner.id}>
                      {campaigner.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          
          <div className="h-8 w-px bg-border"></div>
          <div className="flex gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
            >
              <TableIcon className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="h-8 w-px bg-border"></div>
          
          <div className="flex items-center gap-2" dir="ltr">
            <Label htmlFor="hide-inactive" className="cursor-pointer">
              הסתר לא פעילים
            </Label>
            <Switch
              id="hide-inactive"
              checked={hideInactive}
              onCheckedChange={setHideInactive}
            />
          </div>
          
          <div className="h-8 w-px bg-border"></div>
          
          <ImportClientsCSV />
          <ImportClientsSheet />
          <AddClientForm />
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleClients?.map((client) => (
          <Card 
            key={client.id} 
            className="shadow-card hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer group relative"
            onClick={() => setEditingClient(client)}
          >
            <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <Button size="sm" variant="secondary">
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                  size="sm" 
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingClient(client);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Users className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{client.name}</CardTitle>
                    {client.agencies && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {client.agencies.name}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className={getStatusColor(client.status)}>
                  {getStatusText(client.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {canViewFinance() && client.retainer && (
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm">
                    <span className="text-muted-foreground">ריטיינר:</span>
                    <span className="font-medium mr-2">₪{Number(client.retainer).toLocaleString()}</span>
                    <span className="text-muted-foreground">לחודש</span>
                  </div>
                </div>
              )}
              {client.website && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  <a href={client.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                    {client.website}
                  </a>
                </div>
              )}

              {client.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <a href={`tel:${client.phone}`} className="hover:text-primary">
                    {client.phone}
                  </a>
                </div>
              )}

              {client.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <a href={`mailto:${client.email}`} className="hover:text-primary">
                    {client.email}
                  </a>
                </div>
              )}

              {client.client_team && client.client_team.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-1">קמפיינרים משויכים:</p>
                  <div className="flex flex-wrap gap-1">
                    {client.client_team.map((ct: any, index: number) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {ct?.campaigners?.full_name ?? "—"}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                <p className="text-sm text-muted-foreground">שנה סטטוס:</p>
                <Select
                  value={client.status}
                  onValueChange={(value: "active" | "paused" | "ended" | "onboarding") => 
                    updateStatusMutation.mutate({ clientId: client.id, status: value })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background" align="end">
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-success"></div>
                        פעיל
                      </div>
                    </SelectItem>
                    <SelectItem value="onboarding">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                        בקליטה
                      </div>
                    </SelectItem>
                    <SelectItem value="paused">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                        מושהה
                      </div>
                    </SelectItem>
                    <SelectItem value="ended">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground"></div>
                        הסתיים
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="pt-2 border-t space-y-2">
                <p className="text-sm text-muted-foreground">קישור לתיקיה:</p>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Input
                    type="text"
                    placeholder="הזן קישור לתיקיה..."
                    value={editingFolderLink?.clientId === client.id ? editingFolderLink.link : (client.folder_link || "")}
                    onChange={(e) => setEditingFolderLink({ clientId: client.id, link: e.target.value })}
                    className="h-9 text-sm"
                  />
                  {editingFolderLink?.clientId === client.id && editingFolderLink.link !== (client.folder_link || "") && (
                    <Button
                      size="sm"
                      onClick={() => updateFolderLinkMutation.mutate({ 
                        clientId: client.id, 
                        folderLink: editingFolderLink.link 
                      })}
                      disabled={updateFolderLinkMutation.isPending}
                    >
                      שמור
                    </Button>
                  )}
                  {client.folder_link && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(client.folder_link, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Hide add campaigner option for pure campaigners */}
              {!(isCampaigner && !isTeamManager && !isOwner) && (
                <div className="pt-2 border-t space-y-2">
                  <p className="text-sm text-muted-foreground">הוסף קמפיינר:</p>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Select
                      onValueChange={(value) => assignCampaignerMutation.mutate({ clientId: client.id, campaignerId: value })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="בחר קמפיינר" />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        {campaigners?.map((campaigner) => (
                          <SelectItem key={campaigner.id} value={campaigner.id}>
                            {campaigner.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              
              <div className="pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                <AddTaskForm 
                  clientId={client.id} 
                  agencyId={client.agency_id}
                  triggerButton={
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      הוסף משימה
                    </Button>
                  }
                />
              </div>
            </CardContent>
          </Card>
        ))}
        </div>
      ) : (
        <div className="bg-card rounded-lg border shadow-sm overflow-x-auto">
          <Table className="relative">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
                <TableHead className="text-right font-semibold h-12">פעולות</TableHead>
                <TableHead className="text-right font-semibold">שם</TableHead>
                <TableHead className="text-right font-semibold">סוכנות</TableHead>
                <TableHead className="text-right font-semibold">סטטוס</TableHead>
                <TableHead className="text-right font-semibold">ריטיינר</TableHead>
                <TableHead className="text-right font-semibold">תקציב חודשי</TableHead>
                <TableHead className="text-right font-semibold">טלפון</TableHead>
                <TableHead className="text-right font-semibold">אימייל</TableHead>
                <TableHead className="text-right font-semibold">אתר</TableHead>
                <TableHead className="text-right font-semibold">תיקיה</TableHead>
                <TableHead className="text-right font-semibold">קמפיינרים</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleClients?.map((client) => (
                <TableRow 
                  key={client.id}
                  className="hover:bg-accent/5 transition-colors border-b border-border/50"
                >
                  <TableCell className="py-4">
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => setEditingClient(client)}
                        className="h-8 w-8 p-0 hover:bg-accent/20"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm" 
                        variant="ghost"
                        onClick={() => setDeletingClient(client)}
                        className="h-8 w-8 p-0 hover:bg-destructive/20 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold py-4">{client.name}</TableCell>
                  <TableCell className="py-4">
                    {client.agencies ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        <span>{client.agencies.name}</span>
                      </div>
                    ) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="py-4">
                    <Select
                      value={client.status}
                      onValueChange={(value: "active" | "paused" | "ended" | "onboarding") => 
                        updateStatusMutation.mutate({ clientId: client.id, status: value })
                      }
                    >
                      <SelectTrigger className="w-[140px] h-9 bg-background hover:bg-accent/10 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        <SelectItem value="active">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-success"></div>
                            פעיל
                          </div>
                        </SelectItem>
                        <SelectItem value="onboarding">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                            בקליטה
                          </div>
                        </SelectItem>
                        <SelectItem value="paused">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                            מושהה
                          </div>
                        </SelectItem>
                        <SelectItem value="ended">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-muted-foreground"></div>
                            הסתיים
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-4">
                    {canViewFinance() && client.retainer ? (
                      <div className="flex items-center gap-1 font-medium">
                        <Coins className="h-4 w-4 text-muted-foreground" />
                        <span>₪{Number(client.retainer).toLocaleString()}</span>
                      </div>
                    ) : canViewFinance() ? <span className="text-muted-foreground">-</span> : <span className="text-muted-foreground">מוסתר</span>}
                  </TableCell>

                  <TableCell className="py-4">
                    {canViewFinance() && client.monthly_budget ? (
                      <div className="flex items-center gap-1 font-medium">
                        <Coins className="h-4 w-4 text-muted-foreground" />
                        <span>₪{Number(client.monthly_budget).toLocaleString()}</span>
                      </div>
                    ) : canViewFinance() ? <span className="text-muted-foreground">-</span> : <span className="text-muted-foreground">מוסתר</span>}
                  </TableCell>
                  <TableCell className="py-4">
                    {client.phone ? (
                      <a 
                        href={`tel:${client.phone}`} 
                        className="flex items-center gap-2 hover:text-primary transition-colors text-sm"
                      >
                        <Phone className="h-4 w-4" />
                        <span>{client.phone}</span>
                      </a>
                    ) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="py-4">
                    {client.email ? (
                      <a 
                        href={`mailto:${client.email}`} 
                        className="flex items-center gap-2 hover:text-primary transition-colors text-sm"
                      >
                        <Mail className="h-4 w-4" />
                        <span>{client.email}</span>
                      </a>
                    ) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="py-4">
                    {client.website ? (
                      <a 
                        href={client.website} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-2 hover:text-primary transition-colors text-sm"
                      >
                        <Globe className="h-4 w-4" />
                        <span>קישור</span>
                      </a>
                    ) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex gap-2 min-w-[200px]">
                      <Input
                        type="text"
                        placeholder="קישור לתיקיה..."
                        value={editingFolderLink?.clientId === client.id ? editingFolderLink.link : (client.folder_link || "")}
                        onChange={(e) => setEditingFolderLink({ clientId: client.id, link: e.target.value })}
                        className="h-8 text-sm"
                      />
                      {editingFolderLink?.clientId === client.id && editingFolderLink.link !== (client.folder_link || "") && (
                        <Button
                          size="sm"
                          onClick={() => updateFolderLinkMutation.mutate({ 
                            clientId: client.id, 
                            folderLink: editingFolderLink.link 
                          })}
                          disabled={updateFolderLinkMutation.isPending}
                          className="h-8"
                        >
                          שמור
                        </Button>
                      )}
                      {client.folder_link && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(client.folder_link, "_blank")}
                          className="h-8 w-8 p-0"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex flex-col gap-2 min-w-[180px]">
                      {client.client_team && client.client_team.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {client.client_team.map((ct: any, idx: number) => (
                            <Badge 
                              key={idx} 
                              variant="secondary" 
                              className="text-xs bg-primary/10 text-primary hover:bg-primary/20"
                            >
                              {ct.campaigners.full_name}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {/* Hide add campaigner option for pure campaigners */}
                      {!(isCampaigner && !isTeamManager && !isOwner) && (
                        <Select
                          onValueChange={(value) => assignCampaignerMutation.mutate({ clientId: client.id, campaignerId: value })}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background hover:bg-accent/10 transition-colors">
                            <SelectValue placeholder="+ הוסף קמפיינר" />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            {campaigners?.map((campaigner) => (
                              <SelectItem key={campaigner.id} value={campaigner.id}>
                                {campaigner.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {visibleClients?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">לא נמצאו לקוחות</p>
            <p className="text-muted-foreground">התחל בהוספת לקוח חדש</p>
          </CardContent>
        </Card>
      )}
      
      {editingClient && (
        <EditClientDialog
          client={editingClient}
          open={!!editingClient}
          onOpenChange={(open) => !open && setEditingClient(null)}
        />
      )}

      <AlertDialog open={!!deletingClient} onOpenChange={(open) => !open && setDeletingClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>אישור מחיקת לקוח</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את הלקוח <strong>{deletingClient?.name}</strong>?
              פעולה זו תמחק גם את כל המשימות והנתונים הקשורים ללקוח זה ולא ניתן לבטל אותה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingClient && deleteClientMutation.mutate(deletingClient.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              מחק לקוח
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
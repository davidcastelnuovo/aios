import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, Globe, DollarSign, Phone, Mail, LayoutGrid, Table as TableIcon, Edit } from "lucide-react";
import { AddClientForm } from "@/components/forms/AddClientForm";
import { ImportClientsSheet } from "@/components/forms/ImportClientsSheet";
import { ImportClientsCSV } from "@/components/forms/ImportClientsCSV";
import { EditClientDialog } from "@/components/forms/EditClientDialog";
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

export default function Clients() {
  const [selectedAgency, setSelectedAgency] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [editingClient, setEditingClient] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(`
          *,
          agencies (name),
          client_team (
            campaigners (full_name)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: agencies } = useQuery({
    queryKey: ["agencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: campaigners } = useQuery({
    queryKey: ["campaigners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigners")
        .select("id, full_name")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ clientId, status }: { clientId: string; status: "active" | "paused" | "ended" }) => {
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

  const filteredClients = selectedAgency === "all" 
    ? clients 
    : clients?.filter(client => client.agency_id === selectedAgency);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success/10 text-success border-success/20";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold">לקוחות</h2>
          <p className="text-muted-foreground mt-1">ניהול לקוחות סוכנויות</p>
        </div>
        <div className="flex gap-2 items-center">
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
          <Select value={selectedAgency} onValueChange={setSelectedAgency}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="כל הסוכנויות" />
            </SelectTrigger>
            <SelectContent className="bg-background">
              <SelectItem value="all">כל הסוכנויות</SelectItem>
              {agencies?.map((agency) => (
                <SelectItem key={agency.id} value={agency.id}>
                  {agency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ImportClientsCSV />
          <ImportClientsSheet />
          <AddClientForm />
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients?.map((client) => (
          <Card 
            key={client.id} 
            className="shadow-card hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer group relative"
            onClick={() => setEditingClient(client)}
          >
            <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="sm" variant="secondary">
                <Edit className="h-4 w-4" />
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
                <div className="flex flex-col gap-2">
                  <Select
                    value={client.status}
                    onValueChange={(value: "active" | "paused" | "ended") => 
                      updateStatusMutation.mutate({ clientId: client.id, status: value })
                    }
                  >
                    <SelectTrigger className="w-[140px]" onClick={(e) => e.stopPropagation()}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      <SelectItem value="active">
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                          פעיל
                        </Badge>
                      </SelectItem>
                      <SelectItem value="paused">
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                          מושהה
                        </Badge>
                      </SelectItem>
                      <SelectItem value="ended">
                        <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                          הסתיים
                        </Badge>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {client.industry && (
                <div className="text-sm">
                  <span className="text-muted-foreground">תעשייה:</span>
                  <span className="font-medium mr-2">{client.industry}</span>
                </div>
              )}
              {client.monthly_budget && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">₪{Number(client.monthly_budget).toLocaleString()}</span>
                  <span className="text-muted-foreground">לחודש</span>
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
                  <p className="text-sm text-muted-foreground mb-1">קמפיינרים:</p>
                  <div className="flex flex-wrap gap-1">
                    {client.client_team.map((ct: any, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {ct.campaigners.full_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="pt-2 border-t">
                <Select
                  onValueChange={(value) => assignCampaignerMutation.mutate({ clientId: client.id, campaignerId: value })}
                >
                  <SelectTrigger onClick={(e) => e.stopPropagation()}>
                    <SelectValue placeholder="הוסף קמפיינר" />
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
            </CardContent>
          </Card>
        ))}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">פעולות</TableHead>
                <TableHead className="text-right">שם</TableHead>
                <TableHead className="text-right">סוכנות</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">תעשייה</TableHead>
                <TableHead className="text-right">תקציב חודשי</TableHead>
                <TableHead className="text-right">טלפון</TableHead>
                <TableHead className="text-right">אימייל</TableHead>
                <TableHead className="text-right">אתר</TableHead>
                <TableHead className="text-right">קמפיינרים</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients?.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => setEditingClient(client)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>
                    {client.agencies ? (
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        {client.agencies.name}
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={client.status}
                      onValueChange={(value: "active" | "paused" | "ended") => 
                        updateStatusMutation.mutate({ clientId: client.id, status: value })
                      }
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        <SelectItem value="active">פעיל</SelectItem>
                        <SelectItem value="paused">מושהה</SelectItem>
                        <SelectItem value="ended">הסתיים</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{client.industry || "-"}</TableCell>
                  <TableCell>
                    {client.monthly_budget ? (
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        ₪{Number(client.monthly_budget).toLocaleString()}
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    {client.phone ? (
                      <a href={`tel:${client.phone}`} className="flex items-center gap-1 hover:text-primary">
                        <Phone className="h-3 w-3" />
                        {client.phone}
                      </a>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    {client.email ? (
                      <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:text-primary">
                        <Mail className="h-3 w-3" />
                        {client.email}
                      </a>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    {client.website ? (
                      <a 
                        href={client.website} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-1 hover:text-primary"
                      >
                        <Globe className="h-3 w-3" />
                        קישור
                      </a>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      {client.client_team && client.client_team.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {client.client_team.map((ct: any, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {ct.campaigners.full_name}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <Select
                        onValueChange={(value) => assignCampaignerMutation.mutate({ clientId: client.id, campaignerId: value })}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="הוסף קמפיינר" />
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {filteredClients?.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">אין לקוחות</h3>
            <p className="text-sm text-muted-foreground">התחל בהוספת לקוח ראשון</p>
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
    </div>
  );
}
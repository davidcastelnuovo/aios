import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTenant } from "@/contexts/TenantContext";
import { useAgency } from "@/contexts/AgencyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  Package, 
  UserCheck, 
  Search, 
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign
} from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

export default function AccountingIntegrations() {
  const { tenantId } = useCurrentTenant();
  const { currentTenantId } = useTenant();
  const { selectedAgency } = useAgency();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("clients");
  const [agencyFilter, setAgencyFilter] = useState<string>("all");
  const [clientStatusFilter, setClientStatusFilter] = useState<string>("active_relevant");

  // Fetch agencies
  const { data: agencies } = useQuery({
    queryKey: ["agencies", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("tenant_id", currentTenantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  // Fetch clients with financial data from client_tenant_financial_data
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["accounting-clients", currentTenantId, selectedAgency],
    queryFn: async () => {
      if (!currentTenantId) return [];
      
      let query = supabase
        .from("clients")
        .select(`
          id,
          name,
          contact_name,
          status,
          retainer,
          monthly_budget,
          agency_id,
          updated_at,
          agencies (id, name)
        `)
        .eq("tenant_id", currentTenantId);

      if (selectedAgency && selectedAgency !== "all") {
        query = query.eq("agency_id", selectedAgency);
      }

      const { data: clientsData, error } = await query;
      if (error) throw error;
      
      // Fetch tenant-specific financial data
      const clientIds = (clientsData || []).map(c => c.id);
      const { data: financialData } = await supabase
        .from("client_tenant_financial_data")
        .select("client_id, retainer, monthly_budget")
        .eq("tenant_id", currentTenantId)
        .in("client_id", clientIds);
      
      // Create a map for quick lookup
      const financialMap = new Map(
        (financialData || []).map(f => [f.client_id, f])
      );
      
      // Map data to use financial data from tenant-specific table
      return (clientsData || []).map(client => ({
        ...client,
        retainer: financialMap.get(client.id)?.retainer ?? client.retainer,
        monthly_budget: financialMap.get(client.id)?.monthly_budget ?? client.monthly_budget,
      }));
    },
    enabled: !!currentTenantId,
  });

  // Fetch suppliers
  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: ["accounting-suppliers", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data, error } = await supabase
        .from("suppliers")
        .select(`
          id,
          name,
          phone,
          email,
          type,
          agency_id_1,
          agency_id_2,
          agency_id_3,
          payment_1,
          payment_2,
          payment_3
        `)
        .eq("tenant_id", currentTenantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  // Fetch campaigners (team)
  const { data: campaigners, isLoading: campaignersLoading } = useQuery({
    queryKey: ["accounting-campaigners", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data, error } = await supabase
        .from("campaigners")
        .select(`
          id,
          full_name,
          email,
          phone,
          role,
          active,
          campaigner_agencies (
            agency_id,
            agencies (id, name)
          )
        `)
        .eq("tenant_id", currentTenantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  // Fetch sales people
  const { data: salesPeople, isLoading: salesPeopleLoading } = useQuery({
    queryKey: ["accounting-salespeople", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data, error } = await supabase
        .from("sales_people")
        .select(`
          id,
          full_name,
          email,
          phone,
          active,
          agencies (id, name)
        `)
        .eq("tenant_id", currentTenantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  // Fetch finance summary
  const { data: financeData } = useQuery({
    queryKey: ["finance-summary", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return { income: 0, expenses: 0 };
      
      const { data, error } = await supabase
        .from("finance")
        .select("amount, type")
        .eq("tenant_id", currentTenantId);
      
      if (error) throw error;
      
      const income = data?.filter(f => f.type === "income").reduce((sum, f) => sum + f.amount, 0) || 0;
      const expenses = data?.filter(f => f.type === "expense").reduce((sum, f) => sum + f.amount, 0) || 0;
      
      return { income, expenses };
    },
    enabled: !!currentTenantId,
  });

  // Filter functions
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return clients.filter(client => {
      const matchesSearch = 
        client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.contact_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAgency = agencyFilter === "all" || client.agency_id === agencyFilter;
      
      // Status filter logic
      let matchesStatus = true;
      if (clientStatusFilter === "active_relevant") {
        // Show active, onboarding, OR paused that changed in last 30 days
        const isActiveOrOnboarding = client.status === "active" || client.status === "onboarding";
        const isPausedRecently = client.status === "paused" && 
          client.updated_at && new Date(client.updated_at) >= thirtyDaysAgo;
        matchesStatus = isActiveOrOnboarding || isPausedRecently;
      } else if (clientStatusFilter !== "all") {
        matchesStatus = client.status === clientStatusFilter;
      }
      
      return matchesSearch && matchesAgency && matchesStatus;
    });
  }, [clients, searchQuery, agencyFilter, clientStatusFilter]);

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    return suppliers.filter(supplier => {
      const matchesSearch = supplier.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAgency = agencyFilter === "all" || 
        supplier.agency_id_1 === agencyFilter ||
        supplier.agency_id_2 === agencyFilter ||
        supplier.agency_id_3 === agencyFilter;
      return matchesSearch && matchesAgency;
    });
  }, [suppliers, searchQuery, agencyFilter]);

  const filteredTeam = useMemo(() => {
    if (!campaigners) return [];
    return campaigners.filter(member => {
      const matchesSearch = member.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAgency = agencyFilter === "all" || 
        member.campaigner_agencies?.some((ca: any) => ca.agency_id === agencyFilter);
      return matchesSearch && matchesAgency;
    });
  }, [campaigners, searchQuery, agencyFilter]);

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "-";
    return `₪${amount.toLocaleString("he-IL")}`;
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      active: { variant: "default", label: "פעיל" },
      inactive: { variant: "secondary", label: "לא פעיל" },
      pending: { variant: "outline", label: "ממתין" },
    };
    const config = statusMap[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getAgencyName = (agencyId: string | null) => {
    if (!agencyId || !agencies) return "-";
    const agency = agencies.find(a => a.id === agencyId);
    return agency?.name || "-";
  };

  const profit = (financeData?.income || 0) - (financeData?.expenses || 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">הנהלת חשבונות</h1>
        <p className="text-muted-foreground mt-2">
          ניהול פיננסי של לקוחות, ספקים וצוות
        </p>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">הכנסות</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(financeData?.income || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">הוצאות</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(financeData?.expenses || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">רווח</CardTitle>
            <DollarSign className={`h-4 w-4 ${profit >= 0 ? "text-green-600" : "text-red-600"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(profit)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <Select value={agencyFilter} onValueChange={setAgencyFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <Building2 className="h-4 w-4 ml-2" />
                <SelectValue placeholder="כל הסוכנויות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסוכנויות</SelectItem>
                {agencies?.map((agency) => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedTab === "clients" && (
              <Select value={clientStatusFilter} onValueChange={setClientStatusFilter}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <Users className="h-4 w-4 ml-2" />
                  <SelectValue placeholder="סטטוס לקוחות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active_relevant">פעילים + עזבו ב-30 יום</SelectItem>
                  <SelectItem value="all">כל הסטטוסים</SelectItem>
                  <SelectItem value="active">פעילים בלבד</SelectItem>
                  <SelectItem value="onboarding">בקליטה</SelectItem>
                  <SelectItem value="paused">מושהים</SelectItem>
                  <SelectItem value="ended">סיימו</SelectItem>
                </SelectContent>
              </Select>
            )}
            
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} dir="rtl">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            לקוחות ({filteredClients.length})
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            ספקים ({filteredSuppliers.length})
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            צוות ({filteredTeam.length})
          </TabsTrigger>
        </TabsList>

        {/* Clients Tab */}
        <TabsContent value="clients">
          <Card>
            <CardContent className="pt-6">
              {clientsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">שם לקוח</TableHead>
                        <TableHead className="text-right">סוכנות</TableHead>
                        <TableHead className="text-right">ריטיינר חודשי</TableHead>
                        <TableHead className="text-right">תקציב חודשי</TableHead>
                        <TableHead className="text-right">סטטוס</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClients.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            לא נמצאו לקוחות
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredClients.map((client) => (
                          <TableRow key={client.id}>
                            <TableCell className="font-medium text-right">{client.name}</TableCell>
                            <TableCell className="text-right">{(client.agencies as any)?.name || "-"}</TableCell>
                            <TableCell className="text-right">{formatCurrency(client.retainer)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(client.monthly_budget)}</TableCell>
                            <TableCell className="text-right">{getStatusBadge(client.status)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers">
          <Card>
            <CardContent className="pt-6">
              {suppliersLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">שם ספק</TableHead>
                        <TableHead className="text-right">סוג</TableHead>
                        <TableHead className="text-right">סוכנות 1</TableHead>
                        <TableHead className="text-right">תשלום 1</TableHead>
                        <TableHead className="text-right">סוכנות 2</TableHead>
                        <TableHead className="text-right">תשלום 2</TableHead>
                        <TableHead className="text-right">סוכנות 3</TableHead>
                        <TableHead className="text-right">תשלום 3</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSuppliers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground">
                            לא נמצאו ספקים
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredSuppliers.map((supplier) => (
                          <TableRow key={supplier.id}>
                            <TableCell className="font-medium text-right">{supplier.name}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline">{supplier.type}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{getAgencyName(supplier.agency_id_1)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(supplier.payment_1)}</TableCell>
                            <TableCell className="text-right">{getAgencyName(supplier.agency_id_2)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(supplier.payment_2)}</TableCell>
                            <TableCell className="text-right">{getAgencyName(supplier.agency_id_3)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(supplier.payment_3)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <Card>
            <CardContent className="pt-6">
              {campaignersLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">שם</TableHead>
                        <TableHead className="text-right">תפקיד</TableHead>
                        <TableHead className="text-right">סוכנויות</TableHead>
                        <TableHead className="text-right">אימייל</TableHead>
                        <TableHead className="text-right">טלפון</TableHead>
                        <TableHead className="text-right">סטטוס</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTeam.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            לא נמצאו חברי צוות
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTeam.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="font-medium text-right">{member.full_name}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap gap-1 justify-end">
                                {member.role?.map((r: string, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {r}
                                  </Badge>
                                )) || "-"}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap gap-1 justify-end">
                                {member.campaigner_agencies?.map((ca: any, i: number) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {ca.agencies?.name}
                                  </Badge>
                                )) || "-"}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{member.email || "-"}</TableCell>
                            <TableCell dir="ltr" className="text-left">{member.phone || "-"}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={member.active ? "default" : "secondary"}>
                                {member.active ? "פעיל" : "לא פעיל"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

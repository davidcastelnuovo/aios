import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Megaphone, DollarSign, TrendingUp, TrendingDown, CheckSquare } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgency } from "@/contexts/AgencyContext";
import { useUserAgencies } from "@/hooks/useUserAgencies";
import { useUserRole } from "@/hooks/useUserRole";

export default function Dashboard() {
  const { selectedAgency } = useAgency();
  const { userAgencyIds } = useUserAgencies();
  const { isOwner } = useUserRole();
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");

  const { data: agencies } = useQuery({
    queryKey: ["agencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, agency_id")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, related_campaigner_id")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", selectedAgency, selectedClient, selectedSupplier],
    queryFn: async () => {
      let agencyQuery = supabase.from("agencies").select("*", { count: "exact", head: true });
      let clientQuery = supabase.from("clients").select("*", { count: "exact", head: true });
      let campaignerQuery = supabase.from("campaigners").select("*", { count: "exact", head: true });
      let taskQuery = supabase.from("tasks").select("*").eq("status", "open");
      let activeClientsQuery = supabase.from("clients").select("id, retainer, agency_id").eq("status", "active");
      
      // אם בחרנו ספק, נמצא את הקמפיינר הקשור אליו
      let relatedCampaignerId = null;
      if (selectedSupplier !== "all") {
        const selectedSupplierData = suppliers?.find(s => s.id === selectedSupplier);
        relatedCampaignerId = selectedSupplierData?.related_campaigner_id;
      }
      
      // קודם כל מביאים את client_team אם צריך לסנן לפי ספק (דרך הקמפיינר)
      let clientTeamData = null;
      if (relatedCampaignerId) {
        const { data } = await supabase
          .from("client_team")
          .select("client_id")
          .eq("campaigner_id", relatedCampaignerId);
        clientTeamData = data;
      }

      // עכשיו אנחנו יכולים לסנן את הקווריז בהתאם
      if (selectedAgency !== "all") {
        agencyQuery = agencyQuery.eq("id", selectedAgency);
        clientQuery = clientQuery.eq("agency_id", selectedAgency);
        taskQuery = taskQuery.eq("agency_id", selectedAgency);
        activeClientsQuery = activeClientsQuery.eq("agency_id", selectedAgency);
      }

      if (selectedClient !== "all") {
        taskQuery = taskQuery.eq("client_id", selectedClient);
        activeClientsQuery = activeClientsQuery.eq("id", selectedClient);
      }

      if (selectedSupplier !== "all" && clientTeamData) {
        taskQuery = taskQuery.eq("campaigner_id", relatedCampaignerId);
        
        // סינון לקוחות לפי client_team
        if (clientTeamData.length > 0) {
          const campaignerClientIds = clientTeamData.map(ct => ct.client_id);
          activeClientsQuery = activeClientsQuery.in("id", campaignerClientIds);
        }
      }

      const [agenciesData, clientsData, campaignersData, tasks, activeClients] = await Promise.all([
        agencyQuery,
        clientQuery,
        campaignerQuery,
        taskQuery,
        activeClientsQuery,
      ]);

      // עכשיו שואלים את finance עם הסינון הנכון
      let financeQuery = supabase.from("finance").select("type, amount, client_id");
      
      if (selectedAgency !== "all") {
        financeQuery = financeQuery.eq("agency_id", selectedAgency);
      }
      
      if (selectedClient !== "all") {
        financeQuery = financeQuery.eq("client_id", selectedClient);
      } else if (selectedSupplier !== "all") {
        // אם מסננים לפי ספק, ההכנסות מסוננות לפי לקוחות הקמפיינר וההוצאות לפי supplier_id
        if (clientTeamData && clientTeamData.length > 0) {
          const campaignerClientIds = clientTeamData.map(ct => ct.client_id);
          financeQuery = financeQuery.in("client_id", campaignerClientIds);
        } else {
          // אם אין לקוחות קשורים, לא להציג שום finance
          financeQuery = financeQuery.eq("client_id", "00000000-0000-0000-0000-000000000000");
        }
      }
      
      const { data: financeData } = await financeQuery;

      const financeIncome = financeData?.filter(f => f.type === "income").reduce((sum, f) => sum + Number(f.amount), 0) || 0;
      const retainers = activeClients.data?.reduce((sum, client) => sum + Number(client.retainer || 0), 0) || 0;
      const totalIncome = financeIncome + retainers;
      
      const financeExpense = financeData?.filter(f => f.type === "expense").reduce((sum, f) => sum + Number(f.amount), 0) || 0;
      
      
      // משיכת תשלומים ידניים מספקים
      let suppliersQuery = supabase
        .from("suppliers")
        .select("id, payment_1, payment_2, payment_3, agency_id_1, agency_id_2, agency_id_3");
      
      if (selectedSupplier !== "all") {
        suppliersQuery = suppliersQuery.eq("id", selectedSupplier);
      }

      const { data: suppliersData } = await suppliersQuery;
      let manualSupplierPayments = 0;
      
      suppliersData?.forEach(supplier => {
        if (selectedAgency === "all") {
          manualSupplierPayments += Number(supplier.payment_1 || 0) + Number(supplier.payment_2 || 0) + Number(supplier.payment_3 || 0);
        } else {
          if (supplier.agency_id_1 === selectedAgency) manualSupplierPayments += Number(supplier.payment_1 || 0);
          if (supplier.agency_id_2 === selectedAgency) manualSupplierPayments += Number(supplier.payment_2 || 0);
          if (supplier.agency_id_3 === selectedAgency) manualSupplierPayments += Number(supplier.payment_3 || 0);
        }
      });
      
      const totalExpense = financeExpense + manualSupplierPayments;

      return {
        agenciesCount: agenciesData.count || 0,
        clientsCount: clientsData.count || 0,
        campaignersCount: campaignersData.count || 0,
        openTasksCount: tasks.data?.length || 0,
        income: totalIncome,
        expense: totalExpense,
        profit: totalIncome - totalExpense,
      };
    },
  });

  const statCards = [
    {
      title: "סוכנויות פעילות",
      value: stats?.agenciesCount || 0,
      icon: Building2,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "לקוחות",
      value: stats?.clientsCount || 0,
      icon: Users,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      title: "קמפיינרים",
      value: stats?.campaignersCount || 0,
      icon: Megaphone,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      title: "משימות פתוחות",
      value: stats?.openTasksCount || 0,
      icon: CheckSquare,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
  ];

  // First filter by user's accessible agencies
  const accessibleClients = !isOwner && userAgencyIds && userAgencyIds.length > 0
    ? clients?.filter(c => userAgencyIds.includes(c.agency_id))
    : clients;

  // Then filter by selected agency
  const filteredClients = selectedAgency === "all" 
    ? accessibleClients 
    : accessibleClients?.filter(c => c.agency_id === selectedAgency);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-3xl font-bold">דשבורד</h2>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="כל הלקוחות" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="all">כל הלקוחות</SelectItem>
            {filteredClients?.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="כל הספקים" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="all">כל הספקים</SelectItem>
            {suppliers?.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="shadow-card hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Financial Overview */}
      {(
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <Card className="shadow-card min-w-0">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">הכנסות חודשיות</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                ₪{stats?.income.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">הוצאות חודשיות</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                ₪{stats?.expense.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">רווח</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(stats?.profit || 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                ₪{stats?.profit.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
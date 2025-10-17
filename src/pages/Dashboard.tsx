import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Megaphone, DollarSign, TrendingUp, TrendingDown, CheckSquare } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


export default function Dashboard() {
  const [selectedAgency, setSelectedAgency] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedCampaigner, setSelectedCampaigner] = useState<string>("all");

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

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", selectedAgency, selectedClient, selectedCampaigner],
    queryFn: async () => {
      let agencyQuery = supabase.from("agencies").select("*", { count: "exact", head: true });
      let clientQuery = supabase.from("clients").select("*", { count: "exact", head: true });
      let campaignerQuery = supabase.from("campaigners").select("*", { count: "exact", head: true });
      let taskQuery = supabase.from("tasks").select("*").eq("status", "open");
      let financeQuery = supabase.from("finance").select("type, amount, client_id");
      let activeClientsQuery = supabase.from("clients").select("id, retainer, agency_id").eq("status", "active");
      let suppliersQuery = supabase.from("suppliers").select("payment_1, payment_2, payment_3, agency_id_1, agency_id_2, agency_id_3, related_campaigner_id");
      let clientTeamQuery = supabase.from("client_team").select("client_id, campaigner_id");

      if (selectedAgency !== "all") {
        agencyQuery = agencyQuery.eq("id", selectedAgency);
        clientQuery = clientQuery.eq("agency_id", selectedAgency);
        taskQuery = taskQuery.eq("agency_id", selectedAgency);
        financeQuery = financeQuery.eq("agency_id", selectedAgency);
        activeClientsQuery = activeClientsQuery.eq("agency_id", selectedAgency);
      }

      if (selectedClient !== "all") {
        taskQuery = taskQuery.eq("client_id", selectedClient);
        financeQuery = financeQuery.eq("client_id", selectedClient);
        activeClientsQuery = activeClientsQuery.eq("id", selectedClient);
      }

      if (selectedCampaigner !== "all") {
        taskQuery = taskQuery.eq("campaigner_id", selectedCampaigner);
        clientTeamQuery = clientTeamQuery.eq("campaigner_id", selectedCampaigner);
        suppliersQuery = suppliersQuery.eq("related_campaigner_id", selectedCampaigner);
      }

      const [agenciesData, clientsData, campaignersData, tasks, finance, activeClients, suppliers, clientTeam] = await Promise.all([
        agencyQuery,
        clientQuery,
        campaignerQuery,
        taskQuery,
        financeQuery,
        activeClientsQuery,
        suppliersQuery,
        clientTeamQuery,
      ]);

      // סינון לקוחות לפי קמפיינר
      let filteredClients = activeClients.data || [];
      if (selectedCampaigner !== "all" && clientTeam.data) {
        const campaignerClientIds = clientTeam.data.map(ct => ct.client_id);
        filteredClients = filteredClients.filter(client => campaignerClientIds.includes(client.id));
      }

      const financeIncome = finance.data?.filter(f => f.type === "income").reduce((sum, f) => sum + Number(f.amount), 0) || 0;
      const retainers = filteredClients.reduce((sum, client) => sum + Number(client.retainer || 0), 0);
      const totalIncome = financeIncome + retainers;
      
      const financeExpense = finance.data?.filter(f => f.type === "expense").reduce((sum, f) => sum + Number(f.amount), 0) || 0;
      
      let supplierPayments = 0;
      suppliers.data?.forEach(supplier => {
        if (selectedAgency === "all") {
          supplierPayments += Number(supplier.payment_1 || 0) + Number(supplier.payment_2 || 0) + Number(supplier.payment_3 || 0);
        } else {
          if (supplier.agency_id_1 === selectedAgency) supplierPayments += Number(supplier.payment_1 || 0);
          if (supplier.agency_id_2 === selectedAgency) supplierPayments += Number(supplier.payment_2 || 0);
          if (supplier.agency_id_3 === selectedAgency) supplierPayments += Number(supplier.payment_3 || 0);
        }
      });
      
      const totalExpense = financeExpense + supplierPayments;

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

  const filteredClients = selectedAgency === "all" 
    ? clients 
    : clients?.filter(c => c.agency_id === selectedAgency);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">דשבורד</h2>
        <p className="text-muted-foreground mt-1">מבט על על המערכת</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Select value={selectedAgency} onValueChange={setSelectedAgency}>
          <SelectTrigger>
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

        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger>
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

        <Select value={selectedCampaigner} onValueChange={setSelectedCampaigner}>
          <SelectTrigger>
            <SelectValue placeholder="כל הקמפיינרים" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="all">כל הקמפיינרים</SelectItem>
            {campaigners?.map((campaigner) => (
              <SelectItem key={campaigner.id} value={campaigner.id}>
                {campaigner.full_name}
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">הכנסות חודשיות</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
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
            <div className={`text-2xl font-bold ${(stats?.profit || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
              ₪{stats?.profit.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
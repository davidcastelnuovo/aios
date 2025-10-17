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
      let activeClientsQuery = supabase.from("clients").select("id, retainer, agency_id").eq("status", "active");
      
      // קודם כל מביאים את client_team אם צריך לסנן לפי קמפיינר
      let clientTeamData = null;
      if (selectedCampaigner !== "all") {
        const { data } = await supabase
          .from("client_team")
          .select("client_id")
          .eq("campaigner_id", selectedCampaigner);
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

      if (selectedCampaigner !== "all") {
        taskQuery = taskQuery.eq("campaigner_id", selectedCampaigner);
        
        // סינון לקוחות לפי client_team
        if (clientTeamData && clientTeamData.length > 0) {
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
      } else if (selectedCampaigner !== "all" && clientTeamData && clientTeamData.length > 0) {
        // אם מסננים לפי קמפיינר, מסננים לפי הלקוחות שלו
        const campaignerClientIds = clientTeamData.map(ct => ct.client_id);
        financeQuery = financeQuery.in("client_id", campaignerClientIds);
      }
      
      const { data: financeData } = await financeQuery;

      const financeIncome = financeData?.filter(f => f.type === "income").reduce((sum, f) => sum + Number(f.amount), 0) || 0;
      const retainers = activeClients.data?.reduce((sum, client) => sum + Number(client.retainer || 0), 0) || 0;
      const totalIncome = financeIncome + retainers;
      
      const financeExpense = financeData?.filter(f => f.type === "expense").reduce((sum, f) => sum + Number(f.amount), 0) || 0;
      
      // משיכת הוצאות מ-client_team (תשלומי קמפיינרים)
      let clientTeamQuery = supabase
        .from("client_team")
        .select(`
          campaigner_payment,
          clients!inner(agency_id)
        `)
        .not("campaigner_payment", "is", null);
      
      if (selectedAgency !== "all") {
        clientTeamQuery = clientTeamQuery.eq("clients.agency_id", selectedAgency);
      }
      
      if (selectedClient !== "all") {
        clientTeamQuery = clientTeamQuery.eq("client_id", selectedClient);
      }
      
      if (selectedCampaigner !== "all") {
        clientTeamQuery = clientTeamQuery.eq("campaigner_id", selectedCampaigner);
      }
      
      const { data: campaignerPaymentsData } = await clientTeamQuery;
      const campaignerPayments = campaignerPaymentsData?.reduce((sum, item) => sum + Number(item.campaigner_payment || 0), 0) || 0;
      
      // משיכת תשלומים ידניים מספקים
      let suppliersQuery = supabase
        .from("suppliers")
        .select("payment_1, payment_2, payment_3, agency_id_1, agency_id_2, agency_id_3");
      
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
      
      const totalExpense = financeExpense + campaignerPayments + manualSupplierPayments;

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
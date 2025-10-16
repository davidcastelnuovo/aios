import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Megaphone, DollarSign, TrendingUp, TrendingDown, CheckSquare } from "lucide-react";

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [agencies, clients, campaigners, tasks, finance] = await Promise.all([
        supabase.from("agencies").select("*", { count: "exact", head: true }),
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("campaigners").select("*", { count: "exact", head: true }),
        supabase.from("tasks").select("*").eq("status", "open"),
        supabase.from("finance").select("type, amount"),
      ]);

      const income = finance.data?.filter(f => f.type === "income").reduce((sum, f) => sum + Number(f.amount), 0) || 0;
      const expense = finance.data?.filter(f => f.type === "expense").reduce((sum, f) => sum + Number(f.amount), 0) || 0;

      return {
        agenciesCount: agencies.count || 0,
        clientsCount: clients.count || 0,
        campaignersCount: campaigners.count || 0,
        openTasksCount: tasks.data?.length || 0,
        income,
        expense,
        profit: income - expense,
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">דשבורד</h2>
        <p className="text-muted-foreground mt-1">מבט על על המערכת</p>
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
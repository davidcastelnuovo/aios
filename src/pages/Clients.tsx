import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, Globe, DollarSign } from "lucide-react";
import { AddClientForm } from "@/components/forms/AddClientForm";

export default function Clients() {
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">לקוחות</h2>
          <p className="text-muted-foreground mt-1">ניהול לקוחות סוכנויות</p>
        </div>
        <AddClientForm />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clients?.map((client) => (
          <Card key={client.id} className="shadow-card hover:shadow-lg transition-all hover:scale-[1.02]">
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
            </CardContent>
          </Card>
        ))}
      </div>

      {clients?.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">אין לקוחות</h3>
            <p className="text-sm text-muted-foreground">התחל בהוספת לקוח ראשון</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
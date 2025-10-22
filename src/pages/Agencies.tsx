import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Phone, Mail, Calendar } from "lucide-react";
import { AddAgencyForm } from "@/components/forms/AddAgencyForm";
import { useUserRole } from "@/hooks/useUserRole";

export default function Agencies() {
  const { isOwner, userId } = useUserRole();
  
  const { data: agencies, isLoading } = useQuery({
    queryKey: ["agencies-list", userId],
    queryFn: async () => {
      // Get current user's roles
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      
      const roles = userRoles?.map(r => r.role) || [];
      const isOwnerRole = roles.includes("owner");
      
      if (isOwnerRole) {
        // Owner sees all agencies
        const { data, error } = await supabase
          .from("agencies")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
      }
      return [];
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success/10 text-success border-success/20";
      case "paused":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "former":
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
      case "former":
        return "לשעבר";
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
          <h2 className="text-3xl font-bold">סוכנויות</h2>
          <p className="text-muted-foreground mt-1">ניהול סוכנויות לקוחות</p>
        </div>
        <AddAgencyForm />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agencies?.map((agency) => (
          <Card key={agency.id} className="shadow-card hover:shadow-lg transition-all hover:scale-[1.02]">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{agency.name}</CardTitle>
                    {agency.contact_name && (
                      <p className="text-sm text-muted-foreground">{agency.contact_name}</p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className={getStatusColor(agency.status)}>
                  {getStatusText(agency.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {agency.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span dir="ltr">{agency.phone}</span>
                </div>
              )}
              {agency.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{agency.email}</span>
                </div>
              )}
              {agency.start_date && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(agency.start_date).toLocaleDateString("he-IL")}</span>
                </div>
              )}
              {agency.notes && (
                <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                  {agency.notes}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {agencies?.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">אין סוכנויות</h3>
            <p className="text-sm text-muted-foreground">התחל בהוספת סוכנות ראשונה</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
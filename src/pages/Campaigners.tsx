import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Phone, Mail, Briefcase } from "lucide-react";
import { AddCampaignerForm } from "@/components/forms/AddCampaignerForm";

export default function Campaigners() {
  const { data: campaigners, isLoading } = useQuery({
    queryKey: ["campaigners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigners")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="flex justify-center p-8">טוען...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">קמפיינרים</h2>
          <p className="text-muted-foreground mt-1">ניהול צוות קמפיינרים ופרילנסרים</p>
        </div>
        <AddCampaignerForm />
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {campaigners?.map((campaigner) => (
          <Card key={campaigner.id} className="shadow-card hover:shadow-lg transition-all hover:scale-[1.02] min-w-0 overflow-hidden">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${campaigner.active ? 'bg-success/10' : 'bg-muted'}`}>
                    <Megaphone className={`h-5 w-5 ${campaigner.active ? 'text-success' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{campaigner.full_name}</CardTitle>
                    {campaigner.role && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {campaigner.role}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className={campaigner.active ? "bg-success/10 text-success border-success/20" : "bg-muted"}>
                  {campaigner.active ? "פעיל" : "לא פעיל"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 min-w-0">
              {campaigner.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span dir="ltr" className="truncate">{campaigner.phone}</span>
                </div>
              )}
              {campaigner.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{campaigner.email}</span>
                </div>
              )}
              {campaigner.notes && (
                <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                  {campaigner.notes}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {campaigners?.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">אין קמפיינרים</h3>
            <p className="text-sm text-muted-foreground">התחל בהוספת קמפיינר ראשון</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
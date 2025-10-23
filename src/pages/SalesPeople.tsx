import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, ExternalLink, Trash2 } from "lucide-react";
import { AddSalesPersonForm } from "@/components/forms/AddSalesPersonForm";
import { EditSalesPersonDialog } from "@/components/forms/EditSalesPersonDialog";
import { useToast } from "@/hooks/use-toast";
import { useAgency } from "@/contexts/AgencyContext";

export default function SalesPeople() {
  const { toast } = useToast();
  const { selectedAgency } = useAgency();

  const { data: salesPeople, isLoading, refetch } = useQuery({
    queryKey: ["sales-people", selectedAgency],
    queryFn: async () => {
      let query = supabase
        .from("sales_people")
        .select("*, agencies (name)")
        .order("created_at", { ascending: false });

      if (selectedAgency && selectedAgency !== "all") {
        query = query.eq("agency_id", selectedAgency);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("sales_people")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "איש מכירות נמחק בהצלחה",
      });
      refetch();
    } catch (error: any) {
      toast({
        title: "שגיאה במחיקת איש מכירות",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-8">טוען...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">אנשי מכירות</h1>
            <p className="text-muted-foreground mt-2">
              ניהול צוות המכירות והקצאת לידים
            </p>
          </div>
          <AddSalesPersonForm />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {salesPeople?.map((person: any) => (
            <Card key={person.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-xl">{person.full_name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {person.agencies?.name}
                    </p>
                  </div>
                  <Badge variant={person.active ? "default" : "secondary"}>
                    {person.active ? "פעיל" : "לא פעיל"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {person.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={`mailto:${person.email}`}
                      className="hover:underline"
                    >
                      {person.email}
                    </a>
                  </div>
                )}
                
                {person.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={`tel:${person.phone}`}
                      className="hover:underline"
                    >
                      {person.phone}
                    </a>
                  </div>
                )}

                {person.folder_link && (
                  <a
                    href={person.folder_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    תיקייה
                  </a>
                )}

                {person.notes && (
                  <p className="text-sm text-muted-foreground border-t pt-3">
                    {person.notes}
                  </p>
                )}

                <div className="flex gap-2 pt-2 border-t">
                  <EditSalesPersonDialog salesPerson={person} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(person.id)}
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 ml-2" />
                    מחק
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {salesPeople?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                אין עדיין אנשי מכירות במערכת
              </p>
              <AddSalesPersonForm />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

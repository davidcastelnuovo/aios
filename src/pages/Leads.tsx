import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, ExternalLink, Trash2, Building2, DollarSign } from "lucide-react";
import { AddLeadForm } from "@/components/forms/AddLeadForm";
import { EditLeadDialog } from "@/components/forms/EditLeadDialog";
import { useToast } from "@/hooks/use-toast";
import { useAgency } from "@/contexts/AgencyContext";

const STATUS_LABELS: Record<string, string> = {
  new: "חדש",
  contacted: "יצירת קשר",
  meeting_scheduled: "פגישה מתוכננת",
  proposal_sent: "הצעה נשלחה",
  negotiation: "משא ומתן",
  won: "נסגר",
  lost: "אבד",
};

const SOURCE_LABELS: Record<string, string> = {
  website: "אתר",
  referral: "הפניה",
  social_media: "מדיה חברתית",
  paid_ads: "מודעות ממומנות",
  cold_call: "שיחה קרה",
  email_campaign: "קמפיין אימייל",
  event: "אירוע",
  other: "אחר",
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  new: "default",
  contacted: "secondary",
  meeting_scheduled: "outline",
  proposal_sent: "outline",
  negotiation: "outline",
  won: "default",
  lost: "destructive",
};

export default function Leads() {
  const { toast } = useToast();
  const { selectedAgency } = useAgency();

  const { data: leads, isLoading, refetch } = useQuery({
    queryKey: ["leads", selectedAgency],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("*, agencies (name), sales_people (full_name)")
        .order("created_at", { ascending: false });

      if (selectedAgency) {
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
        .from("leads")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "ליד נמחק בהצלחה",
      });
      refetch();
    } catch (error: any) {
      toast({
        title: "שגיאה במחיקת ליד",
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
            <h1 className="text-3xl font-bold">לידים</h1>
            <p className="text-muted-foreground mt-2">
              ניהול וקליטת לידים חדשים
            </p>
          </div>
          <AddLeadForm />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {leads?.map((lead: any) => (
            <Card key={lead.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      {lead.company_name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {lead.contact_name}
                    </p>
                  </div>
                  <Badge variant={STATUS_COLORS[lead.status]}>
                    {STATUS_LABELS[lead.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">
                    {SOURCE_LABELS[lead.source]}
                  </Badge>
                  {lead.industry && (
                    <Badge variant="outline">
                      {lead.industry}
                    </Badge>
                  )}
                </div>

                {lead.estimated_deal_value && (
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <DollarSign className="h-4 w-4" />
                    ₪{lead.estimated_deal_value.toLocaleString()}
                  </div>
                )}

                <div className="space-y-2">
                  {lead.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={`mailto:${lead.email}`}
                        className="hover:underline"
                      >
                        {lead.email}
                      </a>
                    </div>
                  )}
                  
                  {lead.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={`tel:${lead.phone}`}
                        className="hover:underline"
                      >
                        {lead.phone}
                      </a>
                    </div>
                  )}
                </div>

                <div className="text-sm text-muted-foreground border-t pt-3">
                  <p>איש מכירות: {lead.sales_people?.full_name}</p>
                  <p className="text-xs mt-1">{lead.agencies?.name}</p>
                </div>

                {lead.folder_link && (
                  <a
                    href={lead.folder_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    תיקייה
                  </a>
                )}

                {lead.notes && (
                  <p className="text-sm text-muted-foreground border-t pt-3">
                    {lead.notes}
                  </p>
                )}

                <div className="flex gap-2 pt-2 border-t">
                  <EditLeadDialog lead={lead} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(lead.id)}
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

        {leads?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                אין עדיין לידים במערכת
              </p>
              <AddLeadForm />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

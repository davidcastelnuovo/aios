import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Megaphone, Phone, Mail, Briefcase } from "lucide-react";
import { AddCampaignerForm } from "@/components/forms/AddCampaignerForm";
import { EditCampaignerDialog } from "@/components/forms/EditCampaignerDialog";

export default function Campaigners() {
  const [selectedCampaigner, setSelectedCampaigner] = useState<string | null>(null);
  const [clientAmounts, setClientAmounts] = useState<Record<string, number>>({});
  const { data: campaigners, isLoading } = useQuery({
    queryKey: ["campaigners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigners")
        .select(`
          *,
          client_team(
            role_on_account,
            allocation_percent,
            clients(id, name, status)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });


  const handleAmountChange = (clientId: string, value: string) => {
    const amount = parseFloat(value) || 0;
    setClientAmounts(prev => ({ ...prev, [clientId]: amount }));
  };

  const calculateTotal = (campaignerId: string) => {
    const campaigner = campaigners?.find(c => c.id === campaignerId);
    if (!campaigner?.client_team) return 0;
    
    return campaigner.client_team.reduce((total: number, assignment: any) => {
      return total + (clientAmounts[assignment.clients.id] || 0);
    }, 0);
  };

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campaigners?.map((campaigner) => (
          <Card key={campaigner.id} className="shadow-card hover:shadow-lg transition-all hover:scale-[1.02]">
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
                <div className="flex items-center gap-2">
                  <EditCampaignerDialog campaigner={campaigner} />
                  <Badge variant="outline" className={campaigner.active ? "bg-success/10 text-success border-success/20" : "bg-muted"}>
                    {campaigner.active ? "פעיל" : "לא פעיל"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {campaigner.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span dir="ltr">{campaigner.phone}</span>
                </div>
              )}
              {campaigner.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{campaigner.email}</span>
                </div>
              )}
              {campaigner.notes && (
                <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                  {campaigner.notes}
                </p>
              )}
              
              {campaigner.client_team && campaigner.client_team.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <h4 className="text-sm font-semibold mb-2">לקוחות משויכים</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">שם לקוח</TableHead>
                          <TableHead className="text-right">סכום</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaigner.client_team.map((assignment: any) => (
                          <TableRow key={assignment.clients.id}>
                            <TableCell className="font-medium">{assignment.clients.name}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                placeholder="0"
                                value={clientAmounts[assignment.clients.id] || ''}
                                onChange={(e) => handleAmountChange(assignment.clients.id, e.target.value)}
                                className="max-w-[150px]"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold bg-muted/50">
                          <TableCell>סה"כ</TableCell>
                          <TableCell>{calculateTotal(campaigner.id).toLocaleString('he-IL')} ₪</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
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
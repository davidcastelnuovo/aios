import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Megaphone, Phone, Mail, Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import { AddCampaignerForm } from "@/components/forms/AddCampaignerForm";
import { EditCampaignerDialog } from "@/components/forms/EditCampaignerDialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUserPermissions } from "@/hooks/useUserPermissions";

export default function Campaigners() {
  const [expandedCampaigner, setExpandedCampaigner] = useState<string | null>(null);
  const [tempAmounts, setTempAmounts] = useState<Record<string, number>>({});
  const { canViewFinance } = useUserPermissions();
  const queryClient = useQueryClient();
  
  const { data: campaigners, isLoading } = useQuery({
    queryKey: ["campaigners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigners")
        .select(`
          *,
          campaigner_agencies(
            agencies(name)
          ),
          client_team(
            id,
            role_on_account,
            allocation_percent,
            campaigner_payment,
            clients(id, name, status)
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Filter client_team to show active and onboarding clients on the frontend
      const filteredData = data?.map(campaigner => ({
        ...campaigner,
        client_team: campaigner.client_team?.filter((ct: any) => 
          ct.clients?.status === "active" || ct.clients?.status === "onboarding"
        ) || []
      }));
      
      return filteredData;
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ clientTeamId, amount }: { clientTeamId: string; amount: number }) => {
      const { error } = await supabase
        .from("client_team")
        .update({ campaigner_payment: amount })
        .eq("id", clientTeamId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigners"] });
      toast.success("הסכום עודכן בהצלחה");
    },
    onError: () => {
      toast.error("שגיאה בעדכון הסכום");
    },
  });


  const handleAmountChange = (clientTeamId: string, value: string) => {
    const amount = parseFloat(value) || 0;
    setTempAmounts(prev => ({ ...prev, [clientTeamId]: amount }));
  };

  const handleAmountBlur = (clientTeamId: string, originalAmount: number) => {
    const newAmount = tempAmounts[clientTeamId];
    if (newAmount !== undefined && newAmount !== originalAmount) {
      updatePaymentMutation.mutate({ clientTeamId, amount: newAmount });
    }
  };

  const calculateTotal = (campaignerId: string) => {
    const campaigner = campaigners?.find(c => c.id === campaignerId);
    if (!campaigner?.client_team) return 0;
    
    return campaigner.client_team.reduce((total: number, assignment: any) => {
      return total + (assignment.campaigner_payment || 0);
    }, 0);
  };


  const toggleCampaigner = (campaignerId: string) => {
    setExpandedCampaigner(expandedCampaigner === campaignerId ? null : campaignerId);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">טוען...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">צוות</h2>
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
                    {campaigner.role && campaigner.role.length > 0 && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {campaigner.role.join(", ")}
                      </p>
                    )}
                    {campaigner.campaigner_agencies && campaigner.campaigner_agencies.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {campaigner.campaigner_agencies.map((ca: any) => ca.agencies.name).join(", ")}
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
                  <button
                    className="w-full flex items-center justify-between p-2 hover:bg-muted/50 rounded text-foreground"
                    onClick={() => toggleCampaigner(campaigner.id)}
                  >
                    <span className="text-sm font-semibold">לקוחות משויכים ({campaigner.client_team.length})</span>
                    {expandedCampaigner === campaigner.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  
                  {expandedCampaigner === campaigner.id && (
                    <div className="overflow-x-auto mt-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">שם לקוח</TableHead>
                            {canViewFinance() && <TableHead className="text-right">סכום</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {campaigner.client_team.map((assignment: any) => (
                            <TableRow key={assignment.id}>
                              <TableCell className="font-medium">{assignment.clients.name}</TableCell>
                              {canViewFinance() && (
                                <TableCell>
                                  <Input
                                    type="number"
                                    placeholder="0"
                                    value={tempAmounts[assignment.id] ?? assignment.campaigner_payment ?? ''}
                                    onChange={(e) => handleAmountChange(assignment.id, e.target.value)}
                                    onBlur={() => handleAmountBlur(assignment.id, assignment.campaigner_payment || 0)}
                                    className="max-w-[150px]"
                                  />
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                          {canViewFinance() && (
                            <TableRow className="font-semibold bg-muted/50">
                              <TableCell>סה"כ</TableCell>
                              <TableCell>{calculateTotal(campaigner.id).toLocaleString('he-IL')} ₪</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
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
            <h3 className="text-lg font-semibold mb-1">אין אנשי צוות</h3>
            <p className="text-sm text-muted-foreground">התחל בהוספת איש צוות ראשון</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
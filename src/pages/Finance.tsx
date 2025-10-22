import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Calendar, Building2, Users, Truck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAgency } from "@/contexts/AgencyContext";
import { useUserAgencies } from "@/hooks/useUserAgencies";
import { useUserRole } from "@/hooks/useUserRole";

export default function Finance() {
  const { selectedAgency } = useAgency();
  const { userAgencyIds } = useUserAgencies();
  const { campaignerId, isCampaigner, isTeamManager, isOwner } = useUserRole();


  const { data: financeRecords, isLoading } = useQuery({
    queryKey: ["finance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance")
        .select(`
          *,
          agencies (name),
          clients (name),
          suppliers (name)
        `)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, retainer, agency_id")
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  // Get client IDs for the campaigner
  const { data: campaignerClientIds } = useQuery({
    queryKey: ["campaigner-client-ids", campaignerId],
    queryFn: async () => {
      if (!campaignerId) return null;
      const { data } = await supabase
        .from("client_team")
        .select("client_id")
        .eq("campaigner_id", campaignerId);
      return data?.map(ct => ct.client_id) || [];
    },
    enabled: !!campaignerId && isCampaigner && !isTeamManager && !isOwner,
  });


  // משיכת תשלומים ידניים מספקים
  const { data: manualSupplierPayments } = useQuery({
    queryKey: ["manual-supplier-payments", selectedAgency],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("payment_1, payment_2, payment_3, agency_id_1, agency_id_2, agency_id_3");
      
      if (error) throw error;
      
      let total = 0;
      data?.forEach(supplier => {
        if (selectedAgency === "all") {
          total += Number(supplier.payment_1 || 0) + Number(supplier.payment_2 || 0) + Number(supplier.payment_3 || 0);
        } else {
          if (supplier.agency_id_1 === selectedAgency) total += Number(supplier.payment_1 || 0);
          if (supplier.agency_id_2 === selectedAgency) total += Number(supplier.payment_2 || 0);
          if (supplier.agency_id_3 === selectedAgency) total += Number(supplier.payment_3 || 0);
        }
      });
      
      return total;
    },
  });

  // First filter by role
  let accessibleClients = clients;
  let accessibleFinanceRecords = financeRecords;

  if (!isOwner) {
    if (isCampaigner && !isTeamManager && campaignerClientIds) {
      // Pure campaigners see only their assigned clients
      accessibleClients = clients?.filter(c => 
        campaignerClientIds.includes(c.id)
      );
      // Finance records only for their clients
      accessibleFinanceRecords = financeRecords?.filter(f => 
        campaignerClientIds.includes(f.client_id)
      );
    } else if (userAgencyIds && userAgencyIds.length > 0) {
      // Team managers and agency owners see all in their agencies
      accessibleClients = clients?.filter(c => 
        userAgencyIds.includes(c.agency_id)
      );
      accessibleFinanceRecords = financeRecords?.filter(f => 
        userAgencyIds.includes(f.agency_id)
      );
    }
  }

  // Then apply agency filter (works for all roles including campaigners)
  if (selectedAgency && selectedAgency !== "all") {
    accessibleClients = accessibleClients?.filter(
      (c) => c.agency_id === selectedAgency
    );
    accessibleFinanceRecords = accessibleFinanceRecords?.filter(
      (f) => f.agency_id === selectedAgency
    );
  }

  const filteredClients = accessibleClients;

  const totalRetainers = filteredClients?.reduce((sum, client) => sum + Number(client.retainer || 0), 0) || 0;

  const filteredFinanceRecords = accessibleFinanceRecords;

  const totalIncome = filteredFinanceRecords?.filter(f => f.type === "income").reduce((sum, f) => sum + Number(f.amount), 0) || 0;
  const totalExpense = filteredFinanceRecords?.filter(f => f.type === "expense").reduce((sum, f) => sum + Number(f.amount), 0) || 0;

  if (isLoading) {
    return <div className="flex justify-center p-8">טוען...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">כספים</h2>
        <p className="text-muted-foreground mt-1">ניהול הכנסות והוצאות</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">סך הכנסות</p>
                <p className="text-2xl font-bold text-primary">₪{(totalIncome + totalRetainers).toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-success/10">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">סך הוצאות</p>
                <p className="text-2xl font-bold text-destructive">₪{(totalExpense + (manualSupplierPayments || 0)).toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10">
                <TrendingDown className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">רווח</p>
                <p className={`text-2xl font-bold ${(totalIncome + totalRetainers) - (totalExpense + (manualSupplierPayments || 0)) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  ₪{((totalIncome + totalRetainers) - (totalExpense + (manualSupplierPayments || 0))).toLocaleString()}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${(totalIncome + totalRetainers) - (totalExpense + (manualSupplierPayments || 0)) >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
                <TrendingUp className={`h-6 w-6 ${(totalIncome + totalRetainers) - (totalExpense + (manualSupplierPayments || 0)) >= 0 ? 'text-success' : 'text-destructive'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>תאריך</TableHead>
                <TableHead>סוג</TableHead>
                <TableHead>סוכנות</TableHead>
                <TableHead>לקוח</TableHead>
                <TableHead>ספק</TableHead>
                <TableHead>קטגוריה</TableHead>
                <TableHead className="text-left">סכום</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFinanceRecords?.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {new Date(record.date).toLocaleDateString("he-IL")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={record.type === "income" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}
                    >
                      {record.type === "income" ? (
                        <><TrendingUp className="h-3 w-3 ml-1" />הכנסה</>
                      ) : (
                        <><TrendingDown className="h-3 w-3 ml-1" />הוצאה</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {record.agencies?.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {record.clients?.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {record.suppliers ? (
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        {record.suppliers.name}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {record.category && (
                      <Badge variant="secondary" className="text-xs">
                        {record.category}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-left font-medium">
                    ₪{Number(record.amount).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filteredFinanceRecords?.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">אין תנועות כספיות</h3>
            <p className="text-sm text-muted-foreground">התחל בהוספת תנועה כספית</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
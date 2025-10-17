import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Calendar, Building2, Users, Truck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export default function Finance() {
  const [selectedAgency, setSelectedAgency] = useState<string>("all");

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
        .select("retainer, agency_id")
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  // משיכת תשלומים לקמפיינרים מ-client_team
  const { data: campaignerPayments } = useQuery({
    queryKey: ["campaigner-payments-finance", selectedAgency],
    queryFn: async () => {
      let query = supabase
        .from("client_team")
        .select(`
          campaigner_payment,
          clients!inner(agency_id)
        `)
        .not("campaigner_payment", "is", null);
      
      if (selectedAgency !== "all") {
        query = query.eq("clients.agency_id", selectedAgency);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return data?.reduce((sum, item) => sum + Number(item.campaigner_payment || 0), 0) || 0;
    },
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

  const filteredClients = selectedAgency === "all" 
    ? clients 
    : clients?.filter(c => c.agency_id === selectedAgency);

  const totalRetainers = filteredClients?.reduce((sum, client) => sum + Number(client.retainer || 0), 0) || 0;

  const filteredFinanceRecords = selectedAgency === "all"
    ? financeRecords
    : financeRecords?.filter(f => f.agency_id === selectedAgency);

  const totalIncome = filteredFinanceRecords?.filter(f => f.type === "income").reduce((sum, f) => sum + Number(f.amount), 0) || 0;
  const totalExpense = filteredFinanceRecords?.filter(f => f.type === "expense").reduce((sum, f) => sum + Number(f.amount), 0) || 0;

  if (isLoading) {
    return <div className="flex justify-center p-8">טוען...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold">כספים</h2>
          <p className="text-muted-foreground mt-1">ניהול הכנסות והוצאות</p>
        </div>
        <Select value={selectedAgency} onValueChange={setSelectedAgency}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="בחר סוכנות" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוכנויות</SelectItem>
            {agencies?.map((agency) => (
              <SelectItem key={agency.id} value={agency.id}>
                {agency.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">סך הכנסות</p>
                <p className="text-2xl font-bold text-success">₪{(totalIncome + totalRetainers).toLocaleString()}</p>
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
                <p className="text-2xl font-bold text-destructive">₪{(totalExpense + (campaignerPayments || 0) + (manualSupplierPayments || 0)).toLocaleString()}</p>
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
                <p className={`text-2xl font-bold ${(totalIncome + totalRetainers) - (totalExpense + (campaignerPayments || 0) + (manualSupplierPayments || 0)) >= 0 ? 'text-success' : 'text-destructive'}`}>
                  ₪{((totalIncome + totalRetainers) - (totalExpense + (campaignerPayments || 0) + (manualSupplierPayments || 0))).toLocaleString()}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${(totalIncome + totalRetainers) - (totalExpense + (campaignerPayments || 0) + (manualSupplierPayments || 0)) >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
                <TrendingUp className={`h-6 w-6 ${(totalIncome + totalRetainers) - (totalExpense + (campaignerPayments || 0) + (manualSupplierPayments || 0)) >= 0 ? 'text-success' : 'text-destructive'}`} />
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
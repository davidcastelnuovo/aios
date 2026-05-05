import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTenant } from "@/contexts/TenantContext";
import { useAgency } from "@/contexts/AgencyContext";
import { useCrossTenantAgencyIds } from "@/hooks/useCrossTenantAgencyIds";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Users, 
  Search, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Pencil,
  Plus,
  Trash2,
  CalendarIcon
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { EditClientDialog } from "@/components/forms/EditClientDialog";
import { addMonths, format, subMonths } from "date-fns";
import { he } from "date-fns/locale";

const getMonthOptions = () => {
  const months = [];
  for (let i = 0; i < 12; i++) {
    const date = subMonths(new Date(), i);
    months.push({
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: he })
    });
  }
  return months;
};

export default function AccountingIntegrations() {
  const { tenantId } = useCurrentTenant();
  const { currentTenantId } = useTenant();
  const { selectedAgency } = useAgency();
  const { crossTenantAgencyIds } = useCrossTenantAgencyIds();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [agencyFilter, setAgencyFilter] = useState<string>("all");
  const [clientStatusFilter, setClientStatusFilter] = useState<string>("active");
  const [selectedMonth, setSelectedMonth] = useState(() => format(subMonths(new Date(), 1), "yyyy-MM"));
  const [editingClient, setEditingClient] = useState<any | null>(null);
  
  // One-time income dialog
  const [addOneTimeIncomeOpen, setAddOneTimeIncomeOpen] = useState(false);
  const [oneTimeIncomeForm, setOneTimeIncomeForm] = useState({
    client_id: "",
    product_name: "",
    amount: "",
    income_date: "",
    notes: "",
  });

  const monthOptions = useMemo(() => getMonthOptions(), []);

  // Fetch agencies (own + shared via agency_tenant_access)
  const { data: agencies } = useQuery({
    queryKey: ["agencies", currentTenantId, crossTenantAgencyIds],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const hasShared = crossTenantAgencyIds.length > 0;
      const orFilter = hasShared
        ? `tenant_id.eq.${currentTenantId},id.in.(${crossTenantAgencyIds.join(",")})`
        : null;
      let q = supabase.from("agencies").select("id, name");
      q = orFilter ? q.or(orFilter) : q.eq("tenant_id", currentTenantId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  // Fetch clients
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["accounting-clients", currentTenantId, agencyFilter, crossTenantAgencyIds],
    queryFn: async () => {
      if (!currentTenantId) return [];

      let query = supabase
        .from("clients")
        .select(`
          id, name, contact_name, email, phone, status, retainer, monthly_budget,
          agency_id, updated_at, is_seo_client, services, monthly_fixed_expense,
          agencies (id, name)
        `);

      if (agencyFilter && agencyFilter !== "all") {
        // Specific agency selected: RLS will allow if it's own or shared
        query = query.eq("agency_id", agencyFilter);
      } else {
        // Include own-tenant clients + clients in cross-tenant shared agencies
        const hasShared = crossTenantAgencyIds.length > 0;
        if (hasShared) {
          query = query.or(
            `tenant_id.eq.${currentTenantId},agency_id.in.(${crossTenantAgencyIds.join(",")})`
          );
        } else {
          query = query.eq("tenant_id", currentTenantId);
        }
      }

      const { data: clientsData, error } = await query;
      if (error) throw error;

      const clientIds = (clientsData || []).map(c => c.id);
      const { data: financialData } = clientIds.length
        ? await supabase
            .from("client_tenant_financial_data")
            .select("client_id, retainer, monthly_budget")
            .eq("tenant_id", currentTenantId)
            .in("client_id", clientIds)
        : { data: [] as any[] };

      const financialMap = new Map(
        (financialData || []).map(f => [f.client_id, f])
      );

      return (clientsData || []).map(client => ({
        ...client,
        retainer: financialMap.get(client.id)?.retainer ?? client.retainer,
        monthly_budget: financialMap.get(client.id)?.monthly_budget ?? client.monthly_budget,
      }));
    },
    enabled: !!currentTenantId,
  });

  // Fetch campaigner payments from client_team
  const { data: campaignerPayments } = useQuery({
    queryKey: ["accounting-campaigner-payments", currentTenantId, agencyFilter],
    queryFn: async () => {
      if (!currentTenantId) return [];
      
      const { data: ownedAgencies } = await supabase
        .from("agencies").select("id").eq("tenant_id", currentTenantId);
      const { data: sharedAgencies } = await supabase
        .from("agency_tenant_access").select("agency_id").eq("accessing_tenant_id", currentTenantId);
      
      let agencyIds = [
        ...(ownedAgencies || []).map(a => a.id),
        ...(sharedAgencies || []).map(a => a.agency_id)
      ];
      if (agencyFilter && agencyFilter !== "all") {
        agencyIds = agencyIds.filter(id => id === agencyFilter);
      }
      if (agencyIds.length === 0) return [];

      const { data: clientsData } = await supabase
        .from("clients").select("id").in("agency_id", agencyIds).in("status", ["active", "onboarding"]);
      const clientIds = (clientsData || []).map(c => c.id);
      if (clientIds.length === 0) return [];

      const { data, error } = await supabase
        .from("client_team")
        .select(`id, campaigner_payment, campaigner_id, client_id, campaigners (id, full_name), clients (id, name, agency_id)`)
        .in("client_id", clientIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  // Fetch suppliers for expense calculation per client
  const { data: suppliers } = useQuery({
    queryKey: ["accounting-suppliers", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data, error } = await supabase
        .from("suppliers")
        .select(`
          id, name, payment_1, payment_2, payment_3,
          agency_id_1, agency_id_2, agency_id_3, related_campaigner_id,
          agency_1:agencies!suppliers_agency_id_1_fkey(id, name),
          agency_2:agencies!suppliers_agency_id_2_fkey(id, name),
          agency_3:agencies!suppliers_agency_id_3_fkey(id, name)
        `)
        .eq("tenant_id", currentTenantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  // Fetch one-time incomes
  const { data: oneTimeIncomes } = useQuery({
    queryKey: ["one-time-incomes-all", currentTenantId, selectedMonth],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data, error } = await supabase
        .from("one_time_incomes")
        .select("*, clients(name)")
        .eq("tenant_id", currentTenantId)
        .eq("payment_month", selectedMonth)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  // Fetch tenant-scoped client expenses from finance for the selected month
  const { data: financeExpenses } = useQuery({
    queryKey: ["accounting-finance-expenses", currentTenantId, selectedMonth],
    queryFn: async () => {
      if (!currentTenantId) return [];

      const monthStart = `${selectedMonth}-01`;
      const nextMonthStart = format(addMonths(new Date(monthStart), 1), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("finance")
        .select("id, client_id, agency_id, amount, category, notes, date")
        .eq("tenant_id", currentTenantId)
        .eq("type", "expense")
        .gte("date", monthStart)
        .lt("date", nextMonthStart);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });




  // Create one-time income
  const createOneTimeIncome = useMutation({
    mutationFn: async (data: { client_id: string; product_name: string; amount: number; payment_month: string; notes?: string; }) => {
      const { error } = await supabase.from("one_time_incomes").insert({
        tenant_id: currentTenantId,
        client_id: data.client_id,
        product_name: data.product_name,
        amount: data.amount,
        payment_month: data.payment_month,
        notes: data.notes || null,
      });
      if (error) throw error;
      return data.payment_month;
    },
    onSuccess: (payment_month) => {
      if (payment_month) setSelectedMonth(payment_month);
      queryClient.invalidateQueries({ queryKey: ["one-time-incomes-all"] });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      toast.success("הכנסה חד פעמית נוספה");
      setAddOneTimeIncomeOpen(false);
      setOneTimeIncomeForm({ client_id: "", product_name: "", amount: "", income_date: "", notes: "" });
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  // Delete one-time income
  const deleteOneTimeIncome = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("one_time_incomes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["one-time-incomes-all"] });
      toast.success("נמחק");
    },
  });

  // Update client status
  const updateClientStatus = useMutation({
    mutationFn: async ({ clientId, status }: { clientId: string; status: string }) => {
      const { error } = await supabase.from("clients").update({ status: status as any }).eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-clients"] });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      toast.success("סטטוס עודכן");
    },
  });

  // Helpers to detect SEO clients (kept for legacy display purposes)
  const isSeoClient = (c: any) =>
    !!c?.is_seo_client || (Array.isArray(c?.services) && c.services.includes("seo"));

  // Build a synthetic "fixed monthly expense" line per client based on the
  // manually-edited `monthly_fixed_expense` field on the client. This shows
  // up in the accounting table for every month, unless a finance row with
  // category 'הוצאה קבועה' already exists for that client+month (override).
  const syntheticSeoExpenses = useMemo(() => {
    if (!clients) return [] as Array<any>;
    const haveFixedFinance = new Set(
      (financeExpenses || [])
        .filter((e: any) => (e.category || "") === "הוצאה קבועה")
        .map((e: any) => e.client_id)
        .filter(Boolean)
    );
    return clients
      .filter((c: any) => Number(c?.monthly_fixed_expense || 0) > 0 && !haveFixedFinance.has(c.id))
      .map((c: any) => ({
        id: `auto-fixed-${c.id}-${selectedMonth}`,
        client_id: c.id,
        agency_id: c.agency_id,
        amount: Number(c.monthly_fixed_expense || 0),
        category: "הוצאה קבועה",
        notes: "הוצאה חודשית קבועה (מתוך פרטי הלקוח)",
        date: `${selectedMonth}-01`,
        _auto: true,
      }));
  }, [clients, financeExpenses, selectedMonth]);

  // Compute per-client expenses
  const clientExpensesMap = useMemo(() => {
    const map = new Map<string, number>();
    // Campaigner payments per client
    campaignerPayments?.forEach(p => {
      if (p.campaigner_payment && p.campaigner_payment > 0) {
        map.set(p.client_id, (map.get(p.client_id) || 0) + p.campaigner_payment);
      }
    });
    // Finance expenses per client, strictly scoped to the active tenant + selected month
    financeExpenses?.forEach((expense) => {
      if (expense.client_id && expense.amount) {
        map.set(expense.client_id, (map.get(expense.client_id) || 0) + Number(expense.amount));
      }
    });
    // Synthetic SEO ₪850 for SEO clients without a finance row
    syntheticSeoExpenses.forEach((e) => {
      map.set(e.client_id, (map.get(e.client_id) || 0) + Number(e.amount));
    });
    return map;
  }, [campaignerPayments, financeExpenses, syntheticSeoExpenses]);

  const clientFinanceExpensesMap = useMemo(() => {
    const map = new Map<string, Array<any>>();
    financeExpenses?.forEach((expense) => {
      if (!expense.client_id) return;
      const list = map.get(expense.client_id) || [];
      list.push(expense);
      map.set(expense.client_id, list);
    });
    syntheticSeoExpenses.forEach((expense) => {
      const list = map.get(expense.client_id) || [];
      list.push(expense);
      map.set(expense.client_id, list);
    });
    return map;
  }, [financeExpenses, syntheticSeoExpenses]);

  // One-time incomes grouped by client
  const clientOneTimeMap = useMemo(() => {
    const map = new Map<string, Array<any>>();
    oneTimeIncomes?.forEach(oti => {
      const list = map.get(oti.client_id) || [];
      list.push(oti);
      map.set(oti.client_id, list);
    });
    return map;
  }, [oneTimeIncomes]);

  // Build supplier expense rows (each non-zero payment slot becomes a row)
  const supplierExpenseRows = useMemo(() => {
    if (!suppliers) return [] as Array<any>;
    const rows: any[] = [];
    suppliers.forEach((s: any) => {
      [1, 2, 3].forEach((i) => {
        const amount = Number(s[`payment_${i}`] || 0);
        if (amount <= 0) return;
        const agency = s[`agency_${i}`];
        const agencyId = s[`agency_id_${i}`];
        if (agencyFilter && agencyFilter !== "all" && agencyId !== agencyFilter) return;
        rows.push({
          id: `${s.id}-${i}`,
          supplier_name: s.name,
          agency_name: agency?.name || "ללא סוכנות",
          agency_id: agencyId,
          amount,
        });
      });
    });
    return rows;
  }, [suppliers, agencyFilter]);

  const totalSupplierExpenses = useMemo(
    () => supplierExpenseRows.reduce((sum, r) => sum + Number(r.amount || 0), 0),
    [supplierExpenseRows]
  );


  // Filter clients
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return clients.filter(client => {
      const matchesSearch = 
        client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.contact_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAgency = agencyFilter === "all" || client.agency_id === agencyFilter;
      
      let matchesStatus = true;
      if (clientStatusFilter === "active_relevant") {
        const isActiveOrOnboarding = client.status === "active" || client.status === "onboarding";
        const isPausedRecently = client.status === "paused" && client.updated_at && new Date(client.updated_at) >= thirtyDaysAgo;
        matchesStatus = isActiveOrOnboarding || !!isPausedRecently;
      } else if (clientStatusFilter === "active_onboarding") {
        matchesStatus = client.status === "active" || client.status === "onboarding";
      } else if (clientStatusFilter !== "all") {
        matchesStatus = client.status === clientStatusFilter;
      }
      
      return matchesSearch && matchesAgency && matchesStatus;
    });
  }, [clients, searchQuery, agencyFilter, clientStatusFilter]);

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "-";
    return `₪${amount.toLocaleString("he-IL")}`;
  };

  const clientStatusOptions = [
    { value: "active", label: "פעיל", color: "bg-green-600" },
    { value: "onboarding", label: "בקליטה", color: "bg-orange-500" },
    { value: "paused", label: "מושהה", color: "bg-muted-foreground" },
    { value: "ended", label: "סיים", color: "bg-destructive" },
  ];

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      active: { variant: "default", label: "פעיל" },
      onboarding: { variant: "outline", label: "בקליטה" },
      paused: { variant: "secondary", label: "מושהה" },
      ended: { variant: "destructive", label: "סיים" },
    };
    const config = statusMap[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const selectedMonthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;

  // Totals - calculated from table data
  const totalRetainer = filteredClients.reduce((sum, c) => sum + (c.retainer || 0), 0);
  const clientExpensesOnly = filteredClients.reduce((sum, c) => sum + (clientExpensesMap.get(c.id) || 0), 0);
  const totalExpenses = clientExpensesOnly + totalSupplierExpenses;
  const totalOneTime = filteredClients.reduce((sum, c) => {
    const items = clientOneTimeMap.get(c.id) || [];
    return sum + items.reduce((s: number, i: any) => s + (i.amount || 0), 0);
  }, 0);
  const totalIncome = totalRetainer + totalOneTime;
  const profit = totalIncome - totalExpenses;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">הנהלת חשבונות</h1>
          <p className="text-muted-foreground mt-2">ניהול פיננסי של לקוחות, ספקים וצוות</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">הכנסות</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</div>
            <p className="text-xs text-muted-foreground mt-1">חד פעמי ב{selectedMonthLabel}: {formatCurrency(totalOneTime)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">הוצאות</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</div>
            {totalSupplierExpenses > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                כולל {formatCurrency(totalSupplierExpenses)} תשלומי ספקים
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">רווח</CardTitle>
            <DollarSign className={`h-4 w-4 ${profit >= 0 ? "text-green-600" : "text-red-600"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(profit)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {agencies && agencies.length > 1 && (
              <Select value={agencyFilter} onValueChange={setAgencyFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="כל הסוכנויות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הסוכנויות</SelectItem>
                  {agencies.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>{agency.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={clientStatusFilter} onValueChange={setClientStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <Users className="h-4 w-4 ml-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הלקוחות</SelectItem>
                <SelectItem value="active_relevant">פעילים + עזבו ב-30 יום</SelectItem>
                <SelectItem value="active_onboarding">פעילים + בקליטה</SelectItem>
                <SelectItem value="active">פעילים בלבד</SelectItem>
                <SelectItem value="onboarding">בקליטה</SelectItem>
                <SelectItem value="paused">מושהים</SelectItem>
                <SelectItem value="ended">סיימו</SelectItem>
              </SelectContent>
            </Select>
            
            <Badge variant="secondary" className="whitespace-nowrap">
              {filteredClients.length} לקוחות
            </Badge>

            <Button size="sm" onClick={() => {
              setOneTimeIncomeForm({ client_id: "", product_name: "", amount: "", income_date: "", notes: "" });
              setAddOneTimeIncomeOpen(true);
            }}>
              <Plus className="h-4 w-4 ml-2" />
              הכנסה חד פעמית
            </Button>
            
            <div className="relative flex-1 min-w-[150px]">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unified Client Table */}
      <Card>
        <CardContent className="pt-6">
          {clientsLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">שם לקוח</TableHead>
                    <TableHead className="text-right">סוכנות</TableHead>
                    <TableHead className="text-right">צוות</TableHead>
                    <TableHead className="text-right">ריטיינר</TableHead>
                    <TableHead className="text-right">הוצאות קבועות</TableHead>
                    <TableHead className="text-right">הכנסה חד פעמית</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        לא נמצאו לקוחות
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClients.map((client) => {
                      const clientTeam = campaignerPayments?.filter(p => p.client_id === client.id) || [];
                      const teamCount = clientTeam.length;
                      const teamCost = clientTeam.reduce((sum, p) => sum + (p.campaigner_payment || 0), 0);
                      const fixedExpenses = clientExpensesMap.get(client.id) || 0;
                      const financeExpenseItems = clientFinanceExpensesMap.get(client.id) || [];
                      const oneTimeItems = clientOneTimeMap.get(client.id) || [];
                      const oneTimeTotal = oneTimeItems.reduce((s: number, i: any) => s + (i.amount || 0), 0);

                      return (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium text-right">
                            <Button
                              variant="link"
                              className="p-0 h-auto font-medium text-foreground hover:underline"
                              onClick={() => setEditingClient(client)}
                            >
                              {client.name}
                              <Pencil className="h-3 w-3 mr-1 opacity-50" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">{(client.agencies as any)?.name || "-"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-auto p-1"
                              onClick={() => setEditingClient(client)}
                            >
                              {teamCount > 0 ? (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {teamCount} ({formatCurrency(teamCost)})
                                </span>
                              ) : (
                                <span className="text-muted-foreground">+ שייך</span>
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(client.retainer)}
                          </TableCell>
                          <TableCell className="text-right">
                            {fixedExpenses > 0 ? (
                              <div className="space-y-1">
                                <span className="text-red-600 font-medium">{formatCurrency(fixedExpenses)}</span>
                                {financeExpenseItems.length > 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    {financeExpenseItems.map((expense) => (
                                      <div key={expense.id}>
                                        {expense.category || "הוצאה"}: {formatCurrency(Number(expense.amount || 0))}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {oneTimeItems.length > 0 ? (
                              <div className="space-y-1">
                                {oneTimeItems.map((oti: any) => (
                                  <div key={oti.id} className="flex items-center gap-2 text-sm">
                                    <span className="text-green-600 font-medium">{formatCurrency(oti.amount)}</span>
                                    <span className="text-muted-foreground truncate max-w-[120px]">{oti.product_name}</span>
                                    {oti.payment_month && (
                                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                        <CalendarIcon className="h-3 w-3" />
                                        {oti.payment_month}
                                      </span>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 w-5 p-0"
                                      onClick={() => deleteOneTimeIncome.mutate(oti.id)}
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-auto p-1 text-muted-foreground"
                                onClick={() => {
                                  setOneTimeIncomeForm({
                                    client_id: client.id,
                                    product_name: "",
                                    amount: "",
                                    income_date: selectedMonth,
                                    notes: "",
                                  });
                                  setAddOneTimeIncomeOpen(true);
                                }}
                              >
                                <Plus className="h-3 w-3 ml-1" />
                                הוסף
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Select
                              value={client.status}
                              onValueChange={(value) => updateClientStatus.mutate({ clientId: client.id, status: value })}
                            >
                              <SelectTrigger className="h-7 w-[100px] text-xs border-none bg-transparent p-0 focus:ring-0 focus:ring-offset-0">
                                <SelectValue>{getStatusBadge(client.status)}</SelectValue>
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-[9999]">
                                {clientStatusOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    <div className="flex items-center gap-2">
                                      <span className={`h-2 w-2 rounded-full ${opt.color}`} />
                                      {opt.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                  {/* Totals Row */}
                  {filteredClients.length > 0 && (
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell className="text-right">סה״כ</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-right">{formatCurrency(totalRetainer)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(totalExpenses)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(totalOneTime)}</TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suppliers Expenses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-right flex items-center justify-between">
            <span>הוצאות ספקים</span>
            <span className="text-sm font-normal text-muted-foreground">
              סה״כ: <span className="text-red-600 font-bold">{formatCurrency(totalSupplierExpenses)}</span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {supplierExpenseRows.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">אין הוצאות ספקים להצגה</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">שם ספק</TableHead>
                    <TableHead className="text-right">סוכנות</TableHead>
                    <TableHead className="text-right">תשלום חודשי</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierExpenseRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-right font-medium">{row.supplier_name}</TableCell>
                      <TableCell className="text-right">{row.agency_name}</TableCell>
                      <TableCell className="text-right text-red-600 font-medium">
                        {formatCurrency(row.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell className="text-right">סה״כ</TableCell>
                    <TableCell />
                    <TableCell className="text-right text-red-600">
                      {formatCurrency(totalSupplierExpenses)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add One-Time Income Dialog */}
      <Dialog open={addOneTimeIncomeOpen} onOpenChange={setAddOneTimeIncomeOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>הוספת הכנסה חד פעמית</DialogTitle>
            <DialogDescription>הוסף מוצר או שירות חד פעמי ושייך ללקוח</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>לקוח</Label>
              <Select value={oneTimeIncomeForm.client_id} onValueChange={(val) => setOneTimeIncomeForm(f => ({...f, client_id: val}))}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר לקוח" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client: any) => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>שם מוצר/שירות</Label>
              <Input
                value={oneTimeIncomeForm.product_name}
                onChange={(e) => setOneTimeIncomeForm(f => ({...f, product_name: e.target.value}))}
                placeholder="לדוגמה: בניית אתר"
              />
            </div>
            <div className="space-y-2">
              <Label>סכום (₪)</Label>
              <Input
                type="number"
                value={oneTimeIncomeForm.amount}
                onChange={(e) => setOneTimeIncomeForm(f => ({...f, amount: e.target.value}))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>תאריך / חודש שיוך</Label>
              <Select value={oneTimeIncomeForm.income_date} onValueChange={(val) => setOneTimeIncomeForm(f => ({...f, income_date: val}))}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר חודש" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>הערות (אופציונלי)</Label>
              <Input
                value={oneTimeIncomeForm.notes}
                onChange={(e) => setOneTimeIncomeForm(f => ({...f, notes: e.target.value}))}
                placeholder="הערות"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOneTimeIncomeOpen(false)}>ביטול</Button>
            <Button 
              onClick={() => {
                if (!oneTimeIncomeForm.client_id || !oneTimeIncomeForm.product_name || !oneTimeIncomeForm.amount || !oneTimeIncomeForm.income_date) {
                  toast.error("נא למלא את כל השדות");
                  return;
                }
                createOneTimeIncome.mutate({
                  client_id: oneTimeIncomeForm.client_id,
                  product_name: oneTimeIncomeForm.product_name,
                  amount: parseFloat(oneTimeIncomeForm.amount),
                  payment_month: oneTimeIncomeForm.income_date,
                  notes: oneTimeIncomeForm.notes,
                });
              }}
              disabled={createOneTimeIncome.isPending}
            >
              {createOneTimeIncome.isPending ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      {editingClient && (
        <EditClientDialog
          client={editingClient}
          open={!!editingClient}
          onOpenChange={(open) => !open && setEditingClient(null)}
          financeExpenseMonth={selectedMonth}
        />
      )}
    </div>
  );
}

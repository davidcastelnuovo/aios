import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTenant } from "@/contexts/TenantContext";
import { useAgency } from "@/contexts/AgencyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Package, 
  Search, 
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Check,
  History,
  Trash2,
  CreditCard
} from "lucide-react";
import { CreatePaymentLinkDialog } from "@/components/forms/CreatePaymentLinkDialog";
import { format, subMonths } from "date-fns";
import { he } from "date-fns/locale";

// Helper function to get month options
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
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("clients");
  const [agencyFilter, setAgencyFilter] = useState<string>("all");
  const [clientStatusFilter, setClientStatusFilter] = useState<string>("active_relevant");
  
  // Payment tracking state
  const [selectedMonth, setSelectedMonth] = useState(() => format(subMonths(new Date(), 1), "yyyy-MM"));
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'expense' | 'income';
    id: string;
    name: string;
    amount: number;
    expenseType?: 'supplier' | 'campaigner';
  } | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [paymentLinkClient, setPaymentLinkClient] = useState<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
    retainer?: number;
  } | null>(null);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  // Fetch agencies
  const { data: agencies } = useQuery({
    queryKey: ["agencies", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("tenant_id", currentTenantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  // Fetch expense payments for selected month
  const { data: expensePayments } = useQuery({
    queryKey: ["expense-payments", currentTenantId, selectedMonth],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data, error } = await supabase
        .from("expense_payments")
        .select("*")
        .eq("tenant_id", currentTenantId)
        .eq("payment_month", selectedMonth);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  // Fetch income payments for selected month
  const { data: incomePayments } = useQuery({
    queryKey: ["income-payments", currentTenantId, selectedMonth],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data, error } = await supabase
        .from("income_payments")
        .select("*")
        .eq("tenant_id", currentTenantId)
        .eq("payment_month", selectedMonth);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  // Fetch all payment history
  const { data: paymentHistory } = useQuery({
    queryKey: ["payment-history", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return { expenses: [], incomes: [] };
      
      const [expenseRes, incomeRes] = await Promise.all([
        supabase
          .from("expense_payments")
          .select("*")
          .eq("tenant_id", currentTenantId)
          .order("paid_at", { ascending: false })
          .limit(100),
        supabase
          .from("income_payments")
          .select("*")
          .eq("tenant_id", currentTenantId)
          .order("received_at", { ascending: false })
          .limit(100)
      ]);
      
      return {
        expenses: expenseRes.data || [],
        incomes: incomeRes.data || []
      };
    },
    enabled: !!currentTenantId && historyDialogOpen,
  });

  // Create expense payment mutation
  const createExpensePayment = useMutation({
    mutationFn: async (data: { 
      expense_type: 'supplier' | 'campaigner';
      expense_id: string;
      expense_name: string;
      amount: number;
    }) => {
      const { error } = await supabase
        .from("expense_payments")
        .insert({
          tenant_id: currentTenantId,
          expense_type: data.expense_type,
          expense_id: data.expense_id,
          expense_name: data.expense_name,
          amount: data.amount,
          payment_month: selectedMonth,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-payments"] });
      queryClient.invalidateQueries({ queryKey: ["payment-history"] });
      toast.success("התשלום סומן כשולם");
      setConfirmDialog(null);
    },
    onError: () => {
      toast.error("שגיאה בשמירת התשלום");
    }
  });

  // Create income payment mutation
  const createIncomePayment = useMutation({
    mutationFn: async (data: { 
      client_id: string;
      client_name: string;
      amount: number;
    }) => {
      const { error } = await supabase
        .from("income_payments")
        .insert({
          tenant_id: currentTenantId,
          client_id: data.client_id,
          client_name: data.client_name,
          amount: data.amount,
          payment_month: selectedMonth,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["income-payments"] });
      queryClient.invalidateQueries({ queryKey: ["payment-history"] });
      toast.success("התשלום סומן כהתקבל");
      setConfirmDialog(null);
    },
    onError: () => {
      toast.error("שגיאה בשמירת התשלום");
    }
  });

  // Delete expense payment mutation
  const deleteExpensePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("expense_payments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-payments"] });
      queryClient.invalidateQueries({ queryKey: ["payment-history"] });
      toast.success("התשלום בוטל");
    },
    onError: () => {
      toast.error("שגיאה במחיקת התשלום");
    }
  });

  // Delete income payment mutation
  const deleteIncomePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("income_payments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["income-payments"] });
      queryClient.invalidateQueries({ queryKey: ["payment-history"] });
      toast.success("התשלום בוטל");
    },
    onError: () => {
      toast.error("שגיאה במחיקת התשלום");
    }
  });

  // Check if expense is paid
  const isExpensePaid = (expenseId: string, expenseType: 'supplier' | 'campaigner') => {
    return expensePayments?.some(
      p => p.expense_id === expenseId && p.expense_type === expenseType
    );
  };

  // Check if client payment received
  const isIncomeReceived = (clientId: string) => {
    return incomePayments?.some(p => p.client_id === clientId);
  };

  // Get expense payment record
  const getExpensePayment = (expenseId: string, expenseType: 'supplier' | 'campaigner') => {
    return expensePayments?.find(
      p => p.expense_id === expenseId && p.expense_type === expenseType
    );
  };

  // Get income payment record
  const getIncomePayment = (clientId: string) => {
    return incomePayments?.find(p => p.client_id === clientId);
  };

  // Fetch clients with financial data from client_tenant_financial_data
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["accounting-clients", currentTenantId, agencyFilter],
    queryFn: async () => {
      if (!currentTenantId) return [];
      
      let query = supabase
        .from("clients")
        .select(`
          id,
          name,
          contact_name,
          email,
          phone,
          status,
          retainer,
          monthly_budget,
          agency_id,
          updated_at,
          agencies (id, name)
        `)
        .eq("tenant_id", currentTenantId);

      if (agencyFilter && agencyFilter !== "all") {
        query = query.eq("agency_id", agencyFilter);
      }

      const { data: clientsData, error } = await query;
      if (error) throw error;
      
      // Fetch tenant-specific financial data
      const clientIds = (clientsData || []).map(c => c.id);
      const { data: financialData } = await supabase
        .from("client_tenant_financial_data")
        .select("client_id, retainer, monthly_budget")
        .eq("tenant_id", currentTenantId)
        .in("client_id", clientIds);
      
      // Create a map for quick lookup
      const financialMap = new Map(
        (financialData || []).map(f => [f.client_id, f])
      );
      
      // Map data to use financial data from tenant-specific table
      return (clientsData || []).map(client => ({
        ...client,
        retainer: financialMap.get(client.id)?.retainer ?? client.retainer,
        monthly_budget: financialMap.get(client.id)?.monthly_budget ?? client.monthly_budget,
      }));
    },
    enabled: !!currentTenantId,
  });

  // Fetch suppliers
  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: ["accounting-suppliers", currentTenantId, agencyFilter],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data, error } = await supabase
        .from("suppliers")
        .select(`
          id,
          name,
          phone,
          email,
          type,
          agency_id_1,
          agency_id_2,
          agency_id_3,
          payment_1,
          payment_2,
          payment_3
        `)
        .eq("tenant_id", currentTenantId);
      if (error) throw error;
      
      // Filter suppliers by agency filter if not "all"
      if (agencyFilter && agencyFilter !== "all") {
        return (data || []).filter(s => 
          s.agency_id_1 === agencyFilter || 
          s.agency_id_2 === agencyFilter || 
          s.agency_id_3 === agencyFilter
        );
      }
      
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  // Fetch campaigner payments from client_team
  const { data: campaignerPayments, isLoading: campaignerPaymentsLoading } = useQuery({
    queryKey: ["accounting-campaigner-payments", currentTenantId, agencyFilter],
    queryFn: async () => {
      if (!currentTenantId) return [];
      
      // Get agencies for this tenant
      const { data: ownedAgencies } = await supabase
        .from("agencies")
        .select("id")
        .eq("tenant_id", currentTenantId);
      
      const { data: sharedAgencies } = await supabase
        .from("agency_tenant_access")
        .select("agency_id")
        .eq("accessing_tenant_id", currentTenantId);
      
      let agencyIds = [
        ...(ownedAgencies || []).map(a => a.id),
        ...(sharedAgencies || []).map(a => a.agency_id)
      ];

      // Filter by agency filter if not "all"
      if (agencyFilter && agencyFilter !== "all") {
        agencyIds = agencyIds.filter(id => id === agencyFilter);
      }

      if (agencyIds.length === 0) return [];

      // Get client IDs for these agencies (only active + onboarding to match Campaigners view)
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id")
        .in("agency_id", agencyIds)
        .in("status", ["active", "onboarding"]);

      const clientIds = (clientsData || []).map(c => c.id);
      if (clientIds.length === 0) return [];

      // Get campaigner payments for these clients
      const { data, error } = await supabase
        .from("client_team")
        .select(`
          id,
          campaigner_payment,
          campaigner_id,
          client_id,
          campaigners (id, full_name),
          clients (id, name, agency_id)
        `)
        .in("client_id", clientIds)
        .gt("campaigner_payment", 0);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });


  // Fetch finance summary - income from retainers (directly from clients table), expenses from suppliers
  const { data: financeData } = useQuery({
    queryKey: ["finance-summary", currentTenantId, agencyFilter, clientStatusFilter],
    queryFn: async () => {
      if (!currentTenantId) return { income: 0, expenses: 0 };
      
      // Get all agencies for this tenant (owned + shared)
      const { data: ownedAgencies } = await supabase
        .from("agencies")
        .select("id")
        .eq("tenant_id", currentTenantId);
      
      const { data: sharedAgencies } = await supabase
        .from("agency_tenant_access")
        .select("agency_id")
        .eq("accessing_tenant_id", currentTenantId);
      
      let agencyIds = [
        ...(ownedAgencies || []).map(a => a.id),
        ...(sharedAgencies || []).map(a => a.agency_id)
      ];
      
      // Filter by agency filter if not "all"
      if (agencyFilter && agencyFilter !== "all") {
        agencyIds = agencyIds.filter(id => id === agencyFilter);
      }
      
      // Determine which statuses to filter
      type ClientStatus = "active" | "ended" | "onboarding" | "paused";
      const getStatusFilter = (): ClientStatus[] | null => {
        if (clientStatusFilter === "all") return null;
        if (clientStatusFilter === "active_relevant") return ["active", "onboarding", "paused"];
        if (clientStatusFilter === "active_onboarding") return ["active", "onboarding"];
        return [clientStatusFilter as ClientStatus];
      };
      
      const statusFilter = getStatusFilter();
      
      let income = 0;
      if (agencyIds.length > 0) {
        let clientsQuery = supabase
          .from("clients")
          .select("id, retainer, status, updated_at")
          .in("agency_id", agencyIds);
        
        if (statusFilter) {
          clientsQuery = clientsQuery.in("status", statusFilter);
        }
        
        const { data: clientsData, error: clientsError } = await clientsQuery;
        
        if (clientsError) throw clientsError;
        
        // For active_relevant, filter paused clients by date
        let filteredClients = clientsData || [];
        if (clientStatusFilter === "active_relevant") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          filteredClients = filteredClients.filter(c => {
            if (c.status === "paused") {
              return c.updated_at && new Date(c.updated_at) >= thirtyDaysAgo;
            }
            return true;
          });
        }
        
        // Fetch tenant-specific financial data to get correct retainer values
        const clientIds = filteredClients.map(c => c.id);
        if (clientIds.length > 0) {
          const { data: financialData } = await supabase
            .from("client_tenant_financial_data")
            .select("client_id, retainer")
            .eq("tenant_id", currentTenantId)
            .in("client_id", clientIds);
          
          const financialMap = new Map(
            (financialData || []).map(f => [f.client_id, f.retainer])
          );
          
          // Use tenant-specific retainer if available, otherwise fall back to client retainer
          income = filteredClients.reduce((sum, c) => {
            const tenantRetainer = financialMap.get(c.id);
            return sum + (tenantRetainer ?? c.retainer ?? 0);
          }, 0);
        }
      }
      
      // Get expenses from suppliers (sum of payments, filtered by agency)
      const { data: suppliersData, error: suppliersError } = await supabase
        .from("suppliers")
        .select("payment_1, payment_2, payment_3, agency_id_1, agency_id_2, agency_id_3")
        .eq("tenant_id", currentTenantId);
      
      if (suppliersError) throw suppliersError;
      
      let supplierExpenses = 0;
      suppliersData?.forEach(s => {
        if (agencyFilter && agencyFilter !== "all") {
          // Only sum payments for the selected agency
          if (s.agency_id_1 === agencyFilter) supplierExpenses += (s.payment_1 || 0);
          if (s.agency_id_2 === agencyFilter) supplierExpenses += (s.payment_2 || 0);
          if (s.agency_id_3 === agencyFilter) supplierExpenses += (s.payment_3 || 0);
        } else {
          // Sum all payments
          supplierExpenses += (s.payment_1 || 0) + (s.payment_2 || 0) + (s.payment_3 || 0);
        }
      });
      
      // Get campaigner payments from client_team (only active + onboarding clients)
      let campaignerExpenses = 0;
      if (agencyIds.length > 0) {
        // For campaigner expenses, we use the status filter but treat active_relevant like active_onboarding
        const campaignerStatusFilter: ("active" | "onboarding")[] = ["active", "onboarding"];
        
        const { data: clientsForTeam, error: clientsForTeamError } = await supabase
          .from("clients")
          .select("id")
          .in("agency_id", agencyIds)
          .in("status", campaignerStatusFilter);

        if (clientsForTeamError) throw clientsForTeamError;

        const clientIds = (clientsForTeam || []).map(c => c.id);
        if (clientIds.length > 0) {
          const { data: teamData, error: teamError } = await supabase
            .from("client_team")
            .select("campaigner_payment")
            .in("client_id", clientIds)
            .gt("campaigner_payment", 0);

          if (teamError) throw teamError;

          campaignerExpenses =
            teamData?.reduce((sum, t) => sum + (t.campaigner_payment || 0), 0) || 0;
        }
      }

      const expenses = supplierExpenses + campaignerExpenses;

      return { income, expenses };
    },
    enabled: !!currentTenantId,
  });

  // Filter functions
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return clients.filter(client => {
      const matchesSearch = 
        client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.contact_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAgency = agencyFilter === "all" || client.agency_id === agencyFilter;
      
      // Status filter logic
      let matchesStatus = true;
      if (clientStatusFilter === "active_relevant") {
        // Show active, onboarding, OR paused that changed in last 30 days
        const isActiveOrOnboarding = client.status === "active" || client.status === "onboarding";
        const isPausedRecently = client.status === "paused" && 
          client.updated_at && new Date(client.updated_at) >= thirtyDaysAgo;
        matchesStatus = isActiveOrOnboarding || isPausedRecently;
      } else if (clientStatusFilter === "active_onboarding") {
        matchesStatus = client.status === "active" || client.status === "onboarding";
      } else if (clientStatusFilter !== "all") {
        matchesStatus = client.status === clientStatusFilter;
      }
      
      return matchesSearch && matchesAgency && matchesStatus;
    });
  }, [clients, searchQuery, agencyFilter, clientStatusFilter]);

  // Filter suppliers - only show those with payments
  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    return suppliers.filter(supplier => {
      const hasPayments = (supplier.payment_1 || 0) + (supplier.payment_2 || 0) + (supplier.payment_3 || 0) > 0;
      if (!hasPayments) return false;
      
      const matchesSearch = supplier.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAgency = agencyFilter === "all" || 
        supplier.agency_id_1 === agencyFilter ||
        supplier.agency_id_2 === agencyFilter ||
        supplier.agency_id_3 === agencyFilter;
      return matchesSearch && matchesAgency;
    });
  }, [suppliers, searchQuery, agencyFilter]);

  // Combined expenses list (suppliers + team with payments)
  const combinedExpenses = useMemo(() => {
    const expenses: Array<{
      id: string;
      name: string;
      type: 'supplier' | 'campaigner';
      totalPayment: number;
      details?: string;
      originalId: string;
    }> = [];

    // Add suppliers with payments
    filteredSuppliers.forEach(supplier => {
      const total = (supplier.payment_1 || 0) + (supplier.payment_2 || 0) + (supplier.payment_3 || 0);
      if (total > 0) {
        expenses.push({
          id: supplier.id,
          originalId: supplier.id,
          name: supplier.name,
          type: 'supplier',
          totalPayment: total,
        });
      }
    });

    // Add campaigner payments - aggregate by campaigner
    if (campaignerPayments && campaignerPayments.length > 0) {
      const campaignerTotals = new Map<string, { name: string; total: number; clients: string[] }>();
      
      campaignerPayments.forEach(payment => {
        const campaignerId = payment.campaigner_id;
        const campaignerName = (payment.campaigners as any)?.full_name || 'קמפיינר לא ידוע';
        const clientName = (payment.clients as any)?.name || '';
        const clientAgencyId = (payment.clients as any)?.agency_id;
        
        // Filter by agency if needed
        if (agencyFilter !== "all" && clientAgencyId !== agencyFilter) {
          return;
        }
        
        // Filter by search
        if (searchQuery && !campaignerName.toLowerCase().includes(searchQuery.toLowerCase())) {
          return;
        }
        
        const existing = campaignerTotals.get(campaignerId);
        if (existing) {
          existing.total += payment.campaigner_payment || 0;
          if (clientName) existing.clients.push(clientName);
        } else {
          campaignerTotals.set(campaignerId, {
            name: campaignerName,
            total: payment.campaigner_payment || 0,
            clients: clientName ? [clientName] : []
          });
        }
      });
      
      campaignerTotals.forEach((data, id) => {
        expenses.push({
          id: `campaigner-${id}`,
          originalId: id,
          name: data.name,
          type: 'campaigner',
          totalPayment: data.total,
          details: `${data.clients.length} לקוחות`
        });
      });
    }

    return expenses.sort((a, b) => b.totalPayment - a.totalPayment);
  }, [filteredSuppliers, campaignerPayments, agencyFilter, searchQuery]);

  // Calculate paid amounts for summary
  const paidExpensesTotal = useMemo(() => {
    return expensePayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  }, [expensePayments]);

  const receivedIncomeTotal = useMemo(() => {
    return incomePayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  }, [incomePayments]);

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "-";
    return `₪${amount.toLocaleString("he-IL")}`;
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      active: { variant: "default", label: "פעיל" },
      inactive: { variant: "secondary", label: "לא פעיל" },
      pending: { variant: "outline", label: "ממתין" },
      onboarding: { variant: "outline", label: "בקליטה" },
      paused: { variant: "secondary", label: "מושהה" },
      ended: { variant: "destructive", label: "סיים" },
    };
    const config = statusMap[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const profit = (financeData?.income || 0) - (financeData?.expenses || 0);

  const selectedMonthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">הנהלת חשבונות</h1>
          <p className="text-muted-foreground mt-2">
            ניהול פיננסי של לקוחות, ספקים וצוות
          </p>
        </div>
        <Button variant="outline" onClick={() => setHistoryDialogOpen(true)}>
          <History className="h-4 w-4 ml-2" />
          היסטוריית תשלומים
        </Button>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">הכנסות</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(financeData?.income || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              התקבל ב{selectedMonthLabel}: {formatCurrency(receivedIncomeTotal)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">הוצאות</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(financeData?.expenses || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              שולם ב{selectedMonthLabel}: {formatCurrency(paidExpensesTotal)}
            </p>
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
          <div className="flex flex-col md:flex-row gap-4">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="בחר חודש" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={agencyFilter} onValueChange={setAgencyFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <Building2 className="h-4 w-4 ml-2" />
                <SelectValue placeholder="כל הסוכנויות" />
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
            
            {selectedTab === "clients" && (
              <Select value={clientStatusFilter} onValueChange={setClientStatusFilter}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <Users className="h-4 w-4 ml-2" />
                  <SelectValue placeholder="סטטוס לקוחות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active_relevant">פעילים + עזבו ב-30 יום</SelectItem>
                  <SelectItem value="all">כל הסטטוסים</SelectItem>
                  <SelectItem value="active_onboarding">פעילים + בקליטה</SelectItem>
                  <SelectItem value="active">פעילים בלבד</SelectItem>
                  <SelectItem value="onboarding">בקליטה</SelectItem>
                  <SelectItem value="paused">מושהים</SelectItem>
                  <SelectItem value="ended">סיימו</SelectItem>
                </SelectContent>
              </Select>
            )}
            
            <div className="relative flex-1">
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

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} dir="rtl">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            לקוחות ({filteredClients.length})
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            הוצאות ({combinedExpenses.length})
          </TabsTrigger>
        </TabsList>

        {/* Clients Tab */}
        <TabsContent value="clients">
          <Card>
            <CardContent className="pt-6">
              {clientsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">שם לקוח</TableHead>
                        <TableHead className="text-right">סוכנות</TableHead>
                        <TableHead className="text-right">ריטיינר חודשי</TableHead>
                        <TableHead className="text-right">תקציב חודשי</TableHead>
                        <TableHead className="text-right">סטטוס</TableHead>
                        <TableHead className="text-right">התקבל תשלום</TableHead>
                        <TableHead className="text-right">קישור תשלום</TableHead>
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
                          const isPaid = isIncomeReceived(client.id);
                          const payment = getIncomePayment(client.id);
                          return (
                            <TableRow key={client.id}>
                              <TableCell className="font-medium text-right">{client.name}</TableCell>
                              <TableCell className="text-right">{(client.agencies as any)?.name || "-"}</TableCell>
                              <TableCell className="text-right">{formatCurrency(client.retainer)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(client.monthly_budget)}</TableCell>
                              <TableCell className="text-right">{getStatusBadge(client.status)}</TableCell>
                              <TableCell className="text-right">
                                {isPaid ? (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="default" className="bg-green-600">
                                      <Check className="h-3 w-3 ml-1" />
                                      התקבל
                                    </Badge>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => payment && deleteIncomePayment.mutate(payment.id)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setConfirmDialog({
                                      open: true,
                                      type: 'income',
                                      id: client.id,
                                      name: client.name,
                                      amount: client.retainer || 0
                                    })}
                                    disabled={!client.retainer}
                                  >
                                    סמן התקבל
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPaymentLinkClient({
                                    id: client.id,
                                    name: client.name,
                                    email: client.email || undefined,
                                    phone: client.phone || undefined,
                                    retainer: client.retainer || undefined
                                  })}
                                  disabled={!client.retainer}
                                  className="gap-1"
                                >
                                  <CreditCard className="h-4 w-4" />
                                  שלח קישור
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab - Combined Suppliers & Team */}
        <TabsContent value="expenses">
          <Card>
            <CardContent className="pt-6">
              {(suppliersLoading || campaignerPaymentsLoading) ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">שם</TableHead>
                        <TableHead className="text-right">סוג</TableHead>
                        <TableHead className="text-right">פרטים</TableHead>
                        <TableHead className="text-right">סכום לתשלום</TableHead>
                        <TableHead className="text-right">סטטוס תשלום</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {combinedExpenses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            לא נמצאו הוצאות
                          </TableCell>
                        </TableRow>
                      ) : (
                        combinedExpenses.map((expense) => {
                          const isPaid = isExpensePaid(expense.originalId, expense.type);
                          const payment = getExpensePayment(expense.originalId, expense.type);
                          return (
                            <TableRow key={expense.id}>
                              <TableCell className="font-medium text-right">{expense.name}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={expense.type === 'campaigner' ? 'default' : 'outline'}>
                                  {expense.type === 'supplier' ? 'ספק' : 'קמפיינר'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {expense.details || '-'}
                              </TableCell>
                              <TableCell className="text-right font-medium text-red-600">
                                {formatCurrency(expense.totalPayment)}
                              </TableCell>
                              <TableCell className="text-right">
                                {isPaid ? (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="default" className="bg-green-600">
                                      <Check className="h-3 w-3 ml-1" />
                                      שולם
                                    </Badge>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => payment && deleteExpensePayment.mutate(payment.id)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setConfirmDialog({
                                      open: true,
                                      type: 'expense',
                                      id: expense.originalId,
                                      name: expense.name,
                                      amount: expense.totalPayment,
                                      expenseType: expense.type
                                    })}
                                  >
                                    סמן שולם
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm Payment Dialog */}
      <Dialog open={!!confirmDialog?.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.type === 'expense' ? 'אישור תשלום' : 'אישור קבלת תשלום'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.type === 'expense' 
                ? `האם לסמן תשלום עבור ${confirmDialog?.name}?`
                : `האם לסמן שהתקבל תשלום מ${confirmDialog?.name}?`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
              <span className="font-medium">סכום:</span>
              <span className="text-xl font-bold">{formatCurrency(confirmDialog?.amount || 0)}</span>
            </div>
            <div className="flex justify-between items-center p-4 mt-2">
              <span className="font-medium">עבור חודש:</span>
              <span>{selectedMonthLabel}</span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              ביטול
            </Button>
            <Button
              onClick={() => {
                if (confirmDialog?.type === 'expense' && confirmDialog.expenseType) {
                  createExpensePayment.mutate({
                    expense_type: confirmDialog.expenseType,
                    expense_id: confirmDialog.id,
                    expense_name: confirmDialog.name,
                    amount: confirmDialog.amount
                  });
                } else if (confirmDialog?.type === 'income') {
                  createIncomePayment.mutate({
                    client_id: confirmDialog.id,
                    client_name: confirmDialog.name,
                    amount: confirmDialog.amount
                  });
                }
              }}
              disabled={createExpensePayment.isPending || createIncomePayment.isPending}
            >
              {confirmDialog?.type === 'expense' ? 'אישור תשלום' : 'אישור קבלה'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>היסטוריית תשלומים</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="expenses" dir="rtl">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="expenses">תשלומים ששולמו</TabsTrigger>
              <TabsTrigger value="incomes">תשלומים שהתקבלו</TabsTrigger>
            </TabsList>
            <TabsContent value="expenses">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">שם</TableHead>
                    <TableHead className="text-right">סוג</TableHead>
                    <TableHead className="text-right">סכום</TableHead>
                    <TableHead className="text-right">חודש</TableHead>
                    <TableHead className="text-right">תאריך תשלום</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentHistory?.expenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        אין היסטוריית תשלומים
                      </TableCell>
                    </TableRow>
                  ) : (
                    paymentHistory?.expenses.map((payment: any) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium text-right">{payment.expense_name}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={payment.expense_type === 'campaigner' ? 'default' : 'outline'}>
                            {payment.expense_type === 'supplier' ? 'ספק' : 'קמפיינר'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                        <TableCell className="text-right">{payment.payment_month}</TableCell>
                        <TableCell className="text-right">
                          {format(new Date(payment.paid_at), "dd/MM/yyyy HH:mm", { locale: he })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteExpensePayment.mutate(payment.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="incomes">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">לקוח</TableHead>
                    <TableHead className="text-right">סכום</TableHead>
                    <TableHead className="text-right">חודש</TableHead>
                    <TableHead className="text-right">תאריך קבלה</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentHistory?.incomes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        אין היסטוריית תשלומים
                      </TableCell>
                    </TableRow>
                  ) : (
                    paymentHistory?.incomes.map((payment: any) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium text-right">{payment.client_name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                        <TableCell className="text-right">{payment.payment_month}</TableCell>
                        <TableCell className="text-right">
                          {format(new Date(payment.received_at), "dd/MM/yyyy HH:mm", { locale: he })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteIncomePayment.mutate(payment.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Payment Link Dialog */}
      <CreatePaymentLinkDialog
        open={!!paymentLinkClient}
        onOpenChange={(open) => !open && setPaymentLinkClient(null)}
        client={paymentLinkClient}
      />
    </div>
  );
}

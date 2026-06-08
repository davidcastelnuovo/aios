import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, ChevronLeft, Download, AlertTriangle, TrendingUp, TrendingDown, Wallet, LineChart as LineChartIcon } from "lucide-react";
import { format, addMonths, subMonths, parse, getDaysInMonth, startOfMonth } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const fmt = (n: number) => `₪${Math.round(n).toLocaleString()}`;
const monthKey = (d: Date) => format(d, "yyyy-MM");
const monthLabel = (key: string) => format(parse(key, "yyyy-MM", new Date()), "MMMM yyyy", { locale: he });

const UNASSIGNED = "__unassigned__";

export function CashFlowTab() {
  const { tenantId } = useCurrentTenant();
  const qc = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
  const [drillAgency, setDrillAgency] = useState<{ id: string; name: string } | null>(null);
  const [chartAgency, setChartAgency] = useState<string>("all");

  // Forecast months (current + next 3)
  const forecastMonths = useMemo(() => {
    const base = parse(selectedMonth, "yyyy-MM", new Date());
    return [1, 2, 3].map((i) => monthKey(addMonths(base, i)));
  }, [selectedMonth]);

  const monthsToFetch = useMemo(() => [selectedMonth, ...forecastMonths], [selectedMonth, forecastMonths]);

  // --- Data fetches ---
  const { data: agencies } = useQuery({
    queryKey: ["cf-agencies", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("agencies").select("id, name").eq("tenant_id", tenantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: clients } = useQuery({
    queryKey: ["cf-clients", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, agency_id, retainer, monthly_fixed_expense, status")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: suppliers } = useQuery({
    queryKey: ["cf-suppliers", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, payment_1, agency_id_1, payment_2, agency_id_2, payment_3, agency_id_3")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: oneTimeIncomes } = useQuery({
    queryKey: ["cf-one-time", tenantId, monthsToFetch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("one_time_incomes")
        .select("id, client_id, product_name, amount, payment_month, is_paid")
        .eq("tenant_id", tenantId)
        .in("payment_month", monthsToFetch);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: incomePayments } = useQuery({
    queryKey: ["cf-income-payments", tenantId, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("income_payments")
        .select("id, client_id, amount, payment_month, received_at")
        .eq("tenant_id", tenantId)
        .eq("payment_month", selectedMonth);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: expensePayments } = useQuery({
    queryKey: ["cf-expense-payments", tenantId, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_payments")
        .select("id, expense_type, expense_id, amount, payment_month, paid_at")
        .eq("tenant_id", tenantId)
        .eq("payment_month", selectedMonth);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const isLoading = !agencies || !clients || !suppliers || !oneTimeIncomes || !incomePayments || !expensePayments;

  // --- Aggregations ---
  const clientById = useMemo(() => Object.fromEntries((clients || []).map((c) => [c.id, c])), [clients]);
  const supplierById = useMemo(() => Object.fromEntries((suppliers || []).map((s) => [s.id, s])), [suppliers]);
  const agencyById = useMemo(() => Object.fromEntries((agencies || []).map((a) => [a.id, a])), [agencies]);

  const agencyRows = useMemo(() => {
    if (isLoading) return [];
    const map: Record<string, {
      id: string;
      name: string;
      expectedIncome: number;
      actualIncome: number;
      expectedExpense: number;
      actualExpense: number;
    }> = {};

    const ensure = (id: string | null) => {
      const key = id || UNASSIGNED;
      if (!map[key]) {
        map[key] = {
          id: key,
          name: id ? agencyById[id]?.name || "—" : "ללא סוכנות",
          expectedIncome: 0,
          actualIncome: 0,
          expectedExpense: 0,
          actualExpense: 0,
        };
      }
      return map[key];
    };

    // Expected income: active clients' retainer
    (clients || []).filter((c) => c.status === "active").forEach((c) => {
      ensure(c.agency_id).expectedIncome += Number(c.retainer || 0);
    });
    // Expected income: one-time for the selected month
    (oneTimeIncomes || []).filter((o) => o.payment_month === selectedMonth).forEach((o) => {
      const c = clientById[o.client_id];
      ensure(c?.agency_id || null).expectedIncome += Number(o.amount || 0);
    });
    // Expected expense: clients' monthly fixed expense
    (clients || []).filter((c) => c.status === "active").forEach((c) => {
      ensure(c.agency_id).expectedExpense += Number(c.monthly_fixed_expense || 0);
    });
    // Expected expense: suppliers' 3 slots
    (suppliers || []).forEach((s: any) => {
      [1, 2, 3].forEach((i) => {
        const amt = Number(s[`payment_${i}`] || 0);
        if (amt > 0) ensure(s[`agency_id_${i}`] || null).expectedExpense += amt;
      });
    });

    // Actual income
    (incomePayments || []).forEach((p) => {
      const c = clientById[p.client_id];
      ensure(c?.agency_id || null).actualIncome += Number(p.amount || 0);
    });

    // Actual expense — attribute by source
    (expensePayments || []).forEach((p: any) => {
      let agencyId: string | null = null;
      if (p.expense_type === "supplier_payment" || p.expense_type === "supplier") {
        const s: any = supplierById[p.expense_id];
        if (s) {
          // pick the slot whose amount matches
          const slot = [1, 2, 3].find((i) => Number(s[`payment_${i}`] || 0) === Number(p.amount));
          agencyId = slot ? s[`agency_id_${slot}`] : s.agency_id_1;
        }
      } else {
        const c = clientById[p.expense_id];
        agencyId = c?.agency_id || null;
      }
      ensure(agencyId).actualExpense += Number(p.amount || 0);
    });

    return Object.values(map).sort((a, b) => b.expectedIncome - a.expectedIncome);
  }, [isLoading, clients, suppliers, oneTimeIncomes, incomePayments, expensePayments, clientById, supplierById, agencyById, selectedMonth]);

  const totals = useMemo(() => {
    return agencyRows.reduce(
      (acc, r) => ({
        expectedIncome: acc.expectedIncome + r.expectedIncome,
        actualIncome: acc.actualIncome + r.actualIncome,
        expectedExpense: acc.expectedExpense + r.expectedExpense,
        actualExpense: acc.actualExpense + r.actualExpense,
      }),
      { expectedIncome: 0, actualIncome: 0, expectedExpense: 0, actualExpense: 0 },
    );
  }, [agencyRows]);

  // --- Forecast (next 3 months) ---
  const forecast = useMemo(() => {
    if (isLoading) return [];
    return forecastMonths.map((mk) => {
      const perAgency: Record<string, { income: number; expense: number; name: string }> = {};
      const ensure = (id: string | null) => {
        const key = id || UNASSIGNED;
        if (!perAgency[key]) perAgency[key] = { income: 0, expense: 0, name: id ? agencyById[id]?.name || "—" : "ללא סוכנות" };
        return perAgency[key];
      };
      (clients || []).filter((c) => c.status === "active").forEach((c) => {
        const e = ensure(c.agency_id);
        e.income += Number(c.retainer || 0);
        e.expense += Number(c.monthly_fixed_expense || 0);
      });
      (suppliers || []).forEach((s: any) => {
        [1, 2, 3].forEach((i) => {
          const amt = Number(s[`payment_${i}`] || 0);
          if (amt > 0) ensure(s[`agency_id_${i}`] || null).expense += amt;
        });
      });
      (oneTimeIncomes || []).filter((o) => o.payment_month === mk).forEach((o) => {
        const c = clientById[o.client_id];
        ensure(c?.agency_id || null).income += Number(o.amount || 0);
      });
      return { month: mk, perAgency };
    });
  }, [isLoading, forecastMonths, clients, suppliers, oneTimeIncomes, clientById, agencyById]);

  // --- Running balance chart ---
  const chartData = useMemo(() => {
    if (isLoading) return [];
    const base = parse(selectedMonth, "yyyy-MM", new Date());
    const days = getDaysInMonth(base);
    const matchAgency = (id: string | null) => chartAgency === "all" || (id || UNASSIGNED) === chartAgency;

    // Actual events keyed by day
    const actualDelta: number[] = Array(days + 1).fill(0);
    (incomePayments || []).forEach((p) => {
      const c = clientById[p.client_id];
      if (!matchAgency(c?.agency_id || null)) return;
      const d = p.received_at ? new Date(p.received_at).getDate() : 1;
      actualDelta[Math.min(d, days)] += Number(p.amount || 0);
    });
    (expensePayments || []).forEach((p: any) => {
      let agencyId: string | null = null;
      if (p.expense_type === "supplier_payment" || p.expense_type === "supplier") {
        const s: any = supplierById[p.expense_id];
        if (s) {
          const slot = [1, 2, 3].find((i) => Number(s[`payment_${i}`] || 0) === Number(p.amount));
          agencyId = slot ? s[`agency_id_${slot}`] : s.agency_id_1;
        }
      } else {
        const c = clientById[p.expense_id];
        agencyId = c?.agency_id || null;
      }
      if (!matchAgency(agencyId)) return;
      const d = p.paid_at ? new Date(p.paid_at).getDate() : 1;
      actualDelta[Math.min(d, days)] -= Number(p.amount || 0);
    });

    // Expected: spread retainer income on day 1, expenses on day 1, one-time on day 15
    let expectedIncome = 0;
    let expectedExpense = 0;
    (clients || []).filter((c) => c.status === "active" && matchAgency(c.agency_id)).forEach((c) => {
      expectedIncome += Number(c.retainer || 0);
      expectedExpense += Number(c.monthly_fixed_expense || 0);
    });
    (suppliers || []).forEach((s: any) => {
      [1, 2, 3].forEach((i) => {
        const amt = Number(s[`payment_${i}`] || 0);
        if (amt > 0 && matchAgency(s[`agency_id_${i}`] || null)) expectedExpense += amt;
      });
    });
    let expectedOneTime = 0;
    (oneTimeIncomes || []).filter((o) => o.payment_month === selectedMonth).forEach((o) => {
      const c = clientById[o.client_id];
      if (matchAgency(c?.agency_id || null)) expectedOneTime += Number(o.amount || 0);
    });

    const expectedDelta: number[] = Array(days + 1).fill(0);
    expectedDelta[1] += expectedIncome - expectedExpense;
    expectedDelta[Math.min(15, days)] += expectedOneTime;

    let actualBal = 0;
    let expectedBal = 0;
    const rows: any[] = [];
    for (let d = 1; d <= days; d++) {
      actualBal += actualDelta[d];
      expectedBal += expectedDelta[d];
      rows.push({ day: d, actual: actualBal, expected: expectedBal });
    }
    return rows;
  }, [isLoading, selectedMonth, chartAgency, incomePayments, expensePayments, clients, suppliers, oneTimeIncomes, clientById, supplierById]);

  // --- Mutations: mark paid / collected ---
  const markIncome = useMutation({
    mutationFn: async ({ clientId, amount }: { clientId: string; amount: number }) => {
      const clientName = clientById[clientId]?.name || "—";
      const { error } = await supabase.from("income_payments").insert({
        tenant_id: tenantId!,
        client_id: clientId,
        client_name: clientName,
        amount,
        payment_month: selectedMonth,
        received_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cf-income-payments"] });
      toast.success("נרשם כנגבה");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unmarkIncome = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("income_payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cf-income-payments"] }),
  });

  const markExpense = useMutation({
    mutationFn: async ({ expenseType, expenseId, amount, name }: { expenseType: string; expenseId: string; amount: number; name: string }) => {
      const { error } = await supabase.from("expense_payments").insert({
        tenant_id: tenantId!,
        expense_type: expenseType,
        expense_id: expenseId,
        expense_name: name,
        amount,
        payment_month: selectedMonth,
        paid_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cf-expense-payments"] });
      toast.success("נרשם כשולם");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unmarkExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cf-expense-payments"] }),
  });

  // --- CSV export ---
  const exportCsv = () => {
    const headers = ["סוכנות", "הכנסות צפויות", "הכנסות בפועל", "הוצאות צפויות", "הוצאות בפועל", "תזרים צפוי", "תזרים בפועל", "פער"];
    const lines = [headers.join(",")];
    agencyRows.forEach((r) => {
      const netE = r.expectedIncome - r.expectedExpense;
      const netA = r.actualIncome - r.actualExpense;
      lines.push([r.name, r.expectedIncome, r.actualIncome, r.expectedExpense, r.actualExpense, netE, netA, netA - netE].join(","));
    });
    lines.push([
      "סה״כ",
      totals.expectedIncome,
      totals.actualIncome,
      totals.expectedExpense,
      totals.actualExpense,
      totals.expectedIncome - totals.expectedExpense,
      totals.actualIncome - totals.actualExpense,
      (totals.actualIncome - totals.actualExpense) - (totals.expectedIncome - totals.expectedExpense),
    ].join(","));
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cashflow_${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const expectedNet = totals.expectedIncome - totals.expectedExpense;
  const actualNet = totals.actualIncome - totals.actualExpense;
  const warning = expectedNet < 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Month selector + export */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setSelectedMonth(monthKey(subMonths(parse(selectedMonth, "yyyy-MM", new Date()), 1)))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="px-3 py-1.5 rounded-md border bg-muted/30 font-medium min-w-[160px] text-center">
            {monthLabel(selectedMonth)}
          </div>
          <Button variant="outline" size="icon" onClick={() => setSelectedMonth(monthKey(addMonths(parse(selectedMonth, "yyyy-MM", new Date()), 1)))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedMonth(monthKey(new Date()))}>
            החודש
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4 ml-2" />
          ייצוא CSV
        </Button>
      </div>

      {warning && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm font-medium">
            תזרים צפוי שלילי החודש: הוצאות ({fmt(totals.expectedExpense)}) עולות על הכנסות ({fmt(totals.expectedIncome)})
          </span>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="הכנסות צפויות" value={totals.expectedIncome} icon={<TrendingUp className="h-4 w-4" />} color="text-blue-600" />
        <KPI label="הכנסות בפועל" value={totals.actualIncome} icon={<TrendingUp className="h-4 w-4" />} color="text-green-600" />
        <KPI label="הוצאות צפויות" value={totals.expectedExpense} icon={<TrendingDown className="h-4 w-4" />} color="text-orange-600" />
        <KPI label="הוצאות בפועל" value={totals.actualExpense} icon={<TrendingDown className="h-4 w-4" />} color="text-red-600" />
      </div>

      {/* Agency table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            סיכום לפי סוכנות — {monthLabel(selectedMonth)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">סוכנות</TableHead>
                  <TableHead className="text-right">הכנסות צפויות</TableHead>
                  <TableHead className="text-right">הכנסות בפועל</TableHead>
                  <TableHead className="text-right">הוצאות צפויות</TableHead>
                  <TableHead className="text-right">הוצאות בפועל</TableHead>
                  <TableHead className="text-right">תזרים צפוי</TableHead>
                  <TableHead className="text-right">תזרים בפועל</TableHead>
                  <TableHead className="text-right">פער</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agencyRows.map((r) => {
                  const netE = r.expectedIncome - r.expectedExpense;
                  const netA = r.actualIncome - r.actualExpense;
                  const gap = netA - netE;
                  return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => r.id !== UNASSIGNED && setDrillAgency({ id: r.id, name: r.name })}
                    >
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{fmt(r.expectedIncome)}</TableCell>
                      <TableCell className="text-green-600">{fmt(r.actualIncome)}</TableCell>
                      <TableCell>{fmt(r.expectedExpense)}</TableCell>
                      <TableCell className="text-red-600">{fmt(r.actualExpense)}</TableCell>
                      <TableCell className={netE >= 0 ? "text-green-700" : "text-red-700"}>{fmt(netE)}</TableCell>
                      <TableCell className={netA >= 0 ? "text-green-700" : "text-red-700"}>{fmt(netA)}</TableCell>
                      <TableCell className={gap >= 0 ? "text-green-700" : "text-red-700"}>{fmt(gap)}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-bold bg-muted/40">
                  <TableCell>סה״כ</TableCell>
                  <TableCell>{fmt(totals.expectedIncome)}</TableCell>
                  <TableCell className="text-green-700">{fmt(totals.actualIncome)}</TableCell>
                  <TableCell>{fmt(totals.expectedExpense)}</TableCell>
                  <TableCell className="text-red-700">{fmt(totals.actualExpense)}</TableCell>
                  <TableCell className={expectedNet >= 0 ? "text-green-700" : "text-red-700"}>{fmt(expectedNet)}</TableCell>
                  <TableCell className={actualNet >= 0 ? "text-green-700" : "text-red-700"}>{fmt(actualNet)}</TableCell>
                  <TableCell className={actualNet - expectedNet >= 0 ? "text-green-700" : "text-red-700"}>{fmt(actualNet - expectedNet)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Forecast */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">תחזית 3 חודשים קדימה</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">סוכנות</TableHead>
                  {forecast.map((f) => (
                    <TableHead key={f.month} className="text-right">{monthLabel(f.month)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {agencyRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    {forecast.map((f) => {
                      const a = f.perAgency[r.id] || { income: 0, expense: 0 };
                      const net = a.income - a.expense;
                      return (
                        <TableCell key={f.month} className={net < 0 ? "text-red-600 font-medium" : "text-green-700"}>
                          {fmt(net)}
                          <div className="text-xs text-muted-foreground">{fmt(a.income)} − {fmt(a.expense)}</div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/40">
                  <TableCell>סה״כ</TableCell>
                  {forecast.map((f) => {
                    const sum = Object.values(f.perAgency).reduce(
                      (acc, a) => ({ income: acc.income + a.income, expense: acc.expense + a.expense }),
                      { income: 0, expense: 0 },
                    );
                    const net = sum.income - sum.expense;
                    return (
                      <TableCell key={f.month} className={net < 0 ? "text-red-700" : "text-green-700"}>
                        {fmt(net)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Running balance chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <LineChartIcon className="h-5 w-5" />
              יתרת תזרים מצטברת — {monthLabel(selectedMonth)}
            </CardTitle>
            <Select value={chartAgency} onValueChange={setChartAgency}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסוכנויות</SelectItem>
                {agencyRows.filter((r) => r.id !== UNASSIGNED).map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} labelFormatter={(l) => `יום ${l}`} />
                <Legend />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="actual" name="בפועל" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="expected" name="צפוי" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Drill-down */}
      <Dialog open={!!drillAgency} onOpenChange={(o) => !o && setDrillAgency(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{drillAgency?.name} — פירוט {monthLabel(selectedMonth)}</DialogTitle>
          </DialogHeader>
          {drillAgency && (
            <DrillContent
              agencyId={drillAgency.id}
              selectedMonth={selectedMonth}
              clients={clients || []}
              suppliers={suppliers || []}
              oneTimeIncomes={oneTimeIncomes || []}
              incomePayments={incomePayments || []}
              expensePayments={expensePayments || []}
              onMarkIncome={(p) => markIncome.mutate(p)}
              onUnmarkIncome={(id) => unmarkIncome.mutate(id)}
              onMarkExpense={(p) => markExpense.mutate(p)}
              onUnmarkExpense={(id) => unmarkExpense.mutate(id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPI({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className={color}>{icon}</div>
        </div>
        <div className={`text-2xl font-bold mt-1 ${color}`}>{fmt(value)}</div>
      </CardContent>
    </Card>
  );
}

function DrillContent({
  agencyId,
  selectedMonth,
  clients,
  suppliers,
  oneTimeIncomes,
  incomePayments,
  expensePayments,
  onMarkIncome,
  onUnmarkIncome,
  onMarkExpense,
  onUnmarkExpense,
}: any) {
  const agencyClients = clients.filter((c: any) => c.agency_id === agencyId && c.status === "active");
  const monthOneTime = oneTimeIncomes.filter((o: any) => {
    const c = clients.find((cl: any) => cl.id === o.client_id);
    return o.payment_month === selectedMonth && c?.agency_id === agencyId;
  });
  const monthExpenseSlots: { supplier: any; slot: number; amount: number }[] = [];
  suppliers.forEach((s: any) => {
    [1, 2, 3].forEach((i) => {
      if (s[`agency_id_${i}`] === agencyId && Number(s[`payment_${i}`] || 0) > 0) {
        monthExpenseSlots.push({ supplier: s, slot: i, amount: Number(s[`payment_${i}`]) });
      }
    });
  });

  const findIncomePayment = (clientId: string, amount: number) =>
    incomePayments.find((p: any) => p.client_id === clientId && Number(p.amount) === amount);
  const findExpensePayment = (expenseId: string, amount: number) =>
    expensePayments.find((p: any) => p.expense_id === expenseId && Number(p.amount) === amount);

  return (
    <div className="space-y-6">
      {/* Income */}
      <div>
        <h4 className="font-semibold mb-2 text-green-700">הכנסות</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">לקוח / פריט</TableHead>
              <TableHead className="text-right">סוג</TableHead>
              <TableHead className="text-right">סכום</TableHead>
              <TableHead className="text-right">נגבה?</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agencyClients.filter((c: any) => Number(c.retainer || 0) > 0).map((c: any) => {
              const paid = findIncomePayment(c.id, Number(c.retainer));
              return (
                <TableRow key={`r-${c.id}`}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">רטיינר</TableCell>
                  <TableCell>{fmt(Number(c.retainer))}</TableCell>
                  <TableCell>
                    <Switch
                      checked={!!paid}
                      onCheckedChange={(v) => v ? onMarkIncome({ clientId: c.id, amount: Number(c.retainer) }) : paid && onUnmarkIncome(paid.id)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {monthOneTime.map((o: any) => {
              const c = clients.find((cl: any) => cl.id === o.client_id);
              const paid = findIncomePayment(o.client_id, Number(o.amount));
              return (
                <TableRow key={`o-${o.id}`}>
                  <TableCell>{c?.name} — {o.product_name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">חד-פעמי</TableCell>
                  <TableCell>{fmt(Number(o.amount))}</TableCell>
                  <TableCell>
                    <Switch
                      checked={!!paid}
                      onCheckedChange={(v) => v ? onMarkIncome({ clientId: o.client_id, amount: Number(o.amount) }) : paid && onUnmarkIncome(paid.id)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Expenses */}
      <div>
        <h4 className="font-semibold mb-2 text-red-700">הוצאות</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">פריט</TableHead>
              <TableHead className="text-right">סוג</TableHead>
              <TableHead className="text-right">סכום</TableHead>
              <TableHead className="text-right">שולם?</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agencyClients.filter((c: any) => Number(c.monthly_fixed_expense || 0) > 0).map((c: any) => {
              const paid = findExpensePayment(c.id, Number(c.monthly_fixed_expense));
              return (
                <TableRow key={`ex-${c.id}`}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">הוצאת לקוח קבועה</TableCell>
                  <TableCell>{fmt(Number(c.monthly_fixed_expense))}</TableCell>
                  <TableCell>
                    <Switch
                      checked={!!paid}
                      onCheckedChange={(v) => v
                        ? onMarkExpense({ expenseType: "client_fixed", expenseId: c.id, amount: Number(c.monthly_fixed_expense), name: c.name })
                        : paid && onUnmarkExpense(paid.id)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {monthExpenseSlots.map(({ supplier, slot, amount }) => {
              const paid = findExpensePayment(supplier.id, amount);
              return (
                <TableRow key={`sp-${supplier.id}-${slot}`}>
                  <TableCell>{supplier.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">תשלום ספק #{slot}</TableCell>
                  <TableCell>{fmt(amount)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={!!paid}
                      onCheckedChange={(v) => v
                        ? onMarkExpense({ expenseType: "supplier_payment", expenseId: supplier.id, amount, name: supplier.name })
                        : paid && onUnmarkExpense(paid.id)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

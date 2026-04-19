import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, TrendingUp, Package, Users } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Props {
  clientId: string;
  tenantId: string;
  dateFilter: string;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
const formatNumber = (n: number) => new Intl.NumberFormat('he-IL').format(n);

// Standard (UTC, aligned with WooCommerce admin):
// - last_7_days = most recent COMPLETED week, Sunday → Saturday (UTC).
//   e.g. if today is Wed Apr 23, the range is Sun Apr 13 → Sat Apr 19.
// - Other relative ranges (30/70) end YESTERDAY in UTC.
// All boundaries computed in UTC so they line up with woocommerce_orders.date_created
// (which is stored as UTC timestamptz) and match Woo admin reports.
const getDateRange = (filter: string): { start: Date; end: Date } => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  // Yesterday (UTC) full-day boundaries
  let start = new Date(Date.UTC(y, m, d - 1, 0, 0, 0, 0));
  let end = new Date(Date.UTC(y, m, d - 1, 23, 59, 59, 999));

  switch (filter) {
    case 'today':
      start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
      end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
      break;
    case 'yesterday':
      // already set above
      break;
    case 'last_7_days': {
      // Most recent completed Sun→Sat week (UTC).
      // Find the most recent Saturday on or before yesterday.
      const yesterday = new Date(Date.UTC(y, m, d - 1));
      const dow = yesterday.getUTCDay(); // 0=Sun .. 6=Sat
      const daysSinceSat = (dow + 1) % 7; // Sat=0, Sun=1, ..., Fri=6
      const sat = new Date(Date.UTC(y, m, d - 1 - daysSinceSat, 23, 59, 59, 999));
      const sun = new Date(Date.UTC(sat.getUTCFullYear(), sat.getUTCMonth(), sat.getUTCDate() - 6, 0, 0, 0, 0));
      start = sun;
      end = sat;
      break;
    }
    case 'last_30_days':
      start = new Date(Date.UTC(y, m, d - 30, 0, 0, 0, 0));
      // end already yesterday
      break;
    case 'last_70_days':
      start = new Date(Date.UTC(y, m, d - 70, 0, 0, 0, 0));
      break;
    case 'this_month':
      start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
      end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
      break;
    case 'last_month':
      start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
      end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      break;
    default:
      start = new Date(Date.UTC(y, m, d - 7, 0, 0, 0, 0));
  }
  return { start, end };
};

export function WooCommerceDashboard({ clientId, tenantId, dateFilter }: Props) {
  // Find linked WooCommerce sites for the client
  const { data: sites = [] } = useQuery({
    queryKey: ['woo-sites-for-client', clientId, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_media_wordpress_sites' as any)
        .select('id, site_name, site_url, woo_last_sync_at')
        .eq('client_id', clientId)
        .eq('tenant_id', tenantId)
        .eq('woocommerce_enabled', true)
        .eq('is_active', true);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!clientId && !!tenantId,
  });

  const siteIds = sites.map((s: any) => s.id);
  const { start, end } = getDateRange(dateFilter);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['woo-orders', siteIds.join(','), dateFilter],
    queryFn: async () => {
      if (siteIds.length === 0) return [];
      const { data, error } = await supabase
        .from('woocommerce_orders' as any)
        .select('id, total, status, date_created, customer_email, customer_first_name, customer_last_name, line_items, order_number, currency')
        .in('site_id', siteIds)
        .gte('date_created', start.toISOString())
        .lte('date_created', end.toISOString())
        .order('date_created', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data as any[];
    },
    enabled: siteIds.length > 0,
  });

  const summary = useMemo(() => {
    const validStatuses = ['completed', 'processing', 'on-hold'];
    const valid = orders.filter((o: any) => validStatuses.includes(o.status));
    const totalRevenue = valid.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
    const orderCount = valid.length;
    const cancelledCount = orders.filter((o: any) => ['cancelled', 'refunded', 'failed'].includes(o.status)).length;
    const aov = orderCount > 0 ? totalRevenue / orderCount : 0;
    const uniqueCustomers = new Set(valid.map((o: any) => o.customer_email).filter(Boolean)).size;
    return { totalRevenue, orderCount, cancelledCount, aov, uniqueCustomers, totalOrders: orders.length };
  }, [orders]);

  const dailyData = useMemo(() => {
    const map: Record<string, { date: string; revenue: number; orders: number }> = {};
    const validStatuses = ['completed', 'processing', 'on-hold'];
    orders.filter((o: any) => validStatuses.includes(o.status)).forEach((o: any) => {
      const d = new Date(o.date_created).toISOString().slice(0, 10);
      if (!map[d]) map[d] = { date: d, revenue: 0, orders: 0 };
      map[d].revenue += Number(o.total || 0);
      map[d].orders += 1;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [orders]);

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; quantity: number; revenue: number }> = {};
    const validStatuses = ['completed', 'processing', 'on-hold'];
    orders.filter((o: any) => validStatuses.includes(o.status)).forEach((o: any) => {
      const items = Array.isArray(o.line_items) ? o.line_items : [];
      items.forEach((item: any) => {
        const name = item.name || 'מוצר ללא שם';
        if (!map[name]) map[name] = { name, quantity: 0, revenue: 0 };
        map[name].quantity += Number(item.quantity || 0);
        map[name].revenue += Number(item.total || 0);
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [orders]);

  if (sites.length === 0) {
    return (
      <Card className="p-12 text-center">
        <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
        <h3 className="text-lg font-semibold mb-2">אין אתר WooCommerce משויך ללקוח</h3>
        <p className="text-muted-foreground">שייך אתר ללקוח דרך הגדרות WordPress</p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <TrendingUp className="h-5 w-5 text-emerald-600 mb-1" />
            <p className="text-sm text-muted-foreground">הכנסות (WooCommerce)</p>
            <p className="text-3xl font-bold mt-2">{formatCurrency(summary.totalRevenue)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <ShoppingCart className="h-5 w-5 text-blue-600 mb-1" />
            <p className="text-sm text-muted-foreground">הזמנות</p>
            <p className="text-3xl font-bold mt-2">{formatNumber(summary.orderCount)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <Package className="h-5 w-5 text-purple-600 mb-1" />
            <p className="text-sm text-muted-foreground">ערך הזמנה ממוצע</p>
            <p className="text-3xl font-bold mt-2">{formatCurrency(summary.aov)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <Users className="h-5 w-5 text-amber-600 mb-1" />
            <p className="text-sm text-muted-foreground">לקוחות ייחודיים</p>
            <p className="text-3xl font-bold mt-2">{formatNumber(summary.uniqueCustomers)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">בוטלו / הוחזרו</p>
            <p className="text-3xl font-bold mt-2">{formatNumber(summary.cancelledCount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily chart */}
      {dailyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>הכנסות יומיות</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip
                  formatter={(value: any, name: string) =>
                    name === 'revenue' ? formatCurrency(Number(value)) : formatNumber(Number(value))
                  }
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="revenue" name="הכנסות" stroke="#10b981" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="orders" name="הזמנות" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top products */}
      {topProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>מוצרים מובילים</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>מוצר</TableHead>
                  <TableHead className="text-left">כמות</TableHead>
                  <TableHead className="text-left">הכנסות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-left">{formatNumber(p.quantity)}</TableCell>
                    <TableCell className="text-left">{formatCurrency(p.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent orders */}
      <Card>
        <CardHeader>
          <CardTitle>הזמנות אחרונות ({summary.totalOrders})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>הזמנה</TableHead>
                <TableHead>תאריך</TableHead>
                <TableHead>לקוח</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead className="text-left">סכום</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.slice(0, 50).map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell>#{o.order_number}</TableCell>
                  <TableCell>{new Date(o.date_created).toLocaleDateString('he-IL')}</TableCell>
                  <TableCell>{[o.customer_first_name, o.customer_last_name].filter(Boolean).join(' ') || o.customer_email || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={['completed', 'processing'].includes(o.status) ? 'default' : 'secondary'}>
                      {o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-left font-medium">{formatCurrency(Number(o.total))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

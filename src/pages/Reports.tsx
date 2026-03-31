import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  BarChart3, ShoppingCart, Package, Users, TrendingUp, Globe,
  RefreshCw, Loader2, Search, ArrowUpRight, ArrowDownRight,
  Download, Calendar,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "ממתין", color: "bg-yellow-100 text-yellow-800" },
  processing: { label: "בעיבוד", color: "bg-blue-100 text-blue-800" },
  "on-hold": { label: "בהמתנה", color: "bg-gray-100 text-gray-800" },
  completed: { label: "הושלם", color: "bg-green-100 text-green-800" },
  cancelled: { label: "בוטל", color: "bg-red-100 text-red-800" },
  refunded: { label: "הוחזר", color: "bg-purple-100 text-purple-800" },
  failed: { label: "נכשל", color: "bg-red-200 text-red-900" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] || { label: status, color: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

function formatCurrency(amount: number | null | undefined, currency = "ILS") {
  if (amount == null) return "—";
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: currency === "ILS" ? "ILS" : currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Reports() {
  const { tenantId } = useCurrentTenant();
  const { isSuperAdmin } = useUserRole();
  const queryClient = useQueryClient();

  const [selectedSite, setSelectedSite] = useState<string>("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("30");

  // Fetch all WordPress/WooCommerce sites
  const { data: sites = [] } = useQuery({
    queryKey: ["woo-sites-report", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from("social_media_wordpress_sites" as any)
        .select("id, site_name, site_url, woocommerce_enabled, woo_last_sync_at, tenant_id")
        .eq("woocommerce_enabled", true)
        .eq("is_active", true);
      if (!isSuperAdmin) q = q.eq("tenant_id", tenantId);
      const { data } = await q;
      return (data || []) as any[];
    },
    enabled: !!tenantId,
  });

  // Compute date filter
  const dateFrom = dateRange !== "all"
    ? new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Fetch orders
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["woo-orders-report", tenantId, selectedSite, orderStatusFilter, dateRange],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from("woocommerce_orders" as any)
        .select("*")
        .order("date_created", { ascending: false })
        .limit(500);
      if (!isSuperAdmin) q = q.eq("tenant_id", tenantId);
      if (selectedSite !== "all") q = q.eq("site_id", selectedSite);
      if (orderStatusFilter !== "all") q = q.eq("status", orderStatusFilter);
      if (dateFrom) q = q.gte("date_created", dateFrom);
      const { data } = await q;
      return (data || []) as any[];
    },
    enabled: !!tenantId,
  });

  // Fetch products
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["woo-products-report", tenantId, selectedSite],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from("woocommerce_products" as any)
        .select("*")
        .order("total_sales", { ascending: false })
        .limit(200);
      if (!isSuperAdmin) q = q.eq("tenant_id", tenantId);
      if (selectedSite !== "all") q = q.eq("site_id", selectedSite);
      const { data } = await q;
      return (data || []) as any[];
    },
    enabled: !!tenantId,
  });

  // Fetch customers
  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ["woo-customers-report", tenantId, selectedSite],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from("woocommerce_customers" as any)
        .select("*")
        .order("total_spent", { ascending: false })
        .limit(200);
      if (!isSuperAdmin) q = q.eq("tenant_id", tenantId);
      if (selectedSite !== "all") q = q.eq("site_id", selectedSite);
      const { data } = await q;
      return (data || []) as any[];
    },
    enabled: !!tenantId,
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async (siteId?: string) => {
      const body = siteId ? { site_id: siteId } : {};
      const { data, error } = await supabase.functions.invoke("sync-woocommerce-data", { body });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["woo-orders-report"] });
      queryClient.invalidateQueries({ queryKey: ["woo-products-report"] });
      queryClient.invalidateQueries({ queryKey: ["woo-customers-report"] });
      queryClient.invalidateQueries({ queryKey: ["woo-sites-report"] });
      toast.success(`סנכרון הושלם: ${data?.orders_synced ?? 0} הזמנות`);
    },
    onError: (e: Error) => toast.error("שגיאת סנכרון: " + e.message),
  });

  // Computed stats
  const completedOrders = orders.filter((o) => ["completed", "processing"].includes(o.status));
  const totalRevenue = completedOrders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
  const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
  const totalCustomers = customers.length;
  const topCustomers = [...customers].sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0)).slice(0, 5);

  // Revenue by status
  const revenueByStatus = orders.reduce((acc: Record<string, number>, o) => {
    acc[o.status] = (acc[o.status] || 0) + (parseFloat(o.total) || 0);
    return acc;
  }, {});

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    if (!orderSearch) return true;
    const q = orderSearch.toLowerCase();
    return (
      (o.order_number || "").toLowerCase().includes(q) ||
      (o.customer_email || "").toLowerCase().includes(q) ||
      (o.customer_first_name || "").toLowerCase().includes(q) ||
      (o.customer_last_name || "").toLowerCase().includes(q)
    );
  });

  if (sites.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h2 className="text-3xl font-bold">דוחות</h2>
        </div>
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShoppingCart className="h-16 w-16 text-muted-foreground mb-4 opacity-40" />
            <h3 className="text-xl font-semibold mb-2">אין נתוני WooCommerce</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              חבר אתרי WooCommerce בדף האינטגרציות כדי לראות דוחות הזמנות, מוצרים ולקוחות
            </p>
            <Button variant="outline" onClick={() => window.history.back()}>
              <Globe className="h-4 w-4 ml-2" />
              עבור להגדרות WordPress
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold">דוחות WooCommerce</h2>
          <p className="text-muted-foreground mt-1">
            נתוני הזמנות, מוצרים ולקוחות מכל האתרים המחוברים
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Site filter */}
          <Select value={selectedSite} onValueChange={setSelectedSite}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="כל האתרים" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל האתרים ({sites.length})</SelectItem>
              {sites.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.site_name || s.site_url}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date range */}
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 ימים אחרונים</SelectItem>
              <SelectItem value="30">30 ימים אחרונים</SelectItem>
              <SelectItem value="90">90 ימים אחרונים</SelectItem>
              <SelectItem value="365">שנה אחרונה</SelectItem>
              <SelectItem value="all">כל הזמן</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() =>
              syncMutation.mutate(selectedSite !== "all" ? selectedSite : undefined)
            }
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : (
              <RefreshCw className="h-4 w-4 ml-2" />
            )}
            סנכרן
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">הכנסות</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalRevenue)}
                </p>
                <p className="text-xs text-muted-foreground">{completedOrders.length} הזמנות</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500 opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">סה"כ הזמנות</p>
                <p className="text-2xl font-bold">{orders.length}</p>
                <p className="text-xs text-muted-foreground">
                  ממוצע: {formatCurrency(avgOrderValue)}
                </p>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-500 opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">מוצרים</p>
                <p className="text-2xl font-bold">{products.length}</p>
                <p className="text-xs text-muted-foreground">
                  {products.filter((p: any) => p.stock_status === "instock").length} במלאי
                </p>
              </div>
              <Package className="h-8 w-8 text-purple-500 opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">לקוחות</p>
                <p className="text-2xl font-bold">{totalCustomers}</p>
                <p className="text-xs text-muted-foreground">
                  {customers.filter((c: any) => c.orders_count > 1).length} חוזרים
                </p>
              </div>
              <Users className="h-8 w-8 text-orange-500 opacity-70" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">הזמנות ({orders.length})</TabsTrigger>
          <TabsTrigger value="products">מוצרים ({products.length})</TabsTrigger>
          <TabsTrigger value="customers">לקוחות ({customers.length})</TabsTrigger>
          <TabsTrigger value="overview">סקירה כללית</TabsTrigger>
        </TabsList>

        {/* ---- Orders Tab ---- */}
        <TabsContent value="orders" className="mt-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי מספר הזמנה, אימייל, שם..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="כל הסטטוסים" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {loadingOrders ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>אין הזמנות להצגה</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>לקוח</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>סכום</TableHead>
                      <TableHead>תאריך</TableHead>
                      <TableHead>אתר</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.slice(0, 100).map((order: any) => {
                      const site = sites.find((s: any) => s.id === order.site_id);
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">
                            #{order.order_number || order.woo_order_id}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">
                                {[order.customer_first_name, order.customer_last_name]
                                  .filter(Boolean)
                                  .join(" ") || "אנונימי"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {order.customer_email}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={order.status} />
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(parseFloat(order.total), order.currency)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {order.date_created
                              ? new Date(order.date_created).toLocaleDateString("he-IL")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {site?.site_name || site?.site_url || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          {filteredOrders.length > 100 && (
            <p className="text-sm text-muted-foreground text-center">
              מוצגות 100 מתוך {filteredOrders.length} הזמנות
            </p>
          )}
        </TabsContent>

        {/* ---- Products Tab ---- */}
        <TabsContent value="products" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loadingProducts ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>אין מוצרים להצגה</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>מוצר</TableHead>
                      <TableHead>מחיר</TableHead>
                      <TableHead>מלאי</TableHead>
                      <TableHead>מכירות</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>אתר</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product: any) => {
                      const site = sites.find((s: any) => s.id === product.site_id);
                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{product.name}</p>
                              {product.sku && (
                                <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-semibold text-sm">
                                {formatCurrency(parseFloat(product.price))}
                              </p>
                              {product.sale_price && (
                                <p className="text-xs text-green-600">
                                  מבצע: {formatCurrency(parseFloat(product.sale_price))}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {product.stock_quantity != null ? (
                              <span className={product.stock_quantity < 5 ? "text-red-600 font-medium" : ""}>
                                {product.stock_quantity}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{product.total_sales || 0}</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={product.stock_status === "instock" ? "default" : "secondary"}
                              className={product.stock_status === "instock" ? "bg-green-600" : ""}
                            >
                              {product.stock_status === "instock" ? "במלאי" : "אזל"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {site?.site_name || site?.site_url || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Customers Tab ---- */}
        <TabsContent value="customers" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loadingCustomers ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : customers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>אין לקוחות להצגה</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>לקוח</TableHead>
                      <TableHead>הזמנות</TableHead>
                      <TableHead>סה"כ הוצאה</TableHead>
                      <TableHead>ממוצע הזמנה</TableHead>
                      <TableHead>אתר</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer: any) => {
                      const site = sites.find((s: any) => s.id === customer.site_id);
                      const avg = customer.orders_count > 0
                        ? customer.total_spent / customer.orders_count
                        : 0;
                      return (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">
                                {[customer.first_name, customer.last_name]
                                  .filter(Boolean)
                                  .join(" ") || customer.username || "אנונימי"}
                              </p>
                              <p className="text-xs text-muted-foreground">{customer.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {customer.orders_count || 0}
                          </TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatCurrency(customer.total_spent)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatCurrency(avg)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {site?.site_name || site?.site_url || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Overview Tab ---- */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Revenue by status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">הכנסות לפי סטטוס</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(Object.entries(revenueByStatus) as [string, number][])
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, amount]) => {
                    const s = STATUS_LABELS[status] || { label: status, color: "" };
                    const pct = totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0;
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{s.label}</span>
                          <span className="font-medium">{formatCurrency(amount)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>

            {/* Top customers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">לקוחות מובילים</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topCustomers.map((c: any, i) => (
                  <div key={c.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm w-5">{i + 1}.</span>
                      <div>
                        <p className="text-sm font-medium">
                          {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email}
                        </p>
                        <p className="text-xs text-muted-foreground">{c.orders_count} הזמנות</p>
                      </div>
                    </div>
                    <span className="font-semibold text-green-600 text-sm">
                      {formatCurrency(c.total_spent)}
                    </span>
                  </div>
                ))}
                {topCustomers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">אין נתונים</p>
                )}
              </CardContent>
            </Card>

            {/* Sites summary */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">סיכום לפי אתר</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>אתר</TableHead>
                      <TableHead>הזמנות</TableHead>
                      <TableHead>הכנסות</TableHead>
                      <TableHead>מוצרים</TableHead>
                      <TableHead>לקוחות</TableHead>
                      <TableHead>סנכרון אחרון</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sites.map((site: any) => {
                      const siteOrders = orders.filter((o: any) => o.site_id === site.id);
                      const siteRevenue = siteOrders
                        .filter((o: any) => ["completed", "processing"].includes(o.status))
                        .reduce((s: number, o: any) => s + (parseFloat(o.total) || 0), 0);
                      const siteProducts = products.filter((p: any) => p.site_id === site.id);
                      const siteCustomers = customers.filter((c: any) => c.site_id === site.id);
                      return (
                        <TableRow key={site.id}>
                          <TableCell className="font-medium">
                            {site.site_name || site.site_url}
                          </TableCell>
                          <TableCell>{siteOrders.length}</TableCell>
                          <TableCell className="text-green-600 font-semibold">
                            {formatCurrency(siteRevenue)}
                          </TableCell>
                          <TableCell>{siteProducts.length}</TableCell>
                          <TableCell>{siteCustomers.length}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {site.woo_last_sync_at
                              ? new Date(site.woo_last_sync_at).toLocaleString("he-IL")
                              : "לא סונכרן"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

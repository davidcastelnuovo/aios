import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Globe, ShoppingCart, Package, Users, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface ClientWordPressTabProps {
  clientId: string;
}

export function ClientWordPressTab({ clientId }: ClientWordPressTabProps) {
  const queryClient = useQueryClient();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Fetch sites linked to this client
  const { data: sites = [], isLoading: loadingSites } = useQuery({
    queryKey: ["client-wp-sites", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_media_wordpress_sites" as any)
        .select("*")
        .eq("client_id", clientId);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!clientId,
  });

  const siteIds = sites.map((s) => s.id);

  // Aggregate WooCommerce data for these sites
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["client-woo-orders", siteIds],
    queryFn: async () => {
      if (siteIds.length === 0) return [];
      const { data, error } = await supabase
        .from("woocommerce_orders" as any)
        .select("*")
        .in("site_id", siteIds)
        .order("date_created", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: siteIds.length > 0,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["client-woo-products", siteIds],
    queryFn: async () => {
      if (siteIds.length === 0) return [];
      const { data, error } = await supabase
        .from("woocommerce_products" as any)
        .select("*")
        .in("site_id", siteIds)
        .order("total_sales", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: siteIds.length > 0,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["client-woo-customers", siteIds],
    queryFn: async () => {
      if (siteIds.length === 0) return [];
      const { data, error } = await supabase
        .from("woocommerce_customers" as any)
        .select("*")
        .in("site_id", siteIds)
        .order("total_spent", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: siteIds.length > 0,
  });

  const syncMutation = useMutation({
    mutationFn: async (siteId: string) => {
      setSyncingId(siteId);
      const { data, error } = await supabase.functions.invoke("sync-woocommerce-data", {
        body: { site_id: siteId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["client-wp-sites", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client-woo-orders"] });
      queryClient.invalidateQueries({ queryKey: ["client-woo-products"] });
      queryClient.invalidateQueries({ queryKey: ["client-woo-customers"] });
      toast.success(
        `סנכרון הושלם: ${data?.orders_synced ?? 0} הזמנות, ${data?.products_synced ?? 0} מוצרים, ${data?.customers_synced ?? 0} לקוחות`
      );
    },
    onError: (e: Error) => toast.error("שגיאת סנכרון: " + e.message),
    onSettled: () => setSyncingId(null),
  });

  if (loadingSites) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <Globe className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">
            אין אתר וורדפרס מקושר ללקוח זה.
          </p>
          <p className="text-xs text-muted-foreground">
            שייך אתר בעמוד הגדרות וורדפרס ובחר את הלקוח הזה.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Stats
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const completedOrders = orders.filter((o) => o.status === "completed").length;
  const currency = orders[0]?.currency || "ILS";
  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("he-IL", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-4" dir="rtl">
      {/* Sites header */}
      <div className="space-y-3">
        {sites.map((site) => (
          <Card key={site.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                  <Globe className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{site.site_name || site.site_url}</p>
                  <a
                    href={site.site_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                    dir="ltr"
                  >
                    {site.site_url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {site.woocommerce_enabled ? (
                  <Badge variant="default" className="gap-1">
                    <ShoppingCart className="h-3 w-3" />
                    WooCommerce
                  </Badge>
                ) : (
                  <Badge variant="secondary">WordPress בלבד</Badge>
                )}
                {site.woocommerce_enabled && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => syncMutation.mutate(site.id)}
                    disabled={syncingId === site.id}
                  >
                    {syncingId === site.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin me-1" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 me-1" />
                    )}
                    סנכרן
                  </Button>
                )}
              </div>
            </CardHeader>
            {site.woo_last_sync_at && (
              <CardContent className="py-2 border-t text-xs text-muted-foreground">
                סנכרון אחרון: {format(new Date(site.woo_last_sync_at), "dd/MM/yyyy HH:mm", { locale: he })}
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Show data only if WooCommerce is enabled on at least one site */}
      {sites.some((s) => s.woocommerce_enabled) ? (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={ShoppingCart} label="סה״כ הזמנות" value={String(orders.length)} color="text-blue-600" />
            <StatCard icon={ShoppingCart} label="הזמנות שהושלמו" value={String(completedOrders)} color="text-green-600" />
            <StatCard icon={Package} label="מוצרים" value={String(products.length)} color="text-purple-600" />
            <StatCard icon={Users} label="לקוחות" value={String(customers.length)} color="text-orange-600" />
          </div>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">סך הכנסות ({orders.length} הזמנות אחרונות)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{fmtMoney(totalRevenue)}</p>
            </CardContent>
          </Card>

          {/* Tabs for data */}
          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="orders">הזמנות</TabsTrigger>
              <TabsTrigger value="products">מוצרים</TabsTrigger>
              <TabsTrigger value="customers">לקוחות</TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="mt-3">
              <Card>
                <CardContent className="p-0">
                  {loadingOrders ? (
                    <div className="py-8 flex justify-center">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : orders.length === 0 ? (
                    <EmptyState text="אין הזמנות. לחץ 'סנכרן' לטעינה." />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>הזמנה</TableHead>
                          <TableHead>לקוח</TableHead>
                          <TableHead>סטטוס</TableHead>
                          <TableHead>סכום</TableHead>
                          <TableHead>תאריך</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="font-medium">#{o.order_number}</TableCell>
                            <TableCell>
                              {[o.customer_first_name, o.customer_last_name].filter(Boolean).join(" ") ||
                                o.customer_email ||
                                "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={o.status === "completed" ? "default" : "secondary"}>{o.status}</Badge>
                            </TableCell>
                            <TableCell>{fmtMoney(Number(o.total) || 0)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {o.date_created
                                ? format(new Date(o.date_created), "dd/MM/yyyy", { locale: he })
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="products" className="mt-3">
              <Card>
                <CardContent className="p-0">
                  {products.length === 0 ? (
                    <EmptyState text="אין מוצרים. לחץ 'סנכרן' לטעינה." />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>מוצר</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>מחיר</TableHead>
                          <TableHead>מלאי</TableHead>
                          <TableHead>נמכרו</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell className="text-xs">{p.sku || "—"}</TableCell>
                            <TableCell>{p.price ? fmtMoney(Number(p.price)) : "—"}</TableCell>
                            <TableCell>
                              <Badge variant={p.stock_status === "instock" ? "default" : "secondary"}>
                                {p.stock_quantity ?? p.stock_status}
                              </Badge>
                            </TableCell>
                            <TableCell>{p.total_sales || 0}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="customers" className="mt-3">
              <Card>
                <CardContent className="p-0">
                  {customers.length === 0 ? (
                    <EmptyState text="אין לקוחות. לחץ 'סנכרן' לטעינה." />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>שם</TableHead>
                          <TableHead>אימייל</TableHead>
                          <TableHead>הזמנות</TableHead>
                          <TableHead>סה״כ הוציא</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">
                              {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.username || "—"}
                            </TableCell>
                            <TableCell className="text-xs" dir="ltr">{c.email}</TableCell>
                            <TableCell>{c.orders_count || 0}</TableCell>
                            <TableCell>{fmtMoney(Number(c.total_spent) || 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">
              WooCommerce לא מופעל באתרים המקושרים. הפעל אותו בהגדרות הוורדפרס כדי לראות נתוני חנות.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={`h-8 w-8 ${color}`} />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{text}</p>;
}

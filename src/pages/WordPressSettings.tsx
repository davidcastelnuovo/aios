import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useUserRole } from "@/hooks/useUserRole";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useNavigate } from "react-router-dom";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Globe, Plus, Trash2, Loader2, ExternalLink, RefreshCw,
  ShoppingCart, ArrowLeft, Settings, CheckCircle2, AlertCircle,
  Edit, Key,
} from "lucide-react";

interface WordPressSite {
  id: string;
  tenant_id: string;
  site_url: string;
  username: string;
  app_password: string;
  site_name: string | null;
  is_active: boolean;
  woocommerce_enabled: boolean;
  woo_consumer_key: string | null;
  woo_consumer_secret: string | null;
  woo_last_sync_at: string | null;
  woo_sync_enabled: boolean;
  client_id: string | null;
  notes: string | null;
  created_at: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface Client {
  id: string;
  name: string;
}

const emptyForm = {
  site_url: "",
  username: "",
  app_password: "",
  site_name: "",
  notes: "",
  woocommerce_enabled: false,
  woo_consumer_key: "",
  woo_consumer_secret: "",
  woo_sync_enabled: false,
  tenant_id: "",
  client_id: "",
};

export default function WordPressSettings() {
  const { tenant: currentTenant, tenantId } = useCurrentTenant();
  const { isSuperAdmin } = useUserRole();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [editSite, setEditSite] = useState<WordPressSite | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [filterTenant, setFilterTenant] = useState<string>("all");
  const [testingId, setTestingId] = useState<string | null>(null);

  // Fetch all tenants (super admin only)
  const { data: allTenants = [] } = useQuery<Tenant[]>({
    queryKey: ["all-tenants-for-wp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, slug")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  // Fetch clients for the selected tenant
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients-for-wp", form.tenant_id || tenantId],
    queryFn: async () => {
      const tid = form.tenant_id || tenantId;
      if (!tid) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("tenant_id", tid)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!(form.tenant_id || tenantId),
  });

  // Fetch all WordPress sites (super admin sees all, others see own tenant)
  const { data: sites = [], isLoading } = useQuery<WordPressSite[]>({
    queryKey: ["wordpress-sites-admin", tenantId, filterTenant],
    queryFn: async () => {
      let query = supabase
        .from("social_media_wordpress_sites" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (!isSuperAdmin) {
        query = query.eq("tenant_id", tenantId);
      } else if (filterTenant !== "all") {
        query = query.eq("tenant_id", filterTenant);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as WordPressSite[];
    },
    enabled: !!tenantId,
  });

  // Create site
  const createMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const tid = isSuperAdmin && values.tenant_id ? values.tenant_id : tenantId;
      const payload: any = {
        site_url: values.site_url.replace(/\/$/, ""),
        username: values.username,
        app_password: values.app_password,
        site_name: values.site_name || null,
        notes: values.notes || null,
        tenant_id: tid,
        woocommerce_enabled: values.woocommerce_enabled,
        woocommerce_consumer_key: values.woo_consumer_key || null,
        woocommerce_consumer_secret: values.woo_consumer_secret || null,
        woo_sync_enabled: values.woo_sync_enabled,
        client_id: values.client_id || null,
      };
      const { error } = await supabase
        .from("social_media_wordpress_sites" as any)
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wordpress-sites-admin"] });
      queryClient.invalidateQueries({ queryKey: ["wordpress-sites"] });
      toast.success("אתר וורדפרס נוסף בהצלחה");
      setAddOpen(false);
      setForm({ ...emptyForm });
    },
    onError: (e: Error) => toast.error("שגיאה: " + e.message),
  });

  // Update site
  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: typeof form }) => {
      const payload: any = {
        site_url: values.site_url.replace(/\/$/, ""),
        username: values.username,
        site_name: values.site_name || null,
        notes: values.notes || null,
        woocommerce_enabled: values.woocommerce_enabled,
        woo_consumer_key: values.woo_consumer_key || null,
        woo_consumer_secret: values.woo_consumer_secret || null,
        woo_sync_enabled: values.woo_sync_enabled,
        client_id: values.client_id || null,
        updated_at: new Date().toISOString(),
      };
      // Only update password if provided
      if (values.app_password) {
        payload.app_password = values.app_password;
      }
      const { error } = await supabase
        .from("social_media_wordpress_sites" as any)
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wordpress-sites-admin"] });
      queryClient.invalidateQueries({ queryKey: ["wordpress-sites"] });
      toast.success("אתר עודכן בהצלחה");
      setEditSite(null);
      setForm({ ...emptyForm });
    },
    onError: (e: Error) => toast.error("שגיאה: " + e.message),
  });

  // Delete site
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("social_media_wordpress_sites" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wordpress-sites-admin"] });
      queryClient.invalidateQueries({ queryKey: ["wordpress-sites"] });
      toast.success("אתר נמחק");
    },
    onError: (e: Error) => toast.error("שגיאה: " + e.message),
  });

  // Toggle active
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("social_media_wordpress_sites" as any)
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wordpress-sites-admin"] });
    },
  });

  // Trigger WooCommerce sync
  const syncMutation = useMutation({
    mutationFn: async (siteId: string) => {
      const { data, error } = await supabase.functions.invoke("sync-woocommerce-data", {
        body: { site_id: siteId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["wordpress-sites-admin"] });
      toast.success(
        `סנכרון הושלם: ${data?.orders_synced ?? 0} הזמנות, ${data?.products_synced ?? 0} מוצרים, ${data?.customers_synced ?? 0} לקוחות`
      );
    },
    onError: (e: Error) => toast.error("שגיאת סנכרון: " + e.message),
  });

  // Test WordPress connection
  const testConnection = async (site: WordPressSite) => {
    setTestingId(site.id);
    try {
      const { data, error } = await supabase.functions.invoke("test-wordpress-connection", {
        body: { site_id: site.id },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`חיבור תקין! אתר: ${data.site_name || site.site_url}`);
      } else {
        toast.error("חיבור נכשל: " + (data?.error || "שגיאה לא ידועה"));
      }
    } catch (e: any) {
      toast.error("שגיאת חיבור: " + e.message);
    } finally {
      setTestingId(null);
    }
  };

  const openEdit = (site: WordPressSite) => {
    setEditSite(site);
    setForm({
      site_url: site.site_url,
      username: site.username,
      app_password: "",
      site_name: site.site_name || "",
      notes: site.notes || "",
      woocommerce_enabled: site.woocommerce_enabled,
      woo_consumer_key: site.woo_consumer_key || "",
      woo_consumer_secret: site.woo_consumer_secret || "",
      woo_sync_enabled: site.woo_sync_enabled,
      tenant_id: site.tenant_id,
      client_id: site.client_id || "",
    });
  };

  const getTenantName = (tid: string) =>
    allTenants.find((t) => t.id === tid)?.name || tid;

  const activeSites = sites.filter((s) => s.is_active);
  const wooSites = sites.filter((s) => s.woocommerce_enabled);

  // Shared form fields
  const SiteForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      {isSuperAdmin && !isEdit && (
        <div>
          <Label>ארגון (Tenant)</Label>
          <Select
            value={form.tenant_id}
            onValueChange={(v) => setForm({ ...form, tenant_id: v, client_id: "" })}
          >
            <SelectTrigger>
              <SelectValue placeholder="בחר ארגון..." />
            </SelectTrigger>
            <SelectContent>
              {allTenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label>שם האתר (אופציונלי)</Label>
        <Input
          value={form.site_name}
          onChange={(e) => setForm({ ...form, site_name: e.target.value })}
          placeholder="האתר של לקוח X"
        />
      </div>

      <div>
        <Label>כתובת האתר *</Label>
        <Input
          value={form.site_url}
          onChange={(e) => setForm({ ...form, site_url: e.target.value })}
          placeholder="https://example.com"
          dir="ltr"
        />
      </div>

      <div>
        <Label>שם משתמש WordPress *</Label>
        <Input
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          placeholder="admin"
          dir="ltr"
        />
      </div>

      <div>
        <Label>Application Password {isEdit && "(השאר ריק לשמור הנוכחי)"}</Label>
        <Input
          type="password"
          value={form.app_password}
          onChange={(e) => setForm({ ...form, app_password: e.target.value })}
          placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
          dir="ltr"
        />
        <p className="text-xs text-muted-foreground mt-1">
          WordPress Admin → Users → Profile → Application Passwords
        </p>
      </div>

      {clients.length > 0 && (
        <div>
          <Label>לקוח מקושר (אופציונלי)</Label>
          <Select
            value={form.client_id || "none"}
            onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="בחר לקוח..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ללא</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label>הערות</Label>
        <Input
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="הערות פנימיות..."
        />
      </div>

      {/* WooCommerce Section */}
      <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-purple-600" />
            <Label className="font-semibold">WooCommerce</Label>
          </div>
          <Switch
            checked={form.woocommerce_enabled}
            onCheckedChange={(v) => setForm({ ...form, woocommerce_enabled: v })}
          />
        </div>

        {form.woocommerce_enabled && (
          <>
            <div>
              <Label>Consumer Key *</Label>
              <Input
                value={form.woo_consumer_key}
                onChange={(e) => setForm({ ...form, woo_consumer_key: e.target.value })}
                placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                dir="ltr"
                type="password"
              />
              <p className="text-xs text-muted-foreground mt-1">
                WooCommerce → Settings → Advanced → REST API
              </p>
            </div>
            <div>
              <Label>Consumer Secret *</Label>
              <Input
                value={form.woo_consumer_secret}
                onChange={(e) => setForm({ ...form, woo_consumer_secret: e.target.value })}
                placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                dir="ltr"
                type="password"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>סנכרון אוטומטי</Label>
                <p className="text-xs text-muted-foreground">סנכרון כל שעה אוטומטית</p>
              </div>
              <Switch
                checked={form.woo_sync_enabled}
                onCheckedChange={(v) => setForm({ ...form, woo_sync_enabled: v })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(buildPath("integrations"))}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Globe className="h-7 w-7 text-blue-600" />
            WordPress & WooCommerce
          </h1>
          <p className="text-muted-foreground mt-1">
            ניהול אתרי WordPress ו-WooCommerce עבור כל הלקוחות
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">אתרים פעילים</p>
                <p className="text-3xl font-bold">{activeSites.length}</p>
              </div>
              <Globe className="h-8 w-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">WooCommerce מחובר</p>
                <p className="text-3xl font-bold">{wooSites.length}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-purple-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">סה"כ אתרים</p>
                <p className="text-3xl font-bold">{sites.length}</p>
              </div>
              <Settings className="h-8 w-8 text-gray-400 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="sites">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="sites">אתרים ({sites.length})</TabsTrigger>
            <TabsTrigger value="woocommerce">WooCommerce ({wooSites.length})</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <Select value={filterTenant} onValueChange={setFilterTenant}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="כל הארגונים" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הארגונים</SelectItem>
                  {allTenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setForm({ ...emptyForm })}>
                  <Plus className="h-4 w-4 ml-2" />
                  הוסף אתר
                </Button>
              </DialogTrigger>
              <DialogContent dir="rtl" className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>הוסף אתר WordPress</DialogTitle>
                </DialogHeader>
                <SiteForm />
                <Button
                  className="w-full mt-2"
                  onClick={() => createMutation.mutate(form)}
                  disabled={
                    !form.site_url || !form.username || !form.app_password ||
                    (isSuperAdmin && !form.tenant_id) ||
                    createMutation.isPending
                  }
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                  הוסף אתר
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Sites Tab */}
        <TabsContent value="sites" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : sites.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>אין אתרים מוגדרים עדיין</p>
                  <p className="text-sm">לחץ "הוסף אתר" להתחיל</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isSuperAdmin && <TableHead>ארגון</TableHead>}
                      <TableHead>אתר</TableHead>
                      <TableHead>WooCommerce</TableHead>
                      <TableHead>סנכרון אחרון</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sites.map((site) => (
                      <TableRow key={site.id}>
                        {isSuperAdmin && (
                          <TableCell className="text-sm text-muted-foreground">
                            {getTenantName(site.tenant_id)}
                          </TableCell>
                        )}
                        <TableCell>
                          <div>
                            <p className="font-medium">{site.site_name || site.site_url}</p>
                            <a
                              href={site.site_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 flex items-center gap-1 hover:underline"
                              dir="ltr"
                            >
                              {site.site_url}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            {site.notes && (
                              <p className="text-xs text-muted-foreground mt-0.5">{site.notes}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {site.woocommerce_enabled ? (
                            <Badge variant="default" className="bg-purple-600">
                              <ShoppingCart className="h-3 w-3 ml-1" />
                              מחובר
                            </Badge>
                          ) : (
                            <Badge variant="secondary">לא מוגדר</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {site.woo_last_sync_at
                            ? new Date(site.woo_last_sync_at).toLocaleString("he-IL")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={site.is_active}
                              onCheckedChange={(v) =>
                                toggleActiveMutation.mutate({ id: site.id, is_active: v })
                              }
                            />
                            <span className="text-xs">
                              {site.is_active ? "פעיל" : "כבוי"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="בדוק חיבור"
                              onClick={() => testConnection(site)}
                              disabled={testingId === site.id}
                            >
                              {testingId === site.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              )}
                            </Button>

                            {site.woocommerce_enabled && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="סנכרן WooCommerce"
                                onClick={() => syncMutation.mutate(site.id)}
                                disabled={syncMutation.isPending}
                              >
                                {syncMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4 text-purple-600" />
                                )}
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="icon"
                              title="ערוך"
                              onClick={() => openEdit(site)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>מחק אתר</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    האם אתה בטוח? פעולה זו תמחק גם את כל נתוני ה-WooCommerce המסונכרנים.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>ביטול</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(site.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    מחק
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* WooCommerce Tab */}
        <TabsContent value="woocommerce" className="mt-4">
          <div className="space-y-4">
            {wooSites.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>אין אתרי WooCommerce מחוברים</p>
                  <p className="text-sm">הפעל WooCommerce בעת הוספת אתר</p>
                </CardContent>
              </Card>
            ) : (
              wooSites.map((site) => (
                <WooCommerceSiteCard
                  key={site.id}
                  site={site}
                  tenantName={isSuperAdmin ? getTenantName(site.tenant_id) : undefined}
                  onSync={() => syncMutation.mutate(site.id)}
                  isSyncing={syncMutation.isPending}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editSite} onOpenChange={(o) => { if (!o) setEditSite(null); }}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>ערוך אתר: {editSite?.site_name || editSite?.site_url}</DialogTitle>
          </DialogHeader>
          <SiteForm isEdit />
          <Button
            className="w-full mt-2"
            onClick={() => editSite && updateMutation.mutate({ id: editSite.id, values: form })}
            disabled={!form.site_url || !form.username || updateMutation.isPending}
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            שמור שינויים
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- WooCommerce Site Card ----
function WooCommerceSiteCard({
  site,
  tenantName,
  onSync,
  isSyncing,
}: {
  site: WordPressSite;
  tenantName?: string;
  onSync: () => void;
  isSyncing: boolean;
}) {
  const { data: stats } = useQuery({
    queryKey: ["woo-stats", site.id],
    queryFn: async () => {
      const [ordersRes, productsRes, customersRes] = await Promise.all([
        supabase.from("woocommerce_orders" as any).select("id", { count: "exact", head: true }).eq("site_id", site.id),
        supabase.from("woocommerce_products" as any).select("id", { count: "exact", head: true }).eq("site_id", site.id),
        supabase.from("woocommerce_customers" as any).select("id", { count: "exact", head: true }).eq("site_id", site.id),
      ]);
      return {
        orders: ordersRes.count ?? 0,
        products: productsRes.count ?? 0,
        customers: customersRes.count ?? 0,
      };
    },
  });

  const { data: revenueData } = useQuery({
    queryKey: ["woo-revenue", site.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("woocommerce_orders" as any)
        .select("total, status")
        .eq("site_id", site.id)
        .in("status", ["completed", "processing"]);
      const total = (data || []).reduce((sum: number, o: any) => sum + (parseFloat(o.total) || 0), 0);
      return total;
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-purple-600" />
              {site.site_name || site.site_url}
            </CardTitle>
            {tenantName && (
              <CardDescription>ארגון: {tenantName}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            {site.woo_sync_enabled && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                סנכרון אוטומטי
              </Badge>
            )}
            <Button size="sm" variant="outline" onClick={onSync} disabled={isSyncing}>
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin ml-1" />
              ) : (
                <RefreshCw className="h-4 w-4 ml-1" />
              )}
              סנכרן עכשיו
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{stats?.orders ?? "—"}</p>
            <p className="text-xs text-muted-foreground">הזמנות</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{stats?.products ?? "—"}</p>
            <p className="text-xs text-muted-foreground">מוצרים</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{stats?.customers ?? "—"}</p>
            <p className="text-xs text-muted-foreground">לקוחות</p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <p className="text-2xl font-bold text-purple-700">
              {revenueData != null ? `₪${revenueData.toLocaleString("he-IL")}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">הכנסות</p>
          </div>
        </div>
        {site.woo_last_sync_at && (
          <p className="text-xs text-muted-foreground mt-3">
            סנכרון אחרון: {new Date(site.woo_last_sync_at).toLocaleString("he-IL")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

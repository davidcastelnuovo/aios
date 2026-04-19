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
  Edit, Key, Link2, UserPlus, MapPin,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface WordPressSite {
  id: string;
  tenant_id: string;
  site_url: string;
  username: string;
  app_password: string;
  site_name: string | null;
  is_active: boolean;
  woocommerce_enabled: boolean;
  woocommerce_consumer_key: string | null;
  woocommerce_consumer_secret: string | null;
  woo_last_sync_at: string | null;
  woo_sync_enabled: boolean;
  client_id: string | null;
  agency_id: string | null;
  notes: string | null;
  created_at: string;
  campaign_url_mapping?: Record<string, string> | null;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface Client {
  id: string;
  name: string;
  tenant_id?: string;
  tenant_name?: string;
}

interface AgencyOpt {
  id: string;
  name: string;
  tenant_id: string;
  tenant_name?: string;
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
  agency_id: "",
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
  const [linkSite, setLinkSite] = useState<WordPressSite | null>(null);
  const [linkTenantId, setLinkTenantId] = useState<string>("");
  const [linkAgency, setLinkAgency] = useState<string>("");
  const [linkClient, setLinkClient] = useState<string>("");
  const [form, setForm] = useState({ ...emptyForm });
  const [filterTenant, setFilterTenant] = useState<string>("all");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [mappingSite, setMappingSite] = useState<WordPressSite | null>(null);
  const [mappingDraft, setMappingDraft] = useState<Record<string, string>>({});

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

  // Fetch agencies for the form
  // - super-admin: all agencies across tenants (or filtered by chosen tenant_id)
  // - regular user: agencies in their tenant + cross-tenant via agency_tenant_access
  const { data: agencies = [] } = useQuery<AgencyOpt[]>({
    queryKey: ["agencies-for-wp", form.tenant_id, tenantId, isSuperAdmin],
    queryFn: async () => {
      if (isSuperAdmin) {
        let q = supabase
          .from("agencies")
          .select("id, name, tenant_id, tenants(name)")
          .order("name");
        if (form.tenant_id) q = q.eq("tenant_id", form.tenant_id);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          tenant_id: a.tenant_id,
          tenant_name: a.tenants?.name,
        }));
      }

      if (!tenantId) return [];

      // Own tenant agencies
      const ownPromise = supabase
        .from("agencies")
        .select("id, name, tenant_id, tenants(name)")
        .eq("tenant_id", tenantId)
        .order("name");

      // Cross-tenant via agency_tenant_access
      const accessPromise = supabase
        .from("agency_tenant_access")
        .select("agency_id, agencies(id, name, tenant_id, tenants(name))")
        .eq("accessing_tenant_id", tenantId);

      const [ownRes, accessRes] = await Promise.all([ownPromise, accessPromise]);
      if (ownRes.error) throw ownRes.error;
      if (accessRes.error) throw accessRes.error;

      const merged = new Map<string, AgencyOpt>();
      (ownRes.data || []).forEach((a: any) =>
        merged.set(a.id, { id: a.id, name: a.name, tenant_id: a.tenant_id, tenant_name: a.tenants?.name })
      );
      (accessRes.data || []).forEach((row: any) => {
        const a = row.agencies;
        if (a) merged.set(a.id, { id: a.id, name: a.name, tenant_id: a.tenant_id, tenant_name: a.tenants?.name });
      });
      return Array.from(merged.values()).sort((x, y) => x.name.localeCompare(y.name));
    },
    enabled: !!tenantId || isSuperAdmin,
  });

  // Resolve effective tenant for clients query (follows the selected agency's tenant)
  const selectedAgencyTenantId = form.agency_id
    ? agencies.find((a) => a.id === form.agency_id)?.tenant_id
    : undefined;

  // Fetch clients - scoped to selected agency's tenant (if agency picked)
  // Otherwise to chosen tenant_id (super-admin) or current tenant
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients-for-wp", selectedAgencyTenantId, form.tenant_id, tenantId, form.agency_id, isSuperAdmin],
    queryFn: async () => {
      const effTenant = selectedAgencyTenantId || form.tenant_id || tenantId;
      if (!effTenant && !form.agency_id && !isSuperAdmin) return [];

      let q = supabase
        .from("clients")
        .select("id, name, tenant_id, tenants(name)")
        .order("name");

      if (form.agency_id) {
        q = q.eq("agency_id", form.agency_id);
      } else if (effTenant) {
        q = q.eq("tenant_id", effTenant);
      } else {
        return [];
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        tenant_id: c.tenant_id,
        tenant_name: c.tenants?.name,
      }));
    },
    enabled: !!(form.agency_id || form.tenant_id || tenantId || isSuperAdmin),
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
        agency_id: values.agency_id || null,
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
        woocommerce_consumer_key: values.woo_consumer_key || null,
        woocommerce_consumer_secret: values.woo_consumer_secret || null,
        woo_sync_enabled: values.woo_sync_enabled,
        client_id: values.client_id || null,
        agency_id: values.agency_id || null,
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

  // Quick-link association mutation - also syncs site's tenant_id to selected agency's tenant
  const linkMutation = useMutation({
    mutationFn: async ({
      id,
      agency_id,
      client_id,
      tenant_id: newTenantId,
    }: {
      id: string;
      agency_id: string | null;
      client_id: string | null;
      tenant_id?: string | null;
    }) => {
      const payload: any = { agency_id, client_id, updated_at: new Date().toISOString() };
      if (newTenantId) payload.tenant_id = newTenantId;
      const { error } = await supabase
        .from("social_media_wordpress_sites" as any)
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wordpress-sites-admin"] });
      queryClient.invalidateQueries({ queryKey: ["wordpress-sites"] });
      toast.success("השיוך עודכן בהצלחה");
      setLinkSite(null);
    },
    onError: (e: Error) => toast.error("שגיאה: " + e.message),
  });

  // Agencies for the quick-link dialog
  // - super-admin: all agencies across all tenants
  // - regular user: own tenant + cross-tenant via agency_tenant_access
  const { data: linkAgencies = [] } = useQuery<AgencyOpt[]>({
    queryKey: ["agencies-for-link", tenantId, isSuperAdmin],
    queryFn: async () => {
      if (isSuperAdmin) {
        const { data, error } = await supabase
          .from("agencies")
          .select("id, name, tenant_id, tenants(name)")
          .order("name");
        if (error) throw error;
        return (data || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          tenant_id: a.tenant_id,
          tenant_name: a.tenants?.name,
        }));
      }

      if (!tenantId) return [];

      const ownPromise = supabase
        .from("agencies")
        .select("id, name, tenant_id, tenants(name)")
        .eq("tenant_id", tenantId)
        .order("name");

      const accessPromise = supabase
        .from("agency_tenant_access")
        .select("agency_id, agencies(id, name, tenant_id, tenants(name))")
        .eq("accessing_tenant_id", tenantId);

      const [ownRes, accessRes] = await Promise.all([ownPromise, accessPromise]);
      if (ownRes.error) throw ownRes.error;
      if (accessRes.error) throw accessRes.error;

      const merged = new Map<string, AgencyOpt>();
      (ownRes.data || []).forEach((a: any) =>
        merged.set(a.id, { id: a.id, name: a.name, tenant_id: a.tenant_id, tenant_name: a.tenants?.name })
      );
      (accessRes.data || []).forEach((row: any) => {
        const a = row.agencies;
        if (a) merged.set(a.id, { id: a.id, name: a.name, tenant_id: a.tenant_id, tenant_name: a.tenants?.name });
      });
      return Array.from(merged.values()).sort((x, y) => x.name.localeCompare(y.name));
    },
    enabled: !!tenantId || isSuperAdmin,
  });

  // Distinct tenants reachable in the link dialog (derived from linkAgencies)
  const linkTenants = Array.from(
    new Map(
      linkAgencies
        .filter((a) => a.tenant_id)
        .map((a) => [a.tenant_id, { id: a.tenant_id, name: a.tenant_name || a.tenant_id }])
    ).values()
  ).sort((x, y) => x.name.localeCompare(y.name));

  // Filter agencies by chosen tenant in the link dialog
  const linkFilteredAgencies = linkTenantId
    ? linkAgencies.filter((a) => a.tenant_id === linkTenantId)
    : linkAgencies;

  // Clients for the quick-link dialog — scoped to the SELECTED agency's tenant
  const linkSelectedAgency = linkAgencies.find((a) => a.id === linkAgency);
  const linkEffectiveTenantId = linkSelectedAgency?.tenant_id || linkTenantId || linkSite?.tenant_id;

  const { data: linkClients = [] } = useQuery<Client[]>({
    queryKey: ["clients-for-link", linkEffectiveTenantId, linkAgency],
    queryFn: async () => {
      if (!linkEffectiveTenantId && !linkAgency) return [];
      let q = supabase
        .from("clients")
        .select("id, name, tenant_id, tenants(name)")
        .order("name");
      if (linkAgency) {
        q = q.eq("agency_id", linkAgency);
      } else if (linkEffectiveTenantId) {
        q = q.eq("tenant_id", linkEffectiveTenantId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        tenant_id: c.tenant_id,
        tenant_name: c.tenants?.name,
      }));
    },
    enabled: !!(linkEffectiveTenantId || linkAgency),
  });

  const openLink = (site: WordPressSite) => {
    setLinkSite(site);
    setLinkTenantId(site.tenant_id || "");
    setLinkAgency(site.agency_id || "");
    setLinkClient(site.client_id || "");
  };

  const openMapping = (site: WordPressSite) => {
    setMappingSite(site);
    setMappingDraft({ ...(site.campaign_url_mapping || {}) });
  };

  // Discover slugs for the mapping site (last 90 days of submissions)
  const { data: slugDiscovery, isLoading: isLoadingSlugs } = useQuery<{
    per_slug: Array<{ slug: string; submissions: number; google_ads_submissions: number; sample_gad_campaignids: string[] }>;
  }>({
    queryKey: ["wp-discovered-slugs", mappingSite?.id],
    queryFn: async () => {
      if (!mappingSite) return { per_slug: [] };
      const { data, error } = await supabase.functions.invoke("fetch-elementor-submissions", {
        body: { site_id: mappingSite.id, days: 90 },
      });
      if (error) throw error;
      return { per_slug: (data?.per_slug || []) as any[] };
    },
    enabled: !!mappingSite,
    staleTime: 1000 * 60 * 5,
  });
  const discoveredSlugs = slugDiscovery?.per_slug || [];

  // Campaigns for mapping site's client (Google Ads campaigns from synced records)
  const { data: clientCampaigns = [] } = useQuery<Array<{ campaign_id: string; campaign_name: string }>>({
    queryKey: ["wp-client-campaigns", mappingSite?.client_id],
    queryFn: async () => {
      if (!mappingSite?.client_id) return [];
      const { data: tables, error: tErr } = await supabase
        .from("crm_tables")
        .select("id")
        .eq("client_id", mappingSite.client_id)
        .eq("integration_type", "google_ads");
      if (tErr) throw tErr;
      if (!tables || tables.length === 0) return [];
      const tableIds = tables.map((t: any) => t.id);
      const { data: records, error: rErr } = await supabase
        .from("crm_records")
        .select("data")
        .in("table_id", tableIds)
        .limit(1000);
      if (rErr) throw rErr;
      const map = new Map<string, string>();
      for (const r of records || []) {
        const cid = (r as any).data?.campaign_id;
        const cname = (r as any).data?.campaign_name;
        if (cid && cname && !map.has(cid)) map.set(cid, cname);
      }
      return Array.from(map.entries())
        .map(([campaign_id, campaign_name]) => ({ campaign_id, campaign_name }))
        .sort((a, b) => a.campaign_name.localeCompare(b.campaign_name));
    },
    enabled: !!mappingSite?.client_id,
  });

  const mappingMutation = useMutation({
    mutationFn: async ({ id, mapping }: { id: string; mapping: Record<string, string> }) => {
      const clean = Object.fromEntries(
        Object.entries(mapping).filter(([_, v]) => v && v.length > 0)
      );
      const { error } = await supabase
        .from("social_media_wordpress_sites" as any)
        .update({ campaign_url_mapping: clean, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wordpress-sites-admin"] });
      toast.success("המיפוי נשמר. סנכרן את דוח גוגל אדס כדי לראות את ההשפעה");
      setMappingSite(null);
    },
    onError: (e: Error) => toast.error("שגיאה: " + e.message),
  });

  // Map of clientId -> name for table display (across tenants for super-admin we fetch lazily per site tenant)
  const { data: clientsMap = {} } = useQuery<Record<string, string>>({
    queryKey: ["clients-map-for-wp", sites.map((s) => s.client_id).filter(Boolean).join(",")],
    queryFn: async () => {
      const ids = Array.from(new Set(sites.map((s) => s.client_id).filter(Boolean) as string[]));
      if (ids.length === 0) return {};
      const { data, error } = await supabase.from("clients").select("id, name").in("id", ids);
      if (error) throw error;
      return Object.fromEntries((data || []).map((c: any) => [c.id, c.name]));
    },
    enabled: sites.length > 0,
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
      woo_consumer_key: site.woocommerce_consumer_key || "",
      woo_consumer_secret: site.woocommerce_consumer_secret || "",
      woo_sync_enabled: site.woo_sync_enabled,
      tenant_id: site.tenant_id,
      agency_id: site.agency_id || "",
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

      <div className="border rounded-lg p-3 space-y-3 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">
            שיוך ללקוח חיוני כדי לקשר את לידי האתר (Elementor / Contact Form 7) אל דוח הלקוח.
          </p>
        </div>

        <div>
          <Label>סוכנות מקושרת</Label>
          <Select
            value={form.agency_id || "none"}
            onValueChange={(v) => setForm({ ...form, agency_id: v === "none" ? "" : v, client_id: "" })}
            disabled={isSuperAdmin && !isEdit && !form.tenant_id}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                isSuperAdmin && !isEdit && !form.tenant_id
                  ? "בחר תחילה ארגון..."
                  : agencies.length === 0
                    ? "אין סוכנויות בארגון זה"
                    : "בחר סוכנות..."
              } />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ללא</SelectItem>
              {agencies.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}{a.tenant_name ? ` (${a.tenant_name})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>לקוח מקושר</Label>
          <Select
            value={form.client_id || "none"}
            onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v })}
            disabled={isSuperAdmin && !isEdit && !form.tenant_id}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                isSuperAdmin && !isEdit && !form.tenant_id
                  ? "בחר תחילה ארגון..."
                  : clients.length === 0
                    ? (form.agency_id ? "אין לקוחות לסוכנות זו" : "אין לקוחות בארגון")
                    : "בחר לקוח..."
              } />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ללא</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}{c.tenant_name && c.tenant_id !== (form.tenant_id || tenantId) ? ` (${c.tenant_name})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>


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
                      <TableHead>לקוח מקושר</TableHead>
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
                          {site.client_id ? (
                            <Badge variant="outline" className="border-emerald-500/50 text-emerald-700 dark:text-emerald-400">
                              <Link2 className="h-3 w-3 ml-1" />
                              {clientsMap[site.client_id] || "לקוח"}
                            </Badge>
                          ) : (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="border-amber-500/60 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 cursor-help">
                                    <AlertCircle className="h-3 w-3 ml-1" />
                                    לא משויך ללקוח
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>לידים מהאתר לא יקושרו לדוח לקוח</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
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
                              title={site.client_id ? "ערוך שיוך לקוח" : "שייך ללקוח"}
                              onClick={() => openLink(site)}
                              className={site.client_id ? "" : "text-amber-600 hover:text-amber-700"}
                            >
                              {site.client_id ? <Link2 className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                            </Button>

                            {site.client_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="שייך עמודי נחיתה לקמפיינים"
                                onClick={() => openMapping(site)}
                                className={site.campaign_url_mapping && Object.keys(site.campaign_url_mapping).length > 0 ? "text-emerald-600" : "text-blue-600"}
                              >
                                <MapPin className="h-4 w-4" />
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

      {/* Quick Link (Associate to Client) Dialog */}
      <Dialog open={!!linkSite} onOpenChange={(o) => { if (!o) setLinkSite(null); }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              שיוך אתר ללקוח
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium">{linkSite?.site_name || linkSite?.site_url}</p>
              <p className="text-xs text-muted-foreground" dir="ltr">{linkSite?.site_url}</p>
            </div>

            <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-900 dark:text-amber-200">
                שיוך זה מחבר את לידי האתר (Elementor / Contact Form 7) אל הלקוח, כך שיופיעו בדוח שלו.
              </p>
            </div>

            <div>
              <Label>ארגון</Label>
              <Select
                value={linkTenantId || "none"}
                onValueChange={(v) => {
                  const newTid = v === "none" ? "" : v;
                  setLinkTenantId(newTid);
                  setLinkAgency("");
                  setLinkClient("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={linkTenants.length === 0 ? "אין ארגונים זמינים" : "בחר ארגון..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">כל הארגונים</SelectItem>
                  {linkTenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>סוכנות</Label>
              <Select
                value={linkAgency || "none"}
                onValueChange={(v) => { setLinkAgency(v === "none" ? "" : v); setLinkClient(""); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={linkFilteredAgencies.length === 0 ? "אין סוכנויות בארגון זה" : "בחר סוכנות..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא</SelectItem>
                  {linkFilteredAgencies.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}{!linkTenantId && a.tenant_name ? ` (${a.tenant_name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>לקוח</Label>
              <Select
                value={linkClient || "none"}
                onValueChange={(v) => setLinkClient(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    linkClients.length === 0
                      ? (linkAgency ? "אין לקוחות לסוכנות זו" : "אין לקוחות בארגון")
                      : "בחר לקוח..."
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא</SelectItem>
                  {linkClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.tenant_name && c.tenant_id !== linkSite?.tenant_id ? ` (${c.tenant_name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cross-tenant warning when selected agency belongs to another org */}
            {linkSelectedAgency && linkSite && linkSelectedAgency.tenant_id !== linkSite.tenant_id && (
              <div className="rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-900 dark:text-blue-200">
                  סוכנות זו שייכת לארגון <strong>{linkSelectedAgency.tenant_name}</strong>.
                  בשמירה, האתר יועבר לארגון זה כדי שהשיוך יפעל כראוי.
                </p>
              </div>
            )}

            {linkSite?.client_id && linkClient && linkClient !== linkSite.client_id && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-destructive">
                  שינוי שיוך הלקוח לא יעביר לידים היסטוריים שכבר נמשכו תחת הלקוח הקודם.
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setLinkSite(null)}
                disabled={linkMutation.isPending}
              >
                ביטול
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  if (!linkSite) return;
                  const targetTenant =
                    linkSelectedAgency?.tenant_id ||
                    linkTenantId ||
                    null;
                  linkMutation.mutate({
                    id: linkSite.id,
                    agency_id: linkAgency || null,
                    client_id: linkClient || null,
                    tenant_id: targetTenant && targetTenant !== linkSite.tenant_id ? targetTenant : null,
                  });
                }}
                disabled={linkMutation.isPending}
              >
                {linkMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                שמור שיוך
              </Button>
            </div>
          </div>
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

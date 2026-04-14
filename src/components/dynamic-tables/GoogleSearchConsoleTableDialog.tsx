import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { Loader2, Search, ExternalLink } from "lucide-react";

interface GoogleSearchConsoleTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignedClientIds?: string[];
}

interface GSCSite {
  siteUrl: string;
  permissionLevel: string;
}

export function GoogleSearchConsoleTableDialog({ open, onOpenChange, assignedClientIds }: GoogleSearchConsoleTableDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentTenant, currentTenantId: activeTenantId } = useTenant();

  const [tableName, setTableName] = useState("");
  const [category, setCategory] = useState("seo");
  const [selectedSite, setSelectedSite] = useState("");
  const [selectedAgency, setSelectedAgency] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { data: integration, isLoading: integrationLoading } = useQuery({
    queryKey: ["gsc-integration", activeTenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .eq("integration_type", "google_search_console")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: open && !!activeTenantId,
    refetchOnMount: "always",
  });

  const { data: sites = [], isLoading: sitesLoading } = useQuery({
    queryKey: ["gsc-sites", integration?.id],
    queryFn: async () => {
      if (!integration?.id) return [] as GSCSite[];

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("google-search-console-auth?action=get_sites", {
        body: {
          integrationId: integration.id,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      return Array.isArray(data?.sites) ? (data.sites as GSCSite[]) : [];
    },
    enabled: !!integration?.id,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!selectedSite && sites.length === 1) {
      setSelectedSite(sites[0].siteUrl);
    }
  }, [sites, selectedSite]);

  const { data: agencies } = useQuery({
    queryKey: ["agencies-for-table", activeTenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("tenant_id", activeTenantId)
        .order("name");
      return data || [];
    },
    enabled: open && !!activeTenantId,
  });

  const { data: rawClients } = useQuery({
    queryKey: ["clients-for-table", selectedAgency],
    queryFn: async () => {
      if (!selectedAgency) return [];
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("agency_id", selectedAgency)
        .order("name");
      return data || [];
    },
    enabled: !!selectedAgency,
  });

  const clients = assignedClientIds
    ? (rawClients || []).filter((client) => assignedClientIds.includes(client.id))
    : rawClients;

  const handleCreate = async () => {
    if (!tableName.trim() || !selectedSite || !integration) {
      toast({ title: "נא למלא את כל השדות הנדרשים", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const slug = tableName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

      const { error } = await supabase.functions.invoke("crm-tables", {
        body: {
          action: "create",
          tenantId: activeTenantId,
          name: tableName,
          slug: `gsc-${slug}-${Date.now()}`,
          description: `Search Console - ${selectedSite}`,
          category,
          icon: "Search",
          agencyId: selectedAgency || null,
          clientId: selectedClient || null,
          integration_type: "google_search_console",
          integration_settings: {
            integrationId: integration.id,
            siteUrl: selectedSite,
          },
          integrations: [
            {
              type: "google_search_console",
              integrationId: integration.id,
              siteUrl: selectedSite,
            },
          ],
        },
      });

      if (error) throw error;

      toast({ title: "טבלת Search Console נוצרה בהצלחה!" });
      queryClient.invalidateQueries({ queryKey: ["crm-tables"] });
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "שגיאה ביצירת הטבלה", description: error.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setTableName("");
    setCategory("seo");
    setSelectedSite("");
    setSelectedAgency("");
    setSelectedClient("");
  };

  const isLoading = integrationLoading || sitesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            טבלת Search Console חדשה
          </DialogTitle>
          <DialogDescription>
            חבר אתר מ-Search Console וצפה בנתוני חיפוש
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !integration ? (
          <div className="text-center py-6 space-y-4">
            <p className="text-muted-foreground">לא נמצא חיבור Search Console פעיל</p>
            <Button variant="outline" asChild>
              <a href={`/t/${currentTenant?.slug}/google-search-console-settings`}>
                <ExternalLink className="h-4 w-4 ml-2" />
                חבר Search Console
              </a>
            </Button>
          </div>
        ) : sites.length === 0 ? (
          <div className="text-center py-6 space-y-4">
            <p className="text-muted-foreground">החיבור קיים אבל לא נטענו נכסים מ-Search Console</p>
            <Button variant="outline" asChild>
              <a href={`/t/${currentTenant?.slug}/google-search-console-settings`}>
                <ExternalLink className="h-4 w-4 ml-2" />
                חבר מחדש Search Console
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>שם הטבלה *</Label>
              <Input
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="לדוגמה: נתוני SEO - אתר ראשי"
              />
            </div>

            <div className="space-y-2">
              <Label>נכס Search Console *</Label>
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר נכס" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.siteUrl} value={site.siteUrl}>
                      {site.siteUrl.replace("sc-domain:", "").replace("https://", "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>קטגוריה</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seo">SEO</SelectItem>
                  <SelectItem value="analytics">אנליטיקס</SelectItem>
                  <SelectItem value="reports">דוחות</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>סוכנות (אופציונלי)</Label>
              <Select
                value={selectedAgency || "all"}
                onValueChange={(value) => {
                  setSelectedAgency(value === "all" ? "" : value);
                  setSelectedClient("");
                }}
              >
                <SelectTrigger>
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
            </div>

            {selectedAgency && (
              <div className="space-y-2">
                <Label>לקוח (אופציונלי)</Label>
                <Select value={selectedClient || "all"} onValueChange={(value) => setSelectedClient(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="כל הלקוחות" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הלקוחות</SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={handleCreate} disabled={isCreating} className="flex-1">
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                צור טבלה
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                ביטול
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

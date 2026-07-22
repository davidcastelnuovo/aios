import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserIntegrations } from "@/hooks/useUserIntegrations";
import { useAgencyClients, useTableDialogAgencies } from "@/hooks/useAgencyClients";
import { getIntegrationIcon } from "@/lib/integrationIcons";
import { toast } from "sonner";
import { Loader2, AlertCircle, Search } from "lucide-react";

interface EditTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: any;
  tenantId: string;
  onSaved?: () => void;
}

// Integration types whose connection is a tenant_integrations row referenced
// by integrationId in the table settings (per-user OAuth connections).
const INTEGRATION_ID_TYPES = ["google_analytics", "google_search_console", "ahrefs"];
const ADS_TYPES = ["google_ads", "facebook_insights", "facebook_ecommerce"];

const TYPE_LABELS: Record<string, string> = {
  google_analytics: "Google Analytics",
  google_search_console: "Google Search Console",
  google_ads: "Google Ads",
  facebook_insights: "Facebook",
  facebook_ecommerce: "Facebook (איקומרס)",
  ahrefs: "Ahrefs (SEO)",
  woocommerce: "WooCommerce",
};

interface GAProperty {
  id: string;
  name: string;
  accountName: string;
}

export function EditTableDialog({ open, onOpenChange, table, tenantId, onSaved }: EditTableDialogProps) {
  const queryClient = useQueryClient();
  const settings = (table?.integration_settings || {}) as Record<string, any>;
  const type: string = table?.integration_type || "";
  const usesIntegrationId = INTEGRATION_ID_TYPES.includes(type);
  const isAds = ADS_TYPES.includes(type);

  // Editable state, initialized from the table when the dialog opens
  const [name, setName] = useState("");
  const [integrationId, setIntegrationId] = useState("");
  const [accountId, setAccountId] = useState(""); // customer_id / ad_account_id / siteUrl / targetDomain
  const [propertyId, setPropertyId] = useState("");
  const [campaignType, setCampaignType] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [clientId, setClientId] = useState("");
  const [propertySearch, setPropertySearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !table) return;
    setName(table.name || "");
    setIntegrationId(settings.integrationId || settings.integration_id || "");
    if (type === "google_ads") setAccountId(settings.customer_id || "");
    else if (type === "facebook_insights" || type === "facebook_ecommerce") setAccountId(settings.ad_account_id || "");
    else if (type === "google_search_console") setAccountId(settings.siteUrl || settings.site_url || "");
    else if (type === "ahrefs") setAccountId(settings.targetDomain || settings.target_domain || "");
    else setAccountId("");
    setPropertyId(settings.propertyId || settings.property_id || "");
    setCampaignType(settings.campaign_type || "");
    setAgencyId(table.agency_id || "");
    setClientId(table.client_id || "");
    setPropertySearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, table?.id]);

  // Own + shared connections for integrationId-based types
  const { data: connections = [], isLoading: connectionsLoading } = useUserIntegrations(
    tenantId,
    type,
    { enabled: open && usesIntegrationId }
  );

  const selectedConnection = connections.find((c: any) => c.id === integrationId) || null;

  // GA property list for the selected connection
  const { data: propertiesResponse, isLoading: propertiesLoading } = useQuery({
    queryKey: ["edit-table-ga-properties", integrationId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-analytics-auth?action=get_properties", {
        body: { integrationId },
      });
      if (error) throw error;
      return data as { properties?: GAProperty[]; needs_reconnect?: boolean; owner_email?: string | null };
    },
    enabled: open && type === "google_analytics" && !!integrationId,
  });

  const gaProperties = (propertiesResponse?.properties || []) as GAProperty[];
  const gaNeedsReconnect = !!propertiesResponse?.needs_reconnect;
  const filteredProperties = useMemo(() => {
    if (!propertySearch.trim()) return gaProperties;
    const q = propertySearch.toLowerCase();
    return gaProperties.filter(
      (p) => p.name?.toLowerCase().includes(q) || p.accountName?.toLowerCase().includes(q)
    );
  }, [gaProperties, propertySearch]);

  const { data: agencies = [] } = useTableDialogAgencies({ enabled: open });
  const { data: clients = [] } = useAgencyClients(agencyId || null);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("נא למלא שם טבלה");
      return;
    }
    setIsSaving(true);
    try {
      const integrationSettings: Record<string, unknown> = {};
      if (usesIntegrationId && integrationId) integrationSettings.integrationId = integrationId;
      if (type === "google_analytics" && propertyId) {
        integrationSettings.propertyId = propertyId;
        const prop = gaProperties.find((p) => p.id === propertyId);
        if (prop) {
          integrationSettings.propertyName = prop.name;
          integrationSettings.accountName = prop.accountName;
        }
      }
      if (type === "google_ads" && accountId.trim()) {
        integrationSettings.customer_id = accountId.trim().replace(/-/g, "");
      }
      if ((type === "facebook_insights" || type === "facebook_ecommerce") && accountId.trim()) {
        const v = accountId.trim();
        integrationSettings.ad_account_id = v.startsWith("act_") ? v : `act_${v}`;
      }
      if (type === "google_search_console" && accountId.trim()) integrationSettings.siteUrl = accountId.trim();
      if (type === "ahrefs" && accountId.trim()) integrationSettings.targetDomain = accountId.trim();
      if (isAds && campaignType) integrationSettings.campaign_type = campaignType;

      const { error } = await supabase.functions.invoke("crm-tables", {
        method: "PATCH",
        body: {
          table_id: table.id,
          name: name.trim(),
          agency_id: agencyId || null,
          client_id: clientId || null,
          ...(Object.keys(integrationSettings).length > 0 ? { integration_settings: integrationSettings } : {}),
        },
      });
      if (error) throw error;

      toast.success("הטבלה עודכנה בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["crm-tables"] });
      queryClient.invalidateQueries({ queryKey: ["crm-tables", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["all-crm-tables", tenantId] });
      onSaved?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error("שגיאה בעדכון הטבלה", { description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  if (!table) return null;

  const accountFieldLabel =
    type === "google_ads" ? "מזהה חשבון מודעות (Customer ID)"
    : type === "facebook_insights" || type === "facebook_ecommerce" ? "מזהה חשבון מודעות (Ad Account)"
    : type === "google_search_console" ? "כתובת אתר (Site URL)"
    : type === "ahrefs" ? "דומיין"
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIntegrationIcon(type)}
            עריכת טבלה — {TYPE_LABELS[type] || type || "כללי"}
          </DialogTitle>
          <DialogDescription>
            חיבור, שיוך ללקוח וסוכנות והגדרות הטבלה
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>שם הטבלה *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {usesIntegrationId && (
            <div className="space-y-2">
              <Label>חשבון מחובר</Label>
              {connectionsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : connections.length === 0 ? (
                <p className="text-xs text-muted-foreground">לא נמצאו חיבורים פעילים לסוג זה</p>
              ) : (
                <Select value={integrationId} onValueChange={setIntegrationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר חיבור" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map((integ: any) => {
                      const s = integ.settings as Record<string, unknown> | null;
                      const email = (s?.google_email as string) || "חשבון לא ידוע";
                      const isOwn = integ._isOwn;
                      const sharedBy = integ._sharedByName;
                      return (
                        <SelectItem key={integ.id} value={integ.id}>
                          {email} {!isOwn && sharedBy ? `(שותף ע"י ${sharedBy})` : isOwn ? "(שלך)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
              {integrationId && !selectedConnection && !connectionsLoading && (
                <p className="text-xs text-destructive">
                  החיבור הנוכחי של הטבלה לא נמצא ברשימת החיבורים הפעילים — ייתכן שנותק. בחר חיבור אחר.
                </p>
              )}
            </div>
          )}

          {type === "google_analytics" && integrationId && (
            <div className="space-y-2">
              <Label>נכס (Property)</Label>
              {gaNeedsReconnect && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    החיבור הנבחר דורש התחברות מחדש ל-Google — לא ניתן למשוך את רשימת הנכסים.
                  </AlertDescription>
                </Alert>
              )}
              {propertiesLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Select value={propertyId} onValueChange={setPropertyId}>
                  <SelectTrigger>
                    <SelectValue placeholder={settings.propertyName ? `${settings.propertyName} (נוכחי)` : "בחר נכס"} />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-3rem)]">
                    <div className="p-2 sticky top-0 bg-popover">
                      <div className="relative">
                        <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="חפש נכס..."
                          value={propertySearch}
                          onChange={(e) => setPropertySearch(e.target.value)}
                          className="pr-8"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    {filteredProperties.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">לא נמצאו נכסים</div>
                    ) : (
                      filteredProperties.map((prop) => (
                        <SelectItem key={prop.id} value={prop.id} className="whitespace-normal break-words">
                          {prop.name} ({prop.accountName})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {accountFieldLabel && type !== "google_analytics" && (
            <div className="space-y-2">
              <Label>{accountFieldLabel}</Label>
              <Input value={accountId} onChange={(e) => setAccountId(e.target.value)} dir="ltr" />
            </div>
          )}

          {isAds && (
            <div className="space-y-2">
              <Label>סוג קמפיין</Label>
              <Select value={campaignType || "unset"} onValueChange={(v) => setCampaignType(v === "unset" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="לא מוגדר (ברירת מחדל: לידים)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">לא מוגדר (ברירת מחדל: לידים)</SelectItem>
                  <SelectItem value="leads">לידים</SelectItem>
                  <SelectItem value="ecommerce">איקומרס (מכירות)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                איקומרס = הדשבורד יציג הכנסות ו-ROAS מהפלטפורמה; לידים = עלות לליד.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>סוכנות</Label>
            <Select value={agencyId || "none"} onValueChange={(v) => { setAgencyId(v === "none" ? "" : v); setClientId(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="ללא סוכנות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא סוכנות</SelectItem>
                {agencies.map((agency: any) => (
                  <SelectItem key={agency.id} value={agency.id}>{agency.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {agencyId && (
            <div className="space-y-2">
              <Label>לקוח</Label>
              <Select value={clientId || "none"} onValueChange={(v) => setClientId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="ללא לקוח" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא לקוח</SelectItem>
                  {clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={isSaving} className="flex-1">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              שמור שינויים
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

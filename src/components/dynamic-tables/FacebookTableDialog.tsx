import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Facebook, Globe, Loader2, Lock, Users } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useAgencyClients, useTableDialogAgencies } from "@/hooks/useAgencyClients";
import { useUserIntegrations } from "@/hooks/useUserIntegrations";

interface FacebookTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignedClientIds?: string[];
}

interface AdAccount {
  id: string;
  name: string;
  account_status?: number;
  currency: string;
  business_id?: string | null;
  business_name?: string | null;
}

const dateRangeOptions = [
  { value: "today", label: "היום" },
  { value: "yesterday", label: "אתמול" },
  { value: "this_week", label: "השבוע" },
  { value: "last_7_days", label: "7 ימים אחרונים" },
  { value: "last_14_days", label: "14 יום" },
  { value: "last_30_days", label: "30 יום (ברירת מחדל)" },
  { value: "this_month", label: "החודש הנוכחי" },
];

const visibilityIcon = (value: string | null) => {
  if (value === "org") return <Globe className="h-3 w-3 text-blue-500" />;
  if (value === "shared") return <Users className="h-3 w-3 text-violet-500" />;
  return <Lock className="h-3 w-3 text-muted-foreground" />;
};

const normalizeAdAccountId = (value: string) => value.trim().replace(/^act_/i, "").replace(/\D/g, "");

export function FacebookTableDialog({ open, onOpenChange, assignedClientIds }: FacebookTableDialogProps) {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();

  const [tableName, setTableName] = useState("");
  const [adAccountInput, setAdAccountInput] = useState("");
  const [validatedAccount, setValidatedAccount] = useState<AdAccount | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [dateRange, setDateRange] = useState("last_30_days");
  const [category, setCategory] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedIntegrationId, setSelectedIntegrationId] = useState("");

  const { data: fbIntegrations = [], isLoading: loadingIntegrations } = useUserIntegrations(
    tenantId,
    "facebook_lead_ads",
    { enabled: open },
  );
  const { data: agencies = [] } = useTableDialogAgencies({ enabled: open });
  const { data: rawClients = [] } = useAgencyClients(agencyId || null, { enabled: open });
  const clients = assignedClientIds ? rawClients.filter((client) => assignedClientIds.includes(client.id)) : rawClients;

  useEffect(() => {
    if (!open) return;
    if (fbIntegrations.length === 0) {
      setSelectedIntegrationId("");
      return;
    }
    if (!selectedIntegrationId || !fbIntegrations.some((integration: any) => integration.id === selectedIntegrationId)) {
      const preferred = (fbIntegrations as any[]).find((integration) => integration._isOwn) || fbIntegrations[0];
      setSelectedIntegrationId((preferred as any).id);
    }
  }, [fbIntegrations, open, selectedIntegrationId]);

  useEffect(() => {
    setClientId("");
    setClientSearch("");
  }, [agencyId]);

  useEffect(() => {
    setValidatedAccount(null);
    setValidationError("");
  }, [selectedIntegrationId]);

  const validateAccount = async () => {
    const normalizedId = normalizeAdAccountId(adAccountInput);
    if (!normalizedId) {
      setValidationError("יש להזין מזהה חשבון מודעות תקין");
      setValidatedAccount(null);
      return;
    }
    if (!selectedIntegrationId) {
      setValidationError("יש לבחור חיבור Facebook");
      return;
    }

    setIsValidating(true);
    setValidationError("");
    setValidatedAccount(null);

    try {
      const response = await supabase.functions.invoke(
        `get-facebook-ad-accounts?integration_id=${encodeURIComponent(selectedIntegrationId)}&ad_account_id=${encodeURIComponent(normalizedId)}`,
        { method: "GET" },
      );
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.message || response.data.error);
      const account = response.data?.ad_account || response.data?.ad_accounts?.[0];
      if (!account) throw new Error("לא התקבלו פרטי חשבון");
      setValidatedAccount(account);
      setAdAccountInput(account.id || `act_${normalizedId}`);
      toast.success("חשבון המודעות אומת בהצלחה");
    } catch (error: any) {
      setValidationError(error?.message || "לא ניתן לאמת את חשבון המודעות");
    } finally {
      setIsValidating(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!validatedAccount) throw new Error("יש לאמת את חשבון המודעות");
      const slug = `${tableName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\u0590-\u05FF-]/g, "")}-${Date.now().toString(36)}`;
      const response = await supabase.functions.invoke("crm-tables", {
        method: "POST",
        body: {
          name: tableName,
          slug,
          category: category || "Facebook Insights",
          integration_type: "facebook_insights",
          integration_settings: {
            ad_account_id: validatedAccount.id,
            ad_account_name: validatedAccount.name,
            currency: validatedAccount.currency || "ILS",
            date_range: dateRange,
            sync_frequency: "daily",
            integration_id: selectedIntegrationId,
          },
          agency_id: agencyId || null,
          client_id: clientId || null,
        },
      });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["crm-tables", tenantId] });
      toast.success("טבלת Facebook Insights נוצרה בהצלחה");
      try {
        await supabase.functions.invoke("sync-facebook-insights", {
          method: "POST",
          body: { table_id: data.id },
        });
        toast.success("הנתונים סונכרנו בהצלחה");
      } catch (error) {
        console.error("Initial sync failed", error);
        toast.error("הטבלה נוצרה אך הסנכרון הראשוני נכשל");
      }
      handleClose();
      navigate(buildPath(`/table/${data.slug}`));
    },
    onError: (error: any) => toast.error(`שגיאה ביצירת הטבלה: ${error.message}`),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!tableName.trim()) return toast.error("יש להזין שם לטבלה");
    if (!validatedAccount) return toast.error("יש לאמת את חשבון המודעות");
    if (assignedClientIds && !clientId) return toast.error("יש לבחור לקוח");
    createMutation.mutate();
  };

  const handleClose = () => {
    setTableName("");
    setAdAccountInput("");
    setValidatedAccount(null);
    setValidationError("");
    setDateRange("last_30_days");
    setCategory("");
    setAgencyId("");
    setClientId("");
    setClientSearch("");
    setSelectedIntegrationId("");
    onOpenChange(false);
  };

  const isFacebookConfigured = fbIntegrations.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent dir="rtl" className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5 text-blue-600" />
            יצירת טבלת Facebook Insights
          </DialogTitle>
          <DialogDescription>הזן מזהה חשבון מודעות, אמת אותו וצור דוח בלי לטעון את כל החשבונות.</DialogDescription>
        </DialogHeader>

        {loadingIntegrations ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !isFacebookConfigured ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              האינטגרציה עם פייסבוק לא מוגדרת. עבור ל
              <Button variant="link" className="h-auto p-0" onClick={() => { handleClose(); navigate(buildPath("/integrations/facebook")); }}>
                הגדרות פייסבוק
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {fbIntegrations.length > 1 && (
              <div className="space-y-2">
                <Label>חיבור Facebook לשימוש</Label>
                <Select value={selectedIntegrationId} onValueChange={setSelectedIntegrationId}>
                  <SelectTrigger><SelectValue placeholder="בחר חיבור" /></SelectTrigger>
                  <SelectContent>
                    {(fbIntegrations as any[]).map((integration) => {
                      const settings = integration.settings as any;
                      const visibility = integration.connection_visibility || (integration._isOwn ? "private" : null);
                      return (
                        <SelectItem key={integration.id} value={integration.id}>
                          <div className="flex items-center gap-2">
                            {visibilityIcon(visibility)}
                            <span>{settings?.page_name || "Facebook"}</span>
                            {integration._isOwn && <Badge variant="secondary" className="py-0 text-xs">שלי</Badge>}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="table-name">שם הטבלה</Label>
              <Input id="table-name" value={tableName} onChange={(event) => setTableName(event.target.value)} placeholder="למשל: דוח בילבי Facebook" autoFocus />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ad-account-id">מזהה חשבון מודעות</Label>
              <div className="flex gap-2">
                <Input
                  id="ad-account-id"
                  dir="ltr"
                  value={adAccountInput}
                  onChange={(event) => { setAdAccountInput(event.target.value); setValidatedAccount(null); setValidationError(""); }}
                  placeholder="act_123456789 או 123456789"
                />
                <Button type="button" variant="outline" onClick={validateAccount} disabled={isValidating || !selectedIntegrationId}>
                  {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : "בדוק חשבון"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">ניתן להדביק את המזהה עם או בלי התחילית act_.</p>
              {validationError && <Alert variant="destructive"><AlertDescription>{validationError}</AlertDescription></Alert>}
              {validatedAccount && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    <div className="font-medium">{validatedAccount.name}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">{validatedAccount.id} · {validatedAccount.currency}</div>
                    {validatedAccount.business_name && <div className="text-xs text-muted-foreground">Business Manager: {validatedAccount.business_name}</div>}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="space-y-2">
              <Label>טווח תאריכים לסנכרון</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{dateRangeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>קטגוריה (אופציונלי)</Label>
              <Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Facebook Insights" />
            </div>

            <div className="space-y-2">
              <Label>שיוך לסוכנות (אופציונלי)</Label>
              <Select value={agencyId || "__none__"} onValueChange={(value) => setAgencyId(value === "__none__" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="ללא שיוך" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ללא שיוך</SelectItem>
                  {agencies.map((agency) => <SelectItem key={agency.id} value={agency.id}>{agency.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {agencyId && (
              <div className="space-y-2">
                <Label>{assignedClientIds ? "שיוך ללקוח" : "שיוך ללקוח (אופציונלי)"}</Label>
                <Input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="חפש לקוח..." />
                <Select value={clientId || "__none__"} onValueChange={(value) => setClientId(value === "__none__" ? "" : value)}>
                  <SelectTrigger><SelectValue placeholder="ללא שיוך" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא שיוך</SelectItem>
                    {clients.filter((client) => client.name?.toLowerCase().includes(clientSearch.toLowerCase())).map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>ביטול</Button>
              <Button type="submit" disabled={createMutation.isPending || !validatedAccount}>
                {createMutation.isPending ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" />יוצר...</> : "צור טבלה"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

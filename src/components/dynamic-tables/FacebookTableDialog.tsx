import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserIntegrations } from "@/hooks/useUserIntegrations";
import { Loader2, Facebook, AlertCircle, Lock, Globe, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FacebookTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignedClientIds?: string[];
}

interface AdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
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

const visibilityIcon = (v: string | null) => {
  if (v === "org") return <Globe className="h-3 w-3 text-blue-500" />;
  if (v === "shared") return <Users className="h-3 w-3 text-violet-500" />;
  return <Lock className="h-3 w-3 text-muted-foreground" />;
};

const visibilityLabel = (v: string | null) => {
  if (v === "org") return "ארגוני";
  if (v === "shared") return "משותף";
  return "פרטי";
};

export function FacebookTableDialog({ open, onOpenChange, assignedClientIds }: FacebookTableDialogProps) {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();

  const [tableName, setTableName] = useState("");
  const [selectedAdAccount, setSelectedAdAccount] = useState("");
  const [dateRange, setDateRange] = useState("last_30_days");
  const [category, setCategory] = useState("");
  const [adAccountSearch, setAdAccountSearch] = useState("");
  const [agencyId, setAgencyId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>("");

  // Fetch all Facebook integrations accessible to this user (own + shared)
  const { data: fbIntegrations = [], isLoading: loadingIntegrations } = useUserIntegrations(
    tenantId,
    'facebook_lead_ads',
    { enabled: open }
  );

  // Auto-select first integration (prefer own)
  useEffect(() => {
    if (!open) return;
    if (fbIntegrations.length === 0) {
      setSelectedIntegrationId("");
      return;
    }
    if (!selectedIntegrationId || !fbIntegrations.some((i: any) => i.id === selectedIntegrationId)) {
      const ownFirst = (fbIntegrations as any[]).find((i) => i._isOwn) || fbIntegrations[0];
      setSelectedIntegrationId((ownFirst as any).id);
    }
  }, [fbIntegrations, open]);

  // Fetch agencies
  const { data: agencies = [] } = useQuery({
    queryKey: ['agencies', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!tenantId,
  });

  // Fetch clients based on selected agency
  const { data: rawClients = [] } = useQuery({
    queryKey: ['clients-for-table', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('agency_id', agencyId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!agencyId,
  });

  const clients = assignedClientIds
    ? rawClients.filter(c => assignedClientIds.includes(c.id))
    : rawClients;

  // Reset client when agency changes
  useEffect(() => {
    setClientId("");
    setClientSearch("");
  }, [agencyId]);

  // Reset ad account when integration changes
  useEffect(() => {
    setSelectedAdAccount("");
    setAdAccountSearch("");
  }, [selectedIntegrationId]);

  // Fetch ad accounts for the selected integration
  const { data: adAccountsData, isLoading: loadingAdAccounts, error: adAccountsError } = useQuery({
    queryKey: ['facebook-ad-accounts', selectedIntegrationId],
    queryFn: async () => {
      const params = selectedIntegrationId ? `?integration_id=${selectedIntegrationId}` : '';
      const response = await supabase.functions.invoke(`get-facebook-ad-accounts${params}`, {
        method: 'GET',
      });
      if (response.error) throw response.error;
      return response.data;
    },
    enabled: open && !!selectedIntegrationId,
  });

  const adAccounts: AdAccount[] = adAccountsData?.ad_accounts || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const slug = tableName.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\u0590-\u05FF-]/g, '')
        + '-' + Date.now().toString(36);

      const selectedAccount = adAccounts.find(acc => acc.id === selectedAdAccount);

      const response = await supabase.functions.invoke('crm-tables', {
        method: 'POST',
        body: {
          name: tableName,
          slug,
          category: category || 'Facebook Insights',
          integration_type: 'facebook_insights',
          integration_settings: {
            ad_account_id: selectedAdAccount,
            ad_account_name: selectedAccount?.name || '',
            currency: selectedAccount?.currency || 'ILS',
            date_range: dateRange,
            sync_frequency: 'daily',
            // Store the integration_id so cron-sync uses the correct token
            integration_id: selectedIntegrationId || null,
          },
          agency_id: agencyId || null,
          client_id: clientId || null,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      toast.success('טבלת Facebook Insights נוצרה בהצלחה');

      // Trigger initial sync
      try {
        toast.info('מסנכרן נתונים מפייסבוק...');
        await supabase.functions.invoke('sync-facebook-insights', {
          method: 'POST',
          body: { table_id: data.id },
        });
        toast.success('הנתונים סונכרנו בהצלחה');
      } catch (err) {
        console.error('Initial sync failed:', err);
        toast.error('הטבלה נוצרה אך הסנכרון נכשל - נסה לסנכרן ידנית');
      }

      handleClose();
      navigate(buildPath(`/table/${data.slug}`));
    },
    onError: (error: any) => {
      toast.error('שגיאה ביצירת הטבלה: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) {
      toast.error('יש להזין שם לטבלה');
      return;
    }
    if (!selectedAdAccount) {
      toast.error('יש לבחור חשבון מודעות');
      return;
    }
    if (assignedClientIds && !clientId) {
      toast.error('יש לבחור לקוח');
      return;
    }
    createMutation.mutate();
  };

  const handleClose = () => {
    setTableName("");
    setSelectedAdAccount("");
    setDateRange("last_30_days");
    setCategory("");
    setAdAccountSearch("");
    setAgencyId("");
    setClientId("");
    setSelectedIntegrationId("");
    onOpenChange(false);
  };

  const isFacebookConfigured = fbIntegrations.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent dir="rtl" className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5 text-blue-600" />
            יצירת טבלת Facebook Insights
          </DialogTitle>
          <DialogDescription>
            צור טבלה שתסנכרן אוטומטית נתוני קמפיינים מפייסבוק
          </DialogDescription>
        </DialogHeader>

        {loadingIntegrations ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !isFacebookConfigured ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              האינטגרציה עם פייסבוק לא מוגדרת. יש להגדיר תחילה את החיבור בדף{" "}
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => {
                  handleClose();
                  navigate(buildPath('/integrations/facebook'));
                }}
              >
                הגדרות פייסבוק
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Connection selector — only shown when more than one connection is available */}
            {fbIntegrations.length > 1 && (
              <div className="space-y-2">
                <Label>חיבור Facebook לשימוש</Label>
                <Select value={selectedIntegrationId} onValueChange={setSelectedIntegrationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר חיבור" />
                  </SelectTrigger>
                  <SelectContent>
                    {(fbIntegrations as any[]).map((intg) => {
                      const settings = intg.settings as any;
                      const pageName = settings?.page_name || 'Facebook';
                      const visibility = intg.connection_visibility || (intg._isOwn ? 'private' : null);
                      return (
                        <SelectItem key={intg.id} value={intg.id}>
                          <div className="flex items-center gap-2">
                            {visibilityIcon(visibility)}
                            <span>{pageName}</span>
                            {intg._isOwn && (
                              <Badge variant="secondary" className="text-xs py-0">שלי</Badge>
                            )}
                            {intg._sharedByName && (
                              <Badge variant="outline" className="text-xs py-0">
                                של {intg._sharedByName}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              ({visibilityLabel(visibility)})
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  חשבונות המודעות שיוצגו תלויים בחיבור שנבחר
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="table-name">שם הטבלה</Label>
              <Input
                id="table-name"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="למשל: ניתוח קמפיינים דצמבר"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ad-account">חשבון מודעות</Label>
              {loadingAdAccounts ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  טוען חשבונות מודעות...
                </div>
              ) : adAccountsError ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    שגיאה בטעינת חשבונות מודעות: {(adAccountsError as any)?.message}
                  </AlertDescription>
                </Alert>
              ) : adAccounts.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    לא נמצאו חשבונות מודעות. ודא שהטוקן מכיל הרשאת ads_read
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Input
                    placeholder="חפש חשבון מודעות..."
                    value={adAccountSearch}
                    onChange={(e) => setAdAccountSearch(e.target.value)}
                    className="mb-2"
                  />
                  <Select value={selectedAdAccount} onValueChange={setSelectedAdAccount}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר חשבון מודעות" />
                    </SelectTrigger>
                    <SelectContent>
                      {adAccounts
                        .filter((account) =>
                          account.name?.toLowerCase().includes(adAccountSearch.toLowerCase()) ||
                          account.id?.includes(adAccountSearch)
                        )
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name} ({account.currency})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-range">טווח תאריכים לסנכרון</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dateRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">קטגוריה (אופציונלי)</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Facebook Insights"
              />
            </div>

            <div className="space-y-2">
              <Label>שיוך לסוכנות (אופציונלי)</Label>
              <Select value={agencyId || "__none__"} onValueChange={(v) => setAgencyId(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="ללא שיוך - כל הסוכנויות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ללא שיוך - כל הסוכנויות</SelectItem>
                  {agencies.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>
                      {agency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {agencyId && (
              <div className="space-y-2">
                <Label>{assignedClientIds ? 'שיוך ללקוח' : 'שיוך ללקוח (אופציונלי)'}</Label>
                <Input
                  placeholder="חפש לקוח..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="mb-2"
                />
                <Select value={clientId || "__none__"} onValueChange={(v) => setClientId(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="ללא שיוך - כל הלקוחות" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא שיוך - כל הלקוחות</SelectItem>
                    {clients
                      .filter((client) =>
                        client.name?.toLowerCase().includes(clientSearch.toLowerCase())
                      )
                      .map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                ביטול
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !selectedAdAccount}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    יוצר...
                  </>
                ) : (
                  'צור טבלה'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

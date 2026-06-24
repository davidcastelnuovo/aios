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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Loader2, AlertCircle, Check, ChevronsUpDown, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface GoogleAdsTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignedClientIds?: string[];
}

interface GoogleAdsAccount {
  id: string;
  name: string;
  currency: string;
  manager: boolean;
  manager_id?: string;
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

export function GoogleAdsTableDialog({ open, onOpenChange, assignedClientIds }: GoogleAdsTableDialogProps) {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const queryClient = useQueryClient();
  const { tenantId, tenant } = useCurrentTenant();

  const [tableName, setTableName] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [dateRange, setDateRange] = useState("last_30_days");
  const [category, setCategory] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [agencyId, setAgencyId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const dataSource = "direct_api" as const;
  const [campaignType, setCampaignType] = useState<"leads" | "ecommerce">("leads");

  // Fetch agencies (including cross-tenant shared agencies)
  const { data: agencies = [] } = useQuery({
    queryKey: ['agencies', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data: ownedAgencies, error: ownedError } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('name');
      if (ownedError) throw ownedError;

      const { data: sharedAccess, error: sharedError } = await supabase
        .from('agency_tenant_access')
        .select(`
          agency_id,
          agencies (
            id,
            name
          )
        `)
        .eq('accessing_tenant_id', tenantId);
      if (sharedError) throw sharedError;

      const sharedAgencies = (sharedAccess || [])
        .map((row: any) => Array.isArray(row.agencies) ? row.agencies[0] : row.agencies)
        .filter(Boolean)
        .map((agency: any) => ({ id: agency.id, name: agency.name }));

      const mergedAgencies = [...(ownedAgencies || []), ...sharedAgencies].filter(
        (agency, index, arr) => arr.findIndex((item) => item.id === agency.id) === index
      );

      return mergedAgencies.sort((a, b) => a.name.localeCompare(b.name, 'he'));
    },
    enabled: open && !!tenantId,
  });

  // Fetch clients based on selected agency
  const { data: rawClients = [] } = useQuery({
    queryKey: ['clients-for-table', tenantId, agencyId],
    queryFn: async () => {
      if (!agencyId || !tenantId) return [];
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .or(`tenant_id.eq.${tenantId},agency_id.eq.${agencyId}`)
        .eq('agency_id', agencyId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!agencyId && !!tenantId,
  });

  const clients = assignedClientIds
    ? rawClients.filter(c => assignedClientIds.includes(c.id))
    : rawClients;

  // Reset client when agency changes
  useEffect(() => {
    setClientId("");
  }, [agencyId]);

  // Check if Google Ads is connected (direct API)
  const { data: googleAdsStatus, isLoading: checkingConnection } = useQuery({
    queryKey: ['google-ads-connection-status'],
    queryFn: async () => {
      const response = await supabase.functions.invoke('google-ads-auth', {
        body: { action: 'check_status' },
      });
      if (response.error) throw response.error;
      return response.data;
    },
    enabled: open && dataSource === 'direct_api',
  });

  // Fetch Google Ads accounts (direct API)
  const { data: accountsData, isLoading: loadingAccounts, error: accountsError } = useQuery({
    queryKey: ['google-ads-accounts'],
    queryFn: async () => {
      const response = await supabase.functions.invoke('google-ads-auth', {
        body: { action: 'get_accounts' },
      });
      if (response.error) throw response.error;
      return response.data;
    },
    enabled: open && dataSource === 'direct_api' && googleAdsStatus?.is_connected,
  });

  const accounts: GoogleAdsAccount[] = accountsData?.accounts || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const slug = tableName.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\u0590-\u05FF-]/g, '')
        + '-' + Date.now().toString(36);

      const selectedAcc = accounts.find(acc => acc.id === selectedAccount);
      const integrationSettings: Record<string, any> = {
        date_range: dateRange,
        sync_frequency: 'daily',
        data_source: dataSource,
        campaign_type: campaignType,
        customer_id: selectedAccount,
        account_name: selectedAcc?.name || '',
        currency: selectedAcc?.currency || 'ILS',
        manager_id: selectedAcc?.manager_id || undefined,
      };

      // Resolve agency_id: prefer the client's agency_id if a client is selected
      // (ensures cross-tenant visibility via shared agencies). Fall back to selected agencyId.
      let resolvedAgencyId: string | null = agencyId || null;
      if (clientId) {
        const { data: clientRow } = await supabase
          .from('clients')
          .select('agency_id')
          .eq('id', clientId)
          .maybeSingle();
        if (clientRow?.agency_id) resolvedAgencyId = clientRow.agency_id;
      }

      const response = await supabase.functions.invoke('crm-tables', {
        method: 'POST',
        body: {
          name: tableName,
          slug,
          category: category || 'Google Ads',
          integration_type: 'google_ads',
          integration_settings: integrationSettings,
          agency_id: resolvedAgencyId,
          client_id: clientId || null,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      toast.success('טבלת Google Ads נוצרה בהצלחה');

      // Trigger initial sync (direct API)
      try {
        toast.info('מסנכרן נתונים מ-Google Ads...');
        await supabase.functions.invoke('sync-google-ads-data', {
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
    
    if (!selectedAccount) {
      toast.error('יש לבחור חשבון Google Ads');
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
    setSelectedAccount("");
    setDateRange("last_30_days");
    setCategory("");
    setAccountSearch("");
    setAgencyId("");
    setClientId("");
    setCampaignType("leads");
    onOpenChange(false);
  };

  const isDirectApiConnected = googleAdsStatus?.is_connected;

  // Determine if the form is ready to submit
  const canSubmit = tableName.trim() && selectedAccount;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent dir="rtl" className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
              <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="#4285F4"/>
            </svg>
            יצירת טבלת Google Ads
          </DialogTitle>
          <DialogDescription>
            צור טבלה שתסנכרן נתוני קמפיינים מ-Google Ads
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Campaign Type Selection */}
          <div className="space-y-3">
            <Label>סוג קמפיין</Label>
            <RadioGroup 
              value={campaignType} 
              onValueChange={(v) => setCampaignType(v as "leads" | "ecommerce")}
              className="grid grid-cols-2 gap-2"
            >
              <div className={`flex items-center space-x-2 space-x-reverse border rounded-lg p-3 cursor-pointer hover:bg-muted/50 ${campaignType === 'leads' ? 'border-primary bg-primary/5' : ''}`}>
                <RadioGroupItem value="leads" id="leads-type" />
                <Label htmlFor="leads-type" className="cursor-pointer flex-1">
                  <div className="font-medium">לידים</div>
                  <div className="text-xs text-muted-foreground">המרות, עלות להמרה, CTR</div>
                </Label>
              </div>
              
              <div className={`flex items-center space-x-2 space-x-reverse border rounded-lg p-3 cursor-pointer hover:bg-muted/50 ${campaignType === 'ecommerce' ? 'border-primary bg-primary/5' : ''}`}>
                <RadioGroupItem value="ecommerce" id="ecommerce-type" />
                <Label htmlFor="ecommerce-type" className="cursor-pointer flex-1">
                  <div className="font-medium">איקומרס</div>
                  <div className="text-xs text-muted-foreground">רכישות, הכנסות, ROAS</div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Table Name */}
          <div className="space-y-2">
            <Label htmlFor="table-name">שם הטבלה</Label>
            <Input
              id="table-name"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="למשל: ניתוח קמפיינים גוגל דצמבר"
              autoFocus
            />
          </div>

          {/* Direct API Source */}
          {checkingConnection ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !isDirectApiConnected ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                האינטגרציה עם Google Ads לא מוגדרת. יש להתחבר תחילה בדף{" "}
                <Button
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => {
                    handleClose();
                    navigate(buildPath('/google-ads-settings'));
                  }}
                >
                  הגדרות Google Ads
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="account">חשבון Google Ads</Label>
              {loadingAccounts ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  טוען חשבונות...
                </div>
              ) : accountsError ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    שגיאה בטעינת חשבונות: {(accountsError as any)?.message}
                  </AlertDescription>
                </Alert>
              ) : accounts.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    לא נמצאו חשבונות Google Ads
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Input
                    placeholder="חפש חשבון..."
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    className="mb-2"
                  />
                  <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר חשבון" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        .filter((account) => {
                          const searchTerm = accountSearch.trim().toLowerCase();
                          if (!searchTerm) return true;

                          const normalizedSearchTerm = searchTerm.replace(/\D/g, '');
                          const formattedAccountId = account.id.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');

                          return (
                            account.name?.toLowerCase().includes(searchTerm) ||
                            formattedAccountId.includes(searchTerm) ||
                            account.id?.includes(normalizedSearchTerm)
                          );
                        })
                        .map((account) => {
                          const formattedAccountId = account.id.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');

                          return (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name} ({formattedAccountId}) • {account.currency} {account.manager ? '(MCC)' : ''}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          )}

          {/* Date Range */}
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
              placeholder="Google Ads"
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
              <Label>שיוך ללקוח (אופציונלי)</Label>
              <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {clientId
                      ? clients.find(c => c.id === clientId)?.name || "לקוח נבחר"
                      : "ללא שיוך - כל הלקוחות"}
                    <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="flex items-center border-b px-3 py-2">
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input
                      placeholder="חפש לקוח..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="border-0 shadow-none focus-visible:ring-0 h-8"
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto p-1">
                    <button
                      type="button"
                      className={cn(
                        "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent",
                        !clientId && "bg-accent"
                      )}
                      onClick={() => { setClientId(""); setClientPopoverOpen(false); setClientSearch(""); }}
                    >
                      <Check className={cn("ml-2 h-4 w-4", !clientId ? "opacity-100" : "opacity-0")} />
                      ללא שיוך - כל הלקוחות
                    </button>
                    {clients
                      .filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                      .map((client) => (
                        <button
                          type="button"
                          key={client.id}
                          className={cn(
                            "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent",
                            clientId === client.id && "bg-accent"
                          )}
                          onClick={() => { setClientId(client.id); setClientPopoverOpen(false); setClientSearch(""); }}
                        >
                          <Check className={cn("ml-2 h-4 w-4", clientId === client.id ? "opacity-100" : "opacity-0")} />
                          {client.name}
                        </button>
                      ))}
                    {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-4">לא נמצאו לקוחות</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              ביטול
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending || !canSubmit}
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
      </DialogContent>
    </Dialog>
  );
}
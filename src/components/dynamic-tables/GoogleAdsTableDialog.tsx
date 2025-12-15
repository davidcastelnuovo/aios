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
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GoogleAdsTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GoogleAdsAccount {
  id: string;
  name: string;
  currency: string;
  manager: boolean;
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

export function GoogleAdsTableDialog({ open, onOpenChange }: GoogleAdsTableDialogProps) {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();

  const [tableName, setTableName] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [dateRange, setDateRange] = useState("last_30_days");
  const [category, setCategory] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [agencyId, setAgencyId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");

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
  const { data: clients = [] } = useQuery({
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

  // Reset client when agency changes
  useEffect(() => {
    setClientId("");
  }, [agencyId]);

  // Check if Google Ads is connected
  const { data: googleAdsStatus, isLoading: checkingConnection } = useQuery({
    queryKey: ['google-ads-connection-status'],
    queryFn: async () => {
      const response = await supabase.functions.invoke('google-ads-auth', {
        body: { action: 'check_status' },
      });
      if (response.error) throw response.error;
      return response.data;
    },
    enabled: open,
  });

  // Fetch Google Ads accounts
  const { data: accountsData, isLoading: loadingAccounts, error: accountsError } = useQuery({
    queryKey: ['google-ads-accounts'],
    queryFn: async () => {
      const response = await supabase.functions.invoke('google-ads-auth', {
        body: { action: 'get_accounts' },
      });
      if (response.error) throw response.error;
      return response.data;
    },
    enabled: open && googleAdsStatus?.is_connected,
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

      const response = await supabase.functions.invoke('crm-tables', {
        method: 'POST',
        body: {
          name: tableName,
          slug,
          category: category || 'Google Ads',
          integration_type: 'google_ads',
          integration_settings: {
            customer_id: selectedAccount,
            account_name: selectedAcc?.name || '',
            currency: selectedAcc?.currency || 'ILS',
            date_range: dateRange,
            sync_frequency: 'daily',
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
      toast.success('טבלת Google Ads נוצרה בהצלחה');
      
      // Trigger initial sync
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
    onOpenChange(false);
  };

  const isConnected = googleAdsStatus?.is_connected;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
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

        {checkingConnection ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !isConnected ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              האינטגרציה עם Google Ads לא מוגדרת. יש להתחבר תחילה בדף{" "}
              <Button 
                variant="link" 
                className="p-0 h-auto" 
                onClick={() => {
                  handleClose();
                  navigate(buildPath('/integrations'));
                }}
              >
                אינטגרציות
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
                        .filter((account) => 
                          account.name?.toLowerCase().includes(accountSearch.toLowerCase()) ||
                          account.id?.includes(accountSearch)
                        )
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name} ({account.currency}) {account.manager ? '(MCC)' : ''}
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
                <Select value={clientId || "__none__"} onValueChange={(v) => setClientId(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="ללא שיוך - כל הלקוחות" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא שיוך - כל הלקוחות</SelectItem>
                    {clients.map((client) => (
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
                disabled={createMutation.isPending || !selectedAccount}
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

import { useState, useEffect, useMemo } from "react";
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
import { Loader2, AlertCircle, Webhook, Plug, Check, ChevronsUpDown, Search } from "lucide-react";
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

interface MakeConnection {
  id: number;
  name: string;
  accountName?: string;
  typeName?: string;
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

// Make.com icon
const MakeIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" fill="#6D29D9"/>
    <path d="M8 12l3 3 5-6" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

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
  const [dataSource, setDataSource] = useState<"make_api" | "direct_api" | "webhook">("make_api");
  const [selectedMakeConnection, setSelectedMakeConnection] = useState("");
  const [customerIdInput, setCustomerIdInput] = useState("");
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

  // Fetch Make API integration
  const { data: makeApiIntegration } = useQuery({
    queryKey: ['make-api-integration', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'make_api')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!tenantId,
  });

  // Fetch Google Ads via Make integration
  const { data: googleAdsViaMakeIntegration } = useQuery({
    queryKey: ['google-ads-via-make-integration', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'google_ads_via_make')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!tenantId,
  });

  const makeApiSettings = makeApiIntegration?.settings as { 
    api_token?: string; 
    team_id?: string; 
    region?: string;
    google_ads_template_scenario_id?: string;
  } | null;

  const isMakeApiConnected = makeApiIntegration?.is_active && makeApiSettings?.api_token;
  const isViaMakeConnected = googleAdsViaMakeIntegration?.is_active;

  // Fetch Google Ads connections from Make.com
  const { data: makeConnections = [], isLoading: loadingMakeConnections } = useQuery({
    queryKey: ['make-google-ads-connections-dialog', tenantId],
    queryFn: async () => {
      if (!makeApiSettings?.api_token || !makeApiSettings?.team_id) return [];
      
      const { data, error } = await supabase.functions.invoke('make-api', {
        body: {
          action: 'list_google_ads_connections',
          api_token: makeApiSettings.api_token,
          team_id: makeApiSettings.team_id,
          region: makeApiSettings.region || 'eu1',
        },
      });

      if (error || data?.error) return [];
      return data?.connections || [];
    },
    enabled: open && !!isMakeApiConnected && dataSource === 'make_api',
  });

  // Fetch Google Ads client accounts from selected Make connection
  const { data: makeAccountsList = [], isLoading: loadingMakeAccounts } = useQuery({
    queryKey: ['make-google-ads-accounts', tenantId, selectedMakeConnection],
    queryFn: async () => {
      if (!makeApiSettings?.api_token || !makeApiSettings?.team_id || !selectedMakeConnection) return [];
      
      const { data, error } = await supabase.functions.invoke('make-api', {
        body: {
          action: 'list_google_ads_accounts',
          api_token: makeApiSettings.api_token,
          team_id: makeApiSettings.team_id,
          region: makeApiSettings.region || 'eu1',
          connection_id: selectedMakeConnection,
        },
      });

      if (error || data?.error) {
        console.warn('Failed to fetch Google Ads accounts:', data?.error || error);
        return [];
      }
      return data?.accounts || [];
    },
    enabled: open && !!isMakeApiConnected && !!selectedMakeConnection && dataSource === 'make_api',
  });

  // Pre-select Make connection if already saved
  useEffect(() => {
    if (isViaMakeConnected) {
      const savedSettings = googleAdsViaMakeIntegration?.settings as { connection_id?: string } | null;
      if (savedSettings?.connection_id) {
        setSelectedMakeConnection(savedSettings.connection_id);
      }
    }
  }, [googleAdsViaMakeIntegration, isViaMakeConnected]);

  // Reset client when agency changes
  useEffect(() => {
    setClientId("");
  }, [agencyId]);

  // Reset customer ID when Make connection changes
  useEffect(() => {
    setCustomerIdInput("");
  }, [selectedMakeConnection]);

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

      let integrationSettings: Record<string, any> = {
        date_range: dateRange,
        sync_frequency: 'daily',
        data_source: dataSource,
        campaign_type: campaignType,
      };

      if (dataSource === 'make_api') {
        const selectedConn = (makeConnections as MakeConnection[]).find(
          c => c.id.toString() === selectedMakeConnection
        );
        // Format customer ID: remove dashes for storage
        const formattedCustomerId = customerIdInput.replace(/-/g, '');
        integrationSettings = {
          ...integrationSettings,
          make_connection_id: selectedMakeConnection,
          make_connection_name: selectedConn?.name || selectedConn?.accountName || '',
          make_team_id: makeApiSettings?.team_id,
          make_region: makeApiSettings?.region || 'eu1',
          customer_id: formattedCustomerId,
        };
      } else if (dataSource === 'direct_api') {
        const selectedAcc = accounts.find(acc => acc.id === selectedAccount);
        integrationSettings = {
          ...integrationSettings,
          customer_id: selectedAccount,
          account_name: selectedAcc?.name || '',
          currency: selectedAcc?.currency || 'ILS',
          manager_id: selectedAcc?.manager_id || undefined,
        };
      }
      // For webhook, we just set the data_source and let the user configure via Make.com

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
      
      // Auto-clone Template Scenario if using Make API and template is configured
      if (dataSource === 'make_api' && makeApiSettings?.google_ads_template_scenario_id) {
        try {
          toast.info('משכפל Scenario אוטומטית מ-Make.com...');
          
          const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-google-ads-sync`;
          const formattedCustomerId = customerIdInput.replace(/-/g, '');
          
          const cloneResult = await supabase.functions.invoke('make-api', {
            body: {
              action: 'clone_scenario',
              api_token: makeApiSettings.api_token,
              team_id: makeApiSettings.team_id,
              region: makeApiSettings.region || 'eu1',
              template_scenario_id: makeApiSettings.google_ads_template_scenario_id,
              table_id: data.id,
              webhook_url: webhookUrl,
              scenario_name: `חיבור לגוגל - ${tableName}`,
              customer_id: formattedCustomerId,
              campaign_type: campaignType,
              connection_id: selectedMakeConnection || undefined,
            },
          });
          
          if (cloneResult.data?.success && cloneResult.data?.scenario_id) {
            // Update the table with the cloned scenario_id
            const currentSettings = data.integration_settings || {};
            await supabase.functions.invoke('crm-tables', {
              method: 'PATCH',
              body: {
                table_id: data.id,
                integration_settings: {
                  ...currentSettings,
                  make_scenario_id: cloneResult.data.scenario_id,
                },
              },
            });
            
            toast.success(`Scenario נוצר אוטומטית: #${cloneResult.data.scenario_id}`);
          } else {
            console.warn('Scenario clone incomplete:', cloneResult.data);
            toast.warning('הטבלה נוצרה. שכפול ה-Scenario לא הצליח במלואו - ייתכן שתצטרך להגדיר ידנית.');
          }
        } catch (err) {
          console.error('Failed to clone scenario:', err);
          toast.warning('הטבלה נוצרה. לא ניתן לשכפל Scenario אוטומטית - הגדר ידנית ב-Make.com');
        }
      } else if (dataSource === 'make_api') {
        toast.info('הטבלה נוצרה. הגדר Template Scenario בהגדרות Make ליצירה אוטומטית.');
      } else if (dataSource === 'webhook') {
        toast.info('הטבלה נוצרה. הגדר Scenario ב-Make.com כדי לסנכרן נתונים.');
      } else if (dataSource === 'direct_api') {
        // Trigger initial sync only for direct API
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
    
    if (dataSource === 'direct_api' && !selectedAccount) {
      toast.error('יש לבחור חשבון Google Ads');
      return;
    }
    
    if (dataSource === 'make_api' && !selectedMakeConnection) {
      toast.error('יש לבחור חיבור Google Ads מ-Make.com');
      return;
    }
    
    if (dataSource === 'make_api' && !customerIdInput.trim()) {
      toast.error('יש להזין Google Ads Customer ID');
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
    setDataSource("make_api");
    setSelectedMakeConnection("");
    setCustomerIdInput("");
    setCampaignType("leads");
    onOpenChange(false);
  };

  const isDirectApiConnected = googleAdsStatus?.is_connected;

  // Determine if the form is ready to submit
  const canSubmit = tableName.trim() && (
    (dataSource === 'make_api' && selectedMakeConnection && customerIdInput.trim()) ||
    (dataSource === 'direct_api' && selectedAccount) ||
    (dataSource === 'webhook')
  );

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
          {/* Data Source Selection */}
          <div className="space-y-3">
            <Label>מקור נתונים</Label>
            <RadioGroup 
              value={dataSource} 
              onValueChange={(v) => setDataSource(v as any)}
              className="grid grid-cols-1 gap-2"
            >
              <div className="flex items-center space-x-2 space-x-reverse border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="make_api" id="make_api" />
                <Label htmlFor="make_api" className="flex items-center gap-2 cursor-pointer flex-1">
                  <MakeIcon className="h-4 w-4" />
                  <div>
                    <div className="font-medium">חיבור דרך Make.com API</div>
                    <div className="text-xs text-muted-foreground">מומלץ - ללא צורך ב-Developer Token</div>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 space-x-reverse border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="webhook" id="webhook" />
                <Label htmlFor="webhook" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Webhook className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Webhook מ-Make.com</div>
                    <div className="text-xs text-muted-foreground">שליטה מלאה על הנתונים</div>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 space-x-reverse border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="direct_api" id="direct_api" />
                <Label htmlFor="direct_api" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Plug className="h-4 w-4" />
                  <div>
                    <div className="font-medium">API ישיר</div>
                    <div className="text-xs text-muted-foreground">דורש Developer Token מאושר</div>
                  </div>
                </Label>
          </div>
            </RadioGroup>
          </div>

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

          {/* Make API Source */}
          {dataSource === 'make_api' && (
            <>
              {!isMakeApiConnected ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    יש להגדיר תחילה את אינטגרציית Make.com בדף{" "}
                    <Button 
                      variant="link" 
                      className="p-0 h-auto" 
                      onClick={() => {
                        handleClose();
                        navigate(buildPath('/make-settings'));
                      }}
                    >
                      הגדרות Make
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : loadingMakeConnections ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  טוען חיבורי Google Ads מ-Make.com...
                </div>
              ) : makeConnections.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    לא נמצאו חיבורי Google Ads ב-Make.com.{" "}
                    <Button 
                      variant="link" 
                      className="p-0 h-auto" 
                      onClick={() => {
                        handleClose();
                        navigate(buildPath('/google-ads-settings'));
                      }}
                    >
                      הגדר חיבור
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>בחר חיבור Google Ads מ-Make.com</Label>
                    <Select value={selectedMakeConnection} onValueChange={setSelectedMakeConnection}>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר חיבור..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(makeConnections as MakeConnection[]).map((conn) => (
                          <SelectItem key={conn.id} value={conn.id.toString()}>
                            {conn.name || conn.accountName || `חיבור ${conn.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {selectedMakeConnection && (
                    <div className="space-y-2">
                      <Label>חשבון Google Ads (Customer ID)</Label>
                      {loadingMakeAccounts ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          טוען חשבונות לקוח...
                        </div>
                      ) : makeAccountsList.length > 0 ? (
                        <>
                          <Select value={customerIdInput} onValueChange={setCustomerIdInput}>
                            <SelectTrigger>
                              <SelectValue placeholder="בחר חשבון לקוח..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(makeAccountsList as { id: string; name: string; manager: boolean }[]).map((acc) => (
                                <SelectItem key={acc.id} value={acc.id}>
                                  {acc.name || acc.id} ({acc.id.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            מוצגים רק חשבונות לקוח (ללא MCC)
                          </p>
                        </>
                      ) : (
                        <>
                          <Input
                            id="customer-id"
                            value={customerIdInput}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9-]/g, '');
                              setCustomerIdInput(value);
                            }}
                            placeholder="123-456-7890"
                            dir="ltr"
                            className="text-left"
                          />
                          <p className="text-xs text-muted-foreground">
                            לא ניתן לשלוף חשבונות אוטומטית. הזן Customer ID ידנית — ניתן למצוא ב-Google Ads בהגדרות החשבון.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Webhook Source */}
          {dataSource === 'webhook' && (
            <Alert className="border-purple-200 bg-purple-50">
              <MakeIcon className="h-4 w-4" />
              <AlertDescription className="text-purple-800">
                לאחר יצירת הטבלה, העתק את ה-table_id מכתובת הדף והגדר Scenario ב-Make.com 
                שישלח נתונים ל-Webhook. ראה הוראות מפורטות בדף{" "}
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-purple-800 underline" 
                  onClick={() => {
                    handleClose();
                    navigate(buildPath('/google-ads-settings'));
                  }}
                >
                  הגדרות Google Ads
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Direct API Source */}
          {dataSource === 'direct_api' && (
            <>
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
            </>
          )}

          {/* Date Range - for all sources */}
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
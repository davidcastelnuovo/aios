import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Plus, Trash2, Send, Pencil, Check, X, MoreVertical, Calendar as CalendarIcon, RefreshCw, Facebook, Settings, Link, BarChart3, Search, TrendingUp, Bell, SearchIcon, Sparkles, Info, Copy, Loader2, AlertCircle, Play, ShoppingCart } from "lucide-react";
import { AIAnalysisDialog } from "@/components/dynamic-tables/AIAnalysisDialog";
import { format, subDays, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenantPath } from "@/hooks/useTenantPath";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GoogleAnalyticsDashboard } from "@/components/dynamic-tables/GoogleAnalyticsDashboard";
import { SearchConsoleDashboard } from "@/components/dynamic-tables/SearchConsoleDashboard";
import { AlertsManagementDialog } from "@/components/dynamic-tables/AlertsManagementDialog";
import { ActiveAlerts } from "@/components/dynamic-tables/ActiveAlerts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MakeScenarioSettings } from "@/components/dynamic-tables/MakeScenarioSettings";

// Google Ads icon component
const GoogleAdsIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
  </svg>
);

interface CrmTable {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tenant_id: string;
  integration_type: string | null;
  integration_settings: any;
  secondary_integration_type?: string | null;
  secondary_integration_settings?: any;
}

interface CrmField {
  id: string;
  key: string;
  name: string;
  type: string;
  position: number;
  source?: string; // 'facebook' | 'google_ads' | null
}

interface CrmRecord {
  id: string;
  data: Record<string, any>;
}

export default function DynamicTableView() {
  const { tableSlug } = useParams<{ tableSlug: string }>();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const queryClient = useQueryClient();
  
  const [newColumnName, setNewColumnName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>("");
  const [adAccountSearch, setAdAccountSearch] = useState("");
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingFieldName, setEditingFieldName] = useState("");
  const [editingCell, setEditingCell] = useState<{ recordId: string; fieldKey: string; initialValue: string } | null>(null);
  const [cellValues, setCellValues] = useState<Record<string, string>>({});
  const [dateFilter, setDateFilter] = useState<string>("last_7_days");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [selectedSyncDateRange, setSelectedSyncDateRange] = useState<string>("last_30_days");
  const [activeTab, setActiveTab] = useState<string>("main"); // 'main' | 'facebook' | 'google_ads' | 'combined'
  const [showGoogleSettingsDialog, setShowGoogleSettingsDialog] = useState(false);
  const [selectedGoogleAccount, setSelectedGoogleAccount] = useState<string>("");
  const [showAlertsDialog, setShowAlertsDialog] = useState(false);
  const [showMakeWebhookDialog, setShowMakeWebhookDialog] = useState(false);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const cellInputRef = useRef<HTMLInputElement>(null);

  const debouncedCampaignSearch = useDebouncedValue(campaignSearch, 300);

  const dateFilterOptions = [
    { value: "all", label: "כל התאריכים" },
    { value: "today", label: "היום" },
    { value: "yesterday", label: "אתמול" },
    { value: "this_week", label: "השבוע" },
    { value: "last_week", label: "שבוע שעבר" },
    { value: "last_7_days", label: "7 ימים אחרונים" },
    { value: "last_14_days", label: "14 יום" },
    { value: "last_30_days", label: "30 יום" },
    { value: "this_month", label: "החודש" },
    { value: "last_month", label: "חודש שעבר" },
    { value: "last_90_days", label: "3 חודשים" },
    { value: "last_180_days", label: "6 חודשים" },
    { value: "last_365_days", label: "שנה" },
    { value: "custom", label: "תאריכים מותאמים..." },
  ];

  const syncDateRangeOptions = [
    { value: "last_7_days", label: "7 ימים אחרונים" },
    { value: "last_14_days", label: "14 יום" },
    { value: "last_30_days", label: "30 יום (ברירת מחדל)" },
    { value: "last_90_days", label: "3 חודשים" },
    { value: "last_180_days", label: "6 חודשים" },
    { value: "last_365_days", label: "שנה" },
    { value: "last_730_days", label: "שנתיים" },
    { value: "all_history", label: "כל ההיסטוריה" },
  ];

  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ['crm-tables'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const response = await supabase.functions.invoke('crm-tables', { method: 'GET' });
      if (response.error) throw response.error;
      // Ensure we always return an array
      return Array.isArray(response.data) ? response.data as CrmTable[] : [];
    },
  });

  const table = tables?.find((t) => t.slug === tableSlug);

  // Fetch ad accounts for settings dialog
  const { data: adAccounts, isLoading: adAccountsLoading } = useQuery({
    queryKey: ['facebook-ad-accounts'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const response = await supabase.functions.invoke('get-facebook-ad-accounts', {
        method: 'POST',
      });
      if (response.error) throw response.error;
      // Ensure we always return an array
      const accounts = response.data?.ad_accounts;
      return Array.isArray(accounts) ? accounts : [];
    },
    enabled: showSettingsDialog && (table?.integration_type === 'facebook_insights' || table?.integration_type === 'facebook_ecommerce'),
  });

  const { data: fields, isLoading: fieldsLoading } = useQuery({
    queryKey: ['crm-fields', table?.id],
    queryFn: async () => {
      if (!table?.id) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const response = await supabase.functions.invoke(`crm-fields?table_id=${table.id}`, {
        method: 'GET',
      });
      if (response.error) throw response.error;
      const fields = (response.data as any)?.fields || [];
      return (fields as CrmField[]).sort((a, b) => a.position - b.position);
    },
    enabled: !!table?.id,
  });

  const { data: records, isLoading: recordsLoading } = useQuery({
    queryKey: ['crm-records', table?.id, dateFilter, customDateRange.from?.toISOString(), customDateRange.to?.toISOString()],
    queryFn: async () => {
      if (!table?.id) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const params = new URLSearchParams({ table_id: table.id });
      if (dateFilter === 'custom' && customDateRange.from && customDateRange.to) {
        params.append('date_filter', 'custom');
        params.append('date_from', format(customDateRange.from, 'yyyy-MM-dd'));
        params.append('date_to', format(customDateRange.to, 'yyyy-MM-dd'));
      } else if (dateFilter !== 'all') {
        params.append('date_filter', dateFilter);
      }
      const response = await supabase.functions.invoke(`crm-records?${params.toString()}`, {
        method: 'GET',
      });
      if (response.error) throw response.error;
      // Ensure we always return an array
      return Array.isArray(response.data) ? response.data as CrmRecord[] : [];
    },
    enabled: !!table?.id && (dateFilter !== 'custom' || (!!customDateRange.from && !!customDateRange.to)),
    placeholderData: (previousData) => previousData, // Keep previous data while loading to prevent UI flash
  });

  // Filter records by campaign name search
  const filteredRecords = useMemo(() => {
    if (!records || !debouncedCampaignSearch.trim()) return records;
    const searchTerm = debouncedCampaignSearch.toLowerCase();
    return records.filter(record => {
      const campaignName = String(record.data?.campaign_name || '').toLowerCase();
      return campaignName.includes(searchTerm);
    });
  }, [records, debouncedCampaignSearch]);

  const addColumnMutation = useMutation({
    mutationFn: async (columnName: string) => {
      if (!table?.id) throw new Error('No table');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const key = columnName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\u0590-\u05FF]/g, '');
      const response = await supabase.functions.invoke('crm-fields', {
        method: 'POST',
        body: {
          table_id: table.id,
          key,
          name: columnName,
          type: 'text',
          position: (fields?.length || 0) + 1,
        },
      });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-fields', table?.id] });
      setNewColumnName("");
      toast.success('עמודה נוספה בהצלחה');
    },
    onError: (error: any) => {
      toast.error('שגיאה בהוספת עמודה: ' + error.message);
    },
  });

  const updateFieldNameMutation = useMutation({
    mutationFn: async ({ fieldId, name }: { fieldId: string; name: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-fields`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ field_id: fieldId, name }),
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update field');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-fields', table?.id] });
      setEditingFieldId(null);
      toast.success('שם העמודה עודכן בהצלחה');
    },
    onError: (error: any) => {
      toast.error('שגיאה בעדכון שם עמודה: ' + error.message);
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (fieldId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-fields`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ field_id: fieldId }),
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete field');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-fields', table?.id] });
      toast.success('עמודה נמחקה בהצלחה');
    },
    onError: (error: any) => {
      toast.error('שגיאה במחיקת עמודה: ' + error.message);
    },
  });

  const addRowMutation = useMutation({
    mutationFn: async () => {
      if (!table?.id) throw new Error('No table');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const emptyData: Record<string, any> = {};
      fields?.forEach(field => {
        emptyData[field.key] = '';
      });
      
      const response = await supabase.functions.invoke('crm-records', {
        method: 'POST',
        body: {
          table_id: table.id,
          data: emptyData,
        },
      });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', table?.id] });
      toast.success('שורה נוספה בהצלחה');
    },
    onError: (error: any) => {
      toast.error('שגיאה בהוספת שורה: ' + error.message);
    },
  });

  const deleteRowMutation = useMutation({
    mutationFn: async (recordId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-records`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ record_id: recordId }),
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete record');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', table?.id] });
      toast.success('שורה נמחקה בהצלחה');
    },
    onError: (error: any) => {
      toast.error('שגיאה במחיקת שורה: ' + error.message);
    },
  });

  const updateCellMutation = useMutation({
    mutationFn: async ({ recordId, key, value }: { recordId: string; key: string; value: any }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const record = records?.find(r => r.id === recordId);
      if (!record) throw new Error('Record not found');
      
      const updatedData = { ...record.data, [key]: value };
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-records`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            record_id: recordId,
            data: updatedData,
          }),
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update cell');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', table?.id] });
    },
    onError: (error: any) => {
      toast.error('שגיאה בעדכון תא: ' + error.message);
    },
  });

  const sendWebhookMutation = useMutation({
    mutationFn: async () => {
      if (!webhookUrl) throw new Error('No webhook URL');
      if (!records || !fields) throw new Error('No data');
      
      const payload = {
        table: table?.name,
        fields: fields.map(f => ({ key: f.key, name: f.name })),
        records: records.map(r => r.data),
      };
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) throw new Error('Webhook failed');
      return response;
    },
    onSuccess: () => {
      toast.success('הנתונים נשלחו ל-Webhook בהצלחה');
      setShowWebhookDialog(false);
    },
    onError: (error: any) => {
      toast.error('שגיאה בשליחה ל-Webhook: ' + error.message);
    },
  });

  const syncFacebookMutation = useMutation({
    mutationFn: async () => {
      if (!table?.id) throw new Error('No table');
      
      // Determine which sync function to use based on integration type
      const syncFunction = table?.integration_type === 'facebook_ecommerce' 
        ? 'sync-facebook-ecommerce' 
        : 'sync-facebook-insights';
      
      const response = await supabase.functions.invoke(syncFunction, {
        method: 'POST',
        body: { table_id: table.id },
      });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', table?.id] });
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      const typeLabel = table?.integration_type === 'facebook_ecommerce' ? 'נתוני מכירות מפייסבוק' : 'נתוני פייסבוק';
      toast.success(`${typeLabel} סונכרנו בהצלחה (${data.records_synced} שורות)`);
    },
    onError: (error: any) => {
      toast.error('שגיאה בסנכרון מפייסבוק: ' + error.message);
    },
  });

  // Google Ads sync mutation
  // Check if this Google Ads table uses Make.com for sync (not Direct API)
  const isGoogleAdsMakeTable = table?.integration_type === 'google_ads' && 
    (table?.integration_settings?.data_source === 'make_api' || table?.integration_settings?.data_source === 'webhook');

  // Fetch Make.com settings for this tenant
  const { data: makeSettings } = useQuery({
    queryKey: ['make-settings', table?.tenant_id],
    queryFn: async () => {
      if (!table?.tenant_id) return null;
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', table.tenant_id)
        .eq('integration_type', 'make_api')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!table?.tenant_id && isGoogleAdsMakeTable,
  });

  // Mutation for automatic Make.com scenario creation and sync
  const syncMakeGoogleAdsMutation = useMutation({
    mutationFn: async () => {
      if (!table?.id) throw new Error('No table');
      
      // Prevent double-cloning
      if (isCloning) {
        throw new Error('שכפול סנריו כבר מתבצע, אנא המתן');
      }
      
      const integrationSettings = table.integration_settings || {};
      const settings = makeSettings?.settings as Record<string, any> || {};
      const makeApiToken = settings.api_token;
      const makeTeamId = settings.team_id;
      const makeRegion = settings.region || 'eu1';
      const templateScenarioId = settings.google_ads_template_scenario_id;
      
      if (!makeApiToken || !makeTeamId) {
        throw new Error('Make.com לא מוגדר. נא להגדיר בהגדרות > Make Settings');
      }
      
      // Check if scenario already exists in table settings
      let scenarioId = integrationSettings.make_scenario_id;
      
      // If scenario is already selected in table settings, use it directly
      if (scenarioId) {
        console.log('Patching dates and running existing Make.com scenario:', scenarioId);
        
        // Find the latest date in existing records to avoid fetching duplicates
        const now = new Date();
        let startDate: string;
        
        if (records && records.length > 0) {
          const dates = records
            .map((r: any) => r.data?.date)
            .filter(Boolean)
            .sort();
          const latestDate = dates[dates.length - 1];
          if (latestDate) {
            // Start from the latest date we have (will upsert, so no true duplicates)
            startDate = latestDate;
            console.log('Starting from latest existing date:', startDate);
          } else {
            // Fallback to 30 days ago
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            startDate = thirtyDaysAgo.toISOString().split('T')[0];
          }
        } else {
          // No records at all - fetch last 30 days
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          startDate = thirtyDaysAgo.toISOString().split('T')[0];
        }
        
        const endDate = now.toISOString().split('T')[0];
        
        const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-google-ads-sync`;
        
        // First patch the blueprint with current dates
        try {
          await supabase.functions.invoke('make-api', {
            body: {
              action: 'patch_scenario_blueprint',
              api_token: makeApiToken,
              team_id: makeTeamId,
              region: makeRegion,
              scenario_id: scenarioId,
              table_id: table.id,
              tenant_id: table.tenant_id,
              webhook_url: webhookUrl,
              customer_id: integrationSettings.google_ads_customer_id,
              campaign_type: integrationSettings.campaign_type || 'leads',
              start_date: startDate,
              end_date: endDate,
            },
          });
          console.log(`Blueprint dates patched: ${startDate} → ${endDate}`);
        } catch (patchErr) {
          console.warn('Failed to patch dates, running scenario anyway:', patchErr);
        }
        
        // Then run the scenario
        const runResponse = await supabase.functions.invoke('make-api', {
          body: {
            action: 'run_scenario',
            api_token: makeApiToken,
            team_id: makeTeamId,
            region: makeRegion,
            scenario_id: scenarioId,
          },
        });
        
        if (runResponse.error) {
          throw new Error(runResponse.error.message || 'Failed to run scenario');
        }
        
        return runResponse.data;
      }
      
      // No scenario selected - check if we can clone from template
      if (!templateScenarioId) {
        throw new Error('לא נבחר סנריו. נא לבחור סנריו בהגדרות הטבלה (כפתור 🔗) או להגדיר Template Scenario ID בהגדרות Make Settings.');
      }
      
      // Lock cloning to prevent double execution
      setIsCloning(true);
      
      const connectionId = integrationSettings.make_connection_id;
      const customerId = integrationSettings.customer_id;
      
      if (!connectionId) {
        throw new Error('חיבור Google Ads לא נבחר. נא לבחור חיבור בהגדרות הטבלה.');
      }
      
      if (!customerId) {
        throw new Error('Customer ID לא הוגדר. נא להגדיר בהגדרות הטבלה.');
      }

      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-google-ads-sync`;
      
      // Clone the template scenario
      console.log('Cloning template scenario for Google Ads sync...');
      const cloneResponse = await supabase.functions.invoke('make-api', {
        body: {
          action: 'clone_scenario',
          api_token: makeApiToken,
          team_id: makeTeamId,
          region: makeRegion,
          template_scenario_id: templateScenarioId,
          table_id: table.id,
          webhook_url: webhookUrl,
          webhook_secret: integrationSettings.webhook_secret,
          scenario_name: `Google Ads Sync - ${table.name}`,
        },
      });
      
      if (cloneResponse.error) {
        throw new Error(cloneResponse.error.message || 'Failed to clone scenario');
      }
      
      const cloneData = cloneResponse.data;
      
      if (!cloneData.success) {
        // Clone failed - show the error
        throw new Error(cloneData.message || cloneData.error || 'לא ניתן לשכפל את ה-Template Scenario');
      }
      
      scenarioId = cloneData.scenario_id;
      
      // Save the scenario ID to the table settings
      await supabase
        .from('crm_tables')
        .update({
          integration_settings: {
            ...integrationSettings,
            make_scenario_id: scenarioId,
          },
        })
        .eq('id', table.id);
      
      // Run the scenario
      console.log('Running Make.com scenario:', scenarioId);
      const runResponse = await supabase.functions.invoke('make-api', {
        body: {
          action: 'run_scenario',
          api_token: makeApiToken,
          team_id: makeTeamId,
          region: makeRegion,
          scenario_id: scenarioId,
        },
      });
      
      if (runResponse.error) {
        throw new Error(runResponse.error.message || 'Failed to run scenario');
      }
      
      return runResponse.data;
    },
    onSuccess: (data) => {
      if (data?.success) {
        toast.success('הסנכרון הופעל! הנתונים יתעדכנו בקרוב.');
        // Refetch records after a delay to allow webhook to process
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['crm-records', table?.id] });
          queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
        }, 5000);
      } else {
        toast.info(data?.message || 'הסנכרון הופעל');
      }
    },
    onError: (error: any) => {
      console.error('Make sync error:', error);
      toast.error(error.message || 'שגיאה בסנכרון דרך Make.com');
      // If automatic sync fails, show the manual setup dialog
      setShowMakeWebhookDialog(true);
    },
    onSettled: () => {
      // Always unlock cloning when mutation completes (success or error)
      setIsCloning(false);
    },
  });

  const syncGoogleAdsMutation = useMutation({
    mutationFn: async () => {
      if (!table?.id) throw new Error('No table');
      
      // If this table uses Make.com, use the Make sync instead
      if (isGoogleAdsMakeTable) {
        // Trigger Make sync mutation directly
        throw new Error('USE_MAKE_SYNC');
      }
      
      const response = await supabase.functions.invoke('sync-google-ads-data', {
        method: 'POST',
        body: { table_id: table.id },
      });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', table?.id] });
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      toast.success(`נתוני Google Ads סונכרנו בהצלחה (${data?.records_synced || 0} שורות)`);
    },
    onError: (error: any) => {
      if (error.message === 'USE_MAKE_SYNC') {
        // This shouldn't happen now, but just in case
        syncMakeGoogleAdsMutation.mutate();
        return;
      }
      toast.error('שגיאה בסנכרון מ-Google Ads: ' + error.message);
    },
  });

  // Google Analytics sync mutation
  const syncGoogleAnalyticsMutation = useMutation({
    mutationFn: async () => {
      if (!table?.id) throw new Error('No table');
      
      // Calculate date range based on selected option
      const endDate = new Date().toISOString().split('T')[0];
      let startDate: string;
      
      switch (selectedSyncDateRange) {
        case 'last_7_days':
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'last_14_days':
          startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'last_30_days':
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'last_90_days':
          startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'last_180_days':
          startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'last_365_days':
          startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'last_730_days':
          startDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'all_history':
          // GA4 supports data from July 2020 onwards, use a safe early date
          startDate = '2020-01-01';
          break;
        default:
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
      
      const response = await supabase.functions.invoke('sync-google-analytics-data', {
        method: 'POST',
        body: { tableId: table.id, startDate, endDate },
      });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', table?.id] });
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      toast.success(`נתוני Google Analytics סונכרנו בהצלחה (${data?.records_synced || 0} שורות)`);
    },
    onError: (error: any) => {
      toast.error('שגיאה בסנכרון מ-Google Analytics: ' + error.message);
    },
  });

  // Google Search Console sync mutation
  const syncGoogleSearchConsoleMutation = useMutation({
    mutationFn: async () => {
      if (!table?.id) throw new Error('No table');
      
      // Calculate date range based on selectedSyncDateRange
      const endDate = new Date().toISOString().split('T')[0];
      let startDate: string;
      
      switch (selectedSyncDateRange) {
        case 'last_7_days':
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'last_14_days':
          startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'last_30_days':
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'last_90_days':
          startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'last_180_days':
          startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'last_365_days':
          startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'last_730_days':
          startDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'all_history':
          // Search Console API limits to ~16 months of data
          startDate = '2020-01-01';
          break;
        default:
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
      
      const response = await supabase.functions.invoke('sync-google-search-console-data', {
        method: 'POST',
        body: { tableId: table.id, startDate, endDate },
      });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', table?.id] });
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      toast.success(`נתוני Search Console סונכרנו בהצלחה (${data?.records_synced || 0} שורות)`);
    },
    onError: (error: any) => {
      toast.error('שגיאה בסנכרון מ-Search Console: ' + error.message);
    },
  });

  // Ahrefs sync mutation (Site Explorer endpoints only - standard plans)
  const syncAhrefsMutation = useMutation({
    mutationFn: async () => {
      if (!table?.id) throw new Error('No table');

      const settings = table.integration_settings || {};

      const mapDataType = (reportType: string): 'site_explorer' | 'backlinks' | 'organic_traffic' | 'referring_domains' => {
        switch (reportType) {
          case 'backlinks':
            return 'backlinks';
          case 'organic_keywords':
          case 'organic_traffic':
            return 'organic_traffic';
          case 'referring_domains':
            return 'referring_domains';
          case 'domain_rating':
          case 'site_explorer':
          default:
            return 'site_explorer';
        }
      };

      const dataType = mapDataType(settings.reportType || 'site_explorer');
      const targetDomain = settings.targetDomain as string | undefined;

      if (!targetDomain) throw new Error('Missing Ahrefs target domain');

      const response = await supabase.functions.invoke('sync-ahrefs-data', {
        method: 'POST',
        body: {
          tableId: table.id,
          config: {
            dataType,
            target: targetDomain,
            country: 'il',
            limit: 1000,
          },
        },
      });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', table?.id] });
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      toast.success(`נתוני Ahrefs סונכרנו בהצלחה (${data?.recordsCount || 0} שורות)`);
    },
    onError: (error: any) => {
      toast.error('שגיאה בסנכרון מ-Ahrefs: ' + (error?.message || 'Unknown error'));
    },
  });

  // Fetch Google Ads accounts for settings dialog
  const { data: googleAdsAccounts, isLoading: googleAccountsLoading } = useQuery({
    queryKey: ['google-ads-accounts'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const response = await supabase.functions.invoke('google-ads-auth?action=get_accounts', {
        method: 'POST',
      });
      if (response.error) throw response.error;
      return Array.isArray(response.data?.accounts) ? response.data.accounts : [];
    },
    enabled: showGoogleSettingsDialog && (table?.integration_type === 'google_ads' || !!table?.secondary_integration_type),
  });

  const updateTableSettingsMutation = useMutation({
    mutationFn: async (adAccountId: string) => {
      if (!table?.id) throw new Error('No table');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      // Find the selected ad account to get its currency
      const selectedAccount = adAccounts?.find((acc: any) => acc.id === adAccountId);
      const currency = selectedAccount?.currency || 'ILS';
      
      const { error } = await supabase
        .from('crm_tables')
        .update({
          integration_settings: {
            ...table.integration_settings,
            ad_account_id: adAccountId,
            ad_account_name: selectedAccount?.name,
            currency: currency,
            date_range: selectedSyncDateRange,
          }
        })
        .eq('id', table.id);
      
      if (error) throw error;
      return { adAccountId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      setShowSettingsDialog(false);
      toast.success('הגדרות הטבלה עודכנו בהצלחה');
    },
    onError: (error: any) => {
      toast.error('שגיאה בעדכון הגדרות: ' + error.message);
    },
  });

  const handleCellChange = (recordId: string, key: string, value: string) => {
    updateCellMutation.mutate({ recordId, key, value });
  };

  const handleStartEdit = (field: CrmField) => {
    setEditingFieldId(field.id);
    setEditingFieldName(field.name);
  };

  const handleSaveFieldName = (fieldId: string) => {
    if (!editingFieldName.trim()) {
      toast.error('שם העמודה לא יכול להיות ריק');
      return;
    }
    updateFieldNameMutation.mutate({ fieldId, name: editingFieldName });
  };

  const handleCancelEdit = () => {
    setEditingFieldId(null);
    setEditingFieldName("");
  };

  const handleCellClick = (recordId: string, fieldKey: string, currentValue: string) => {
    const cellKey = `${recordId}-${fieldKey}`;
    setEditingCell({ recordId, fieldKey, initialValue: currentValue || '' });
    setCellValues(prev => ({ ...prev, [cellKey]: currentValue || '' }));
  };

  const handleCellValueChange = (recordId: string, fieldKey: string, value: string) => {
    const cellKey = `${recordId}-${fieldKey}`;
    setCellValues(prev => ({ ...prev, [cellKey]: value }));
  };

  const handleCellBlur = (recordId: string, fieldKey: string) => {
    const cellKey = `${recordId}-${fieldKey}`;
    const newValue = cellValues[cellKey] || '';
    const record = records?.find(r => r.id === recordId);
    const oldValue = record?.data[fieldKey] || '';
    
    if (oldValue !== newValue) {
      handleCellChange(recordId, fieldKey, newValue);
    }
    setEditingCell(null);
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, recordId: string, fieldKey: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCellBlur(recordId, fieldKey);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      handleCellBlur(recordId, fieldKey);
    }
  };

  useEffect(() => {
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus();
      cellInputRef.current.select();
    }
  }, [editingCell]);

  // Clone scenario mutation for existing tables without make_scenario_id
  // This hook must be before any conditional returns
  const cloneScenarioMutation = useMutation({
    mutationFn: async () => {
      if (!table?.id) throw new Error('No table');
      
      const settings = (makeSettings?.settings as Record<string, any>) || {};
      const templateId = settings.google_ads_template_scenario_id;
      
      if (!templateId) {
        throw new Error('לא הוגדר Template Scenario בהגדרות Make. נא לעבור ל-Make Settings ולבחור סנריו טמפלייט.');
      }
      
      if (!settings.api_token || !settings.team_id) {
        throw new Error('Make.com לא מוגדר. נא להגדיר בהגדרות > Make Settings');
      }

      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-google-ads-sync`;
      const integrationSettings = table?.integration_settings || {};
      
      const { data, error } = await supabase.functions.invoke('make-api', {
        body: {
          action: 'clone_scenario',
          api_token: settings.api_token,
          team_id: settings.team_id,
          region: settings.region || 'eu1',
          template_scenario_id: templateId,
          table_id: table.id,
          webhook_url: webhookUrl,
          scenario_name: `חיבור לגוגל - ${table.name}`,
          customer_id: integrationSettings.customer_id,
          campaign_type: integrationSettings.campaign_type || 'leads',
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || data?.message || 'שכפול נכשל');

      // Update the table with the new scenario_id
      const { error: updateError } = await supabase
        .from('crm_tables')
        .update({
          integration_settings: {
            ...integrationSettings,
            make_scenario_id: data.scenario_id,
          }
        })
        .eq('id', table.id);

      if (updateError) throw updateError;

      return data;
    },
    onSuccess: () => {
      toast.success('הסנריו שוכפל וחובר לטבלה בהצלחה! כעת ניתן לסנכרן נתונים.');
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Activate scenario mutation for scenarios that exist but aren't activated
  const activateScenarioMutation = useMutation({
    mutationFn: async () => {
      const settings = (makeSettings?.settings as Record<string, any>) || {};
      const scenarioId = table?.integration_settings?.make_scenario_id;
      
      if (!scenarioId) {
        throw new Error('לא קיים סנריו לטבלה זו');
      }
      
      if (!settings.api_token || !settings.team_id) {
        throw new Error('Make.com לא מוגדר. נא להגדיר בהגדרות > Make Settings');
      }

      const { data, error } = await supabase.functions.invoke('make-api', {
        body: {
          action: 'activate_scenario',
          api_token: settings.api_token,
          team_id: settings.team_id,
          region: settings.region || 'eu1',
          scenario_id: String(scenarioId),
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || data?.message || 'הפעלת הסנריו נכשלה');

      return data;
    },
    onSuccess: () => {
      toast.success('הסנריו הופעל בהצלחה! כעת ניתן לסנכרן נתונים.');
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Patch scenario blueprint mutation - fixes table_id mismatch in existing scenarios
  const patchScenarioBlueprintMutation = useMutation({
    mutationFn: async () => {
      const settings = (makeSettings?.settings as Record<string, any>) || {};
      const scenarioId = table?.integration_settings?.make_scenario_id;
      
      if (!scenarioId) {
        throw new Error('לא קיים סנריו לטבלה זו');
      }
      
      if (!table?.id) {
        throw new Error('לא נמצאה טבלה');
      }
      
      if (!settings.api_token || !settings.team_id) {
        throw new Error('Make.com לא מוגדר. נא להגדיר בהגדרות > Make Settings');
      }

      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-google-ads-sync`;

      const integrationSettings = (table?.integration_settings as Record<string, any>) || {};
      
      // Calculate date range from latest existing record
      const now = new Date();
      let startDate: string;
      
      if (records && records.length > 0) {
        const dates = records
          .map((r: any) => r.data?.date)
          .filter(Boolean)
          .sort();
        const latestDate = dates[dates.length - 1];
        startDate = latestDate || (() => {
          const d = new Date(now);
          d.setDate(d.getDate() - 30);
          return d.toISOString().split('T')[0];
        })();
      } else {
        const d = new Date(now);
        d.setDate(d.getDate() - 30);
        startDate = d.toISOString().split('T')[0];
      }
      const endDate = now.toISOString().split('T')[0];
      
      const { data, error } = await supabase.functions.invoke('make-api', {
        body: {
          action: 'patch_scenario_blueprint',
          api_token: settings.api_token,
          team_id: settings.team_id,
          region: settings.region || 'eu1',
          scenario_id: String(scenarioId),
          table_id: table.id,
          tenant_id: table.tenant_id,
          webhook_url: webhookUrl,
          customer_id: integrationSettings.google_ads_customer_id,
          campaign_type: integrationSettings.campaign_type || 'leads',
          start_date: startDate,
          end_date: endDate,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || data?.message || 'תיקון הסנריו נכשל');

      return data;
    },
    onSuccess: () => {
      toast.success('הסנריו תוקן! כעת ניתן להריץ סנכרון.');
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (tablesLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!table) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="p-12 text-center">
          <h2 className="text-2xl font-bold mb-2">טבלה לא נמצאה</h2>
          <p className="text-muted-foreground mb-4">הטבלה שחיפשת לא קיימת במערכת</p>
          <Button onClick={() => navigate(buildPath('/dynamic-tables'))}>
            <ArrowRight className="ml-2 h-4 w-4" />
            חזור לטבלאות
          </Button>
        </Card>
      </div>
    );
  }

  const isLoading = fieldsLoading || recordsLoading;
  
  // Determine which integrations are connected
  const hasFacebook = table?.integration_type === 'facebook_insights';
  const hasFacebookEcommerce = table?.integration_type === 'facebook_ecommerce';
  const hasAnyFacebook = hasFacebook || hasFacebookEcommerce;
  const hasGoogleAds = table?.integration_type === 'google_ads';
  const hasGoogleAnalytics = table?.integration_type === 'google_analytics';
  const hasGoogleSearchConsole = table?.integration_type === 'google_search_console';
  const hasAhrefs = table?.integration_type === 'ahrefs';
  const hasMultipleIntegrations = hasFacebook && hasGoogleAds;

  // Check if this Google Ads table needs a scenario to be cloned
  const needsScenarioClone = 
    table?.integration_type === 'google_ads' &&
    table?.integration_settings?.data_source === 'make_api' &&
    !table?.integration_settings?.make_scenario_id;

  // Check if scenario exists but has no data (might need patching or activation)
  // Don't show alert while loading to prevent UI flash when changing filters
  const hasScenarioButNoData = 
    !recordsLoading &&
    table?.integration_type === 'google_ads' &&
    table?.integration_settings?.data_source === 'make_api' &&
    table?.integration_settings?.make_scenario_id &&
    !table?.integration_settings?.last_sync_at &&
    (!records || records.length === 0);
  
  // Check if scenario exists and has synced before (no alert needed)
  const scenarioIsWorking = 
    table?.integration_type === 'google_ads' &&
    table?.integration_settings?.data_source === 'make_api' &&
    table?.integration_settings?.make_scenario_id &&
    (table?.integration_settings?.last_sync_at || (!recordsLoading && records && records.length > 0));

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Alert for tables that need scenario cloning */}
      {needsScenarioClone && (
        <Alert className="mb-6 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800 dark:text-orange-200">
            הטבלה לא מחוברת לסנריו
          </AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
            <span className="text-orange-700 dark:text-orange-300">
              יש לשכפל סנריו מ-Make.com כדי לאפשר סנכרון נתונים. 
              {!(makeSettings?.settings as Record<string, any>)?.google_ads_template_scenario_id && (
                <span className="block text-sm mt-1">
                  ⚠️ תחילה הגדר Template Scenario ב-
                  <a href={buildPath('/make-settings')} className="underline font-medium">Make Settings</a>
                </span>
              )}
            </span>
            <Button 
              onClick={() => cloneScenarioMutation.mutate()}
              disabled={cloneScenarioMutation.isPending || !(makeSettings?.settings as Record<string, any>)?.google_ads_template_scenario_id}
              size="sm"
              variant="outline"
              className="shrink-0"
            >
              {cloneScenarioMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Copy className="h-4 w-4 ml-2" />
              )}
              שכפל סנריו
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Alert for tables with scenario but no data - offer fix options */}
      {hasScenarioButNoData && !activateScenarioMutation.isSuccess && !patchScenarioBlueprintMutation.isSuccess && (
        <Alert className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">
            סנריו קיים אבל אין נתונים בטבלה
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-3 mt-2">
            <span className="text-amber-700 dark:text-amber-300">
              הסנריו נוצר אבל לא הגיעו נתונים. ייתכן שהסנריו מחובר לטבלה אחרת או לא פעיל.
            </span>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => patchScenarioBlueprintMutation.mutate()}
                disabled={patchScenarioBlueprintMutation.isPending}
                size="sm"
                variant="default"
                className="shrink-0"
              >
                {patchScenarioBlueprintMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                ) : (
                  <Link className="h-4 w-4 ml-2" />
                )}
                תקן חיבור לטבלה
              </Button>
              <Button 
                onClick={() => activateScenarioMutation.mutate()}
                disabled={activateScenarioMutation.isPending}
                size="sm"
                variant="outline"
                className="shrink-0"
              >
                {activateScenarioMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                ) : (
                  <Play className="h-4 w-4 ml-2" />
                )}
                הפעל סנריו
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-4 mb-6">
        {/* Title Row */}
        <div className="text-center md:text-right">
          <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold">{table.name}</h1>
            {hasFacebook && (
              <Badge variant="secondary" className="gap-1">
                <Facebook className="h-3 w-3 text-blue-600" />
                Facebook
              </Badge>
            )}
            {hasGoogleAds && (
              <Badge variant="secondary" className="gap-1">
                <GoogleAdsIcon className="h-3 w-3" />
                Google Ads
              </Badge>
            )}
            {hasGoogleAnalytics && (
              <Badge variant="secondary" className="gap-1">
                <BarChart3 className="h-3 w-3 text-orange-500" />
                Google Analytics
              </Badge>
          )}
          {hasGoogleSearchConsole && (
              <Badge variant="secondary" className="gap-1">
                <Search className="h-3 w-3 text-green-600" />
                Search Console
              </Badge>
          )}
          {hasAhrefs && (
            <Badge variant="secondary" className="gap-1">
              <TrendingUp className="h-3 w-3" />
              Ahrefs
            </Badge>
          )}
          {hasGoogleAnalytics && table.integration_settings?.last_sync_at && (
            <p className="text-xs text-muted-foreground">
              Google Analytics עודכן: {new Date(table.integration_settings.last_sync_at).toLocaleString('he-IL')}
            </p>
          )}
        </div>
          {table.description && <p className="text-muted-foreground mt-1">{table.description}</p>}
          {hasFacebook && table.integration_settings?.last_sync_at && (
            <p className="text-xs text-muted-foreground">
              Facebook עודכן: {new Date(table.integration_settings.last_sync_at).toLocaleString('he-IL')}
            </p>
          )}
          {hasGoogleAds && table.integration_settings?.last_sync_at && (
            <p className="text-xs text-muted-foreground">
              Google Ads עודכן: {new Date(table.integration_settings.last_sync_at).toLocaleString('he-IL')}
            </p>
          )}
          {hasAhrefs && table.integration_settings?.last_sync_at && (
            <p className="text-xs text-muted-foreground">
              Ahrefs עודכן: {new Date(table.integration_settings.last_sync_at).toLocaleString('he-IL')}
            </p>
          )}
        </div>
        
        {/* Controls Row */}
        <div className="flex flex-col md:flex-row items-center md:justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(buildPath('/dynamic-tables'))} className="w-full md:w-auto">
            <ArrowRight className="ml-2 h-4 w-4" />
            חזור
          </Button>
        
          {/* Facebook Insights Sync Controls */}
          {hasFacebook && (
            <div className="flex items-center gap-2 w-full md:w-auto justify-center">
              <Button 
                variant="outline" 
                onClick={() => syncFacebookMutation.mutate()}
                disabled={syncFacebookMutation.isPending}
                className="flex-1 md:flex-none gap-2"
              >
                <Facebook className="h-4 w-4 text-blue-600" />
                <RefreshCw className={`h-4 w-4 ${syncFacebookMutation.isPending ? 'animate-spin' : ''}`} />
                {syncFacebookMutation.isPending ? 'מסנכרן Facebook...' : 'סנכרן Facebook'}
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => {
                  setSelectedAdAccount(table.integration_settings?.ad_account_id || '');
                  setSelectedSyncDateRange(table.integration_settings?.date_range || 'last_30_days');
                  setShowSettingsDialog(true);
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setShowAlertsDialog(true)}
                title="הגדרות התראות"
              >
                <Bell className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Facebook Ecommerce Sync Controls */}
          {hasFacebookEcommerce && (
            <div className="flex items-center gap-2 w-full md:w-auto justify-center">
              <Button 
                variant="outline" 
                onClick={() => syncFacebookMutation.mutate()}
                disabled={syncFacebookMutation.isPending}
                className="flex-1 md:flex-none gap-2"
              >
                <ShoppingCart className="h-4 w-4 text-green-600" />
                <RefreshCw className={`h-4 w-4 ${syncFacebookMutation.isPending ? 'animate-spin' : ''}`} />
                {syncFacebookMutation.isPending ? 'מסנכרן מכירות...' : 'סנכרן מכירות'}
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => {
                  setSelectedAdAccount(table.integration_settings?.ad_account_id || '');
                  setSelectedSyncDateRange(table.integration_settings?.date_range || 'last_30_days');
                  setShowSettingsDialog(true);
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {/* Google Ads Sync Controls */}
          {hasGoogleAds && (
            <div className="flex items-center gap-2 w-full md:w-auto justify-center">
              {isGoogleAdsMakeTable ? (
                // For Make.com tables, show automatic sync button
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => syncMakeGoogleAdsMutation.mutate()}
                    disabled={syncMakeGoogleAdsMutation.isPending}
                    className="flex-1 md:flex-none gap-2"
                  >
                    <GoogleAdsIcon className="h-4 w-4" />
                    <RefreshCw className={`h-4 w-4 ${syncMakeGoogleAdsMutation.isPending ? 'animate-spin' : ''}`} />
                    {syncMakeGoogleAdsMutation.isPending ? 'מסנכרן...' : 'סנכרן Google Ads'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setShowMakeWebhookDialog(true)}
                    title="הגדרות Make.com"
                  >
                    <Link className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                // For Direct API tables, show sync button
                <Button 
                  variant="outline" 
                  onClick={() => syncGoogleAdsMutation.mutate()}
                  disabled={syncGoogleAdsMutation.isPending}
                  className="flex-1 md:flex-none gap-2"
                >
                  <GoogleAdsIcon className="h-4 w-4" />
                  <RefreshCw className={`h-4 w-4 ${syncGoogleAdsMutation.isPending ? 'animate-spin' : ''}`} />
                  {syncGoogleAdsMutation.isPending ? 'מסנכרן Google Ads...' : 'סנכרן Google Ads'}
                </Button>
              )}
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => {
                  setSelectedGoogleAccount(table.integration_settings?.customer_id || '');
                  setShowGoogleSettingsDialog(true);
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {/* Google Analytics Sync Controls */}
          {hasGoogleAnalytics && (
            <div className="flex items-center gap-2 w-full md:w-auto justify-center">
              <Select value={selectedSyncDateRange} onValueChange={setSelectedSyncDateRange}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="תקופת סנכרון" />
                </SelectTrigger>
                <SelectContent>
                  {syncDateRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                onClick={() => syncGoogleAnalyticsMutation.mutate()}
                disabled={syncGoogleAnalyticsMutation.isPending}
                className="flex-1 md:flex-none gap-2"
              >
                <BarChart3 className="h-4 w-4 text-orange-500" />
                <RefreshCw className={`h-4 w-4 ${syncGoogleAnalyticsMutation.isPending ? 'animate-spin' : ''}`} />
                {syncGoogleAnalyticsMutation.isPending ? 'מסנכרן Analytics...' : 'סנכרן Analytics'}
              </Button>
            </div>
          )}
          
          {/* Google Search Console Sync Controls */}
          {hasGoogleSearchConsole && (
            <div className="flex items-center gap-2 w-full md:w-auto justify-center flex-wrap">
              <Select value={selectedSyncDateRange} onValueChange={setSelectedSyncDateRange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="בחר תקופה לסנכרון" />
                </SelectTrigger>
                <SelectContent>
                  {syncDateRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                onClick={() => syncGoogleSearchConsoleMutation.mutate()}
                disabled={syncGoogleSearchConsoleMutation.isPending}
                className="flex-1 md:flex-none gap-2"
              >
                <Search className="h-4 w-4 text-green-600" />
                <RefreshCw className={`h-4 w-4 ${syncGoogleSearchConsoleMutation.isPending ? 'animate-spin' : ''}`} />
                {syncGoogleSearchConsoleMutation.isPending ? 'מסנכרן...' : 'סנכרן Search Console'}
              </Button>
            </div>
          )}
          {hasAhrefs && (
            <div className="flex items-center gap-2 w-full md:w-auto justify-center">
              <Button
                variant="outline"
                onClick={() => syncAhrefsMutation.mutate()}
                disabled={syncAhrefsMutation.isPending}
                className="flex-1 md:flex-none gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                <RefreshCw className={`h-4 w-4 ${syncAhrefsMutation.isPending ? 'animate-spin' : ''}`} />
                {syncAhrefsMutation.isPending ? 'מסנכרן Ahrefs...' : 'סנכרן Ahrefs'}
              </Button>
            </div>
          )}
          
          {/* Campaign Search Filter - Only for Facebook/Google Ads tables */}
          {(hasAnyFacebook || hasGoogleAds) && (
            <div className="flex items-center gap-2 w-full md:w-auto justify-center">
              <div className="relative">
                <SearchIcon className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="חפש קמפיין..."
                  value={campaignSearch}
                  onChange={(e) => setCampaignSearch(e.target.value)}
                  className="w-full md:w-[200px] pr-9 h-9"
                />
                {campaignSearch && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setCampaignSearch("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              
              {/* AI Analysis Button */}
              {table && (
                <AIAnalysisDialog 
                  tableId={table.id} 
                  tableName={table.name}
                  campaignFilter={debouncedCampaignSearch || undefined}
                />
              )}
            </div>
          )}
          
          {/* Hide date filter for Analytics and Search Console - they have internal filtering */}
          {!hasGoogleAnalytics && !hasGoogleSearchConsole && (
            <div className="flex items-center gap-2 w-full md:w-auto justify-center">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <Select 
                value={dateFilter} 
                onValueChange={(val) => {
                  if (val === 'custom') {
                    setShowCustomDatePicker(true);
                  } else {
                    setDateFilter(val);
                  }
                }}
              >
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue>
                    {dateFilter === 'custom' && customDateRange.from && customDateRange.to
                      ? `${format(customDateRange.from, 'dd/MM/yy')} - ${format(customDateRange.to, 'dd/MM/yy')}`
                      : dateFilterOptions.find(o => o.value === dateFilter)?.label || 'בחר תאריך'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {dateFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Custom Date Range Picker Dialog */}
          <Dialog open={showCustomDatePicker} onOpenChange={setShowCustomDatePicker}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>בחר טווח תאריכים</DialogTitle>
                <DialogDescription>בחר תאריך התחלה וסיום לסינון הנתונים</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>מתאריך</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !customDateRange.from && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {customDateRange.from ? format(customDateRange.from, "dd/MM/yyyy") : "בחר תאריך"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={customDateRange.from}
                          onSelect={(date) => setCustomDateRange(prev => ({ ...prev, from: date }))}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>עד תאריך</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !customDateRange.to && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {customDateRange.to ? format(customDateRange.to, "dd/MM/yyyy") : "בחר תאריך"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={customDateRange.to}
                          onSelect={(date) => setCustomDateRange(prev => ({ ...prev, to: date }))}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <Button 
                  onClick={() => {
                    if (customDateRange.from && customDateRange.to) {
                      setDateFilter('custom');
                      setShowCustomDatePicker(false);
                    } else {
                      toast.error('יש לבחור תאריך התחלה וסיום');
                    }
                  }}
                  className="w-full"
                  disabled={!customDateRange.from || !customDateRange.to}
                >
                  החל סינון
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>שליחה ל-Webhook</DialogTitle>
                <DialogDescription>הזן כתובת URL לשליחת הנתונים</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://example.com/webhook"
                  />
                </div>
                <Button 
                  onClick={() => sendWebhookMutation.mutate()} 
                  disabled={sendWebhookMutation.isPending || !webhookUrl}
                  className="w-full"
                >
                  {sendWebhookMutation.isPending ? 'שולח...' : 'שלח נתונים'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Settings Dialog for Facebook Insights */}
          <Dialog open={showSettingsDialog} onOpenChange={(open) => {
            setShowSettingsDialog(open);
            if (!open) setAdAccountSearch("");
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>הגדרות טבלה</DialogTitle>
                <DialogDescription>שנה את חשבון המודעות המסונכרן</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>חשבון מודעות</Label>
                  {adAccountsLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <>
                      <Input
                        placeholder="חפש חשבון מודעות..."
                        value={adAccountSearch}
                        onChange={(e) => setAdAccountSearch(e.target.value)}
                        className="mb-2"
                      />
                      <Select 
                        value={selectedAdAccount} 
                        onValueChange={setSelectedAdAccount}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="בחר חשבון מודעות" />
                        </SelectTrigger>
                        <SelectContent>
                          {(Array.isArray(adAccounts) ? adAccounts : [])
                            .filter((account: any) => 
                              account.name?.toLowerCase().includes(adAccountSearch.toLowerCase()) ||
                              account.id?.includes(adAccountSearch)
                            )
                            .map((account: any) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.name} ({account.id})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>
                <div>
                  <Label>טווח סנכרון</Label>
                  <Select 
                    value={selectedSyncDateRange} 
                    onValueChange={setSelectedSyncDateRange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר טווח זמן" />
                    </SelectTrigger>
                    <SelectContent>
                      {syncDateRangeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={() => updateTableSettingsMutation.mutate(selectedAdAccount)}
                  disabled={updateTableSettingsMutation.isPending || !selectedAdAccount}
                  className="w-full"
                >
                  {updateTableSettingsMutation.isPending ? 'שומר...' : 'שמור שינויים'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowWebhookDialog(true)}>
                <Send className="ml-2 h-4 w-4" />
                שלח ל-Webhook
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Active Alerts for Facebook Insights */}
      {hasFacebook && table?.id && records && (
        <ActiveAlerts 
          tableId={table.id} 
          records={records} 
          integrationSettings={table.integration_settings}
        />
      )}

      {/* Alerts Management Dialog */}
      {table?.id && (
        <AlertsManagementDialog
          open={showAlertsDialog}
          onOpenChange={setShowAlertsDialog}
          tableId={table.id}
        />
      )}

      {/* Summary Stats for Facebook Insights */}
      {hasFacebook && filteredRecords && filteredRecords.length > 0 && (
        <Card className="mb-4 overflow-hidden">
          {(() => {
            // Group records by campaign_name
            const campaignGroups = filteredRecords.reduce((acc, record) => {
              const campaignName = String(record.data?.campaign_name || 'ללא קמפיין');
              if (!acc[campaignName]) {
                acc[campaignName] = { impressions: 0, clicks: 0, leads: 0, spend: 0 };
              }
              acc[campaignName].impressions += Number(record.data?.impressions) || 0;
              acc[campaignName].clicks += Number(record.data?.clicks) || 0;
              acc[campaignName].leads += Number(record.data?.leads) || 0;
              acc[campaignName].spend += Number(record.data?.spend) || 0;
              return acc;
            }, {} as Record<string, { impressions: number; clicks: number; leads: number; spend: number }>);

            const totals = Object.values(campaignGroups).reduce((acc, campaign) => ({
              impressions: acc.impressions + campaign.impressions,
              clicks: acc.clicks + campaign.clicks,
              leads: acc.leads + campaign.leads,
              spend: acc.spend + campaign.spend,
            }), { impressions: 0, clicks: 0, leads: 0, spend: 0 });

            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" dir="rtl">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-2 text-right font-medium">קמפיין</th>
                      <th className="p-2 text-center font-medium">חשיפות</th>
                      <th className="p-2 text-center font-medium">קליקים</th>
                      <th className="p-2 text-center font-medium">לידים</th>
                      <th className="p-2 text-center font-medium">הוצאה</th>
                      <th className="p-2 text-center font-medium">עלות לליד</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const currency = table.integration_settings?.currency === 'USD' ? '$' : '₪';
                      return Object.entries(campaignGroups).map(([campaignName, data]) => {
                        const costPerLead = data.leads > 0 ? data.spend / data.leads : 0;
                        return (
                          <tr key={campaignName} className="border-b hover:bg-muted/30">
                            <td className="p-2 text-right font-medium">{campaignName}</td>
                            <td className="p-2 text-center">{data.impressions.toLocaleString('he-IL')}</td>
                            <td className="p-2 text-center">{data.clicks.toLocaleString('he-IL')}</td>
                            <td className="p-2 text-center text-green-600 font-medium">{data.leads.toLocaleString('he-IL')}</td>
                            <td className="p-2 text-center">{currency}{data.spend.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</td>
                            <td className="p-2 text-center text-blue-600 font-medium">{currency}{costPerLead.toLocaleString('he-IL', { maximumFractionDigits: 1 })}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot className="bg-primary/10 font-bold">
                    {(() => {
                      const currency = table.integration_settings?.currency === 'USD' ? '$' : '₪';
                      return (
                        <tr>
                          <td className="p-2 text-right">סה״כ</td>
                          <td className="p-2 text-center">{totals.impressions.toLocaleString('he-IL')}</td>
                          <td className="p-2 text-center">{totals.clicks.toLocaleString('he-IL')}</td>
                          <td className="p-2 text-center text-green-600">{totals.leads.toLocaleString('he-IL')}</td>
                          <td className="p-2 text-center">{currency}{totals.spend.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</td>
                          <td className="p-2 text-center text-blue-600">{currency}{(totals.leads > 0 ? totals.spend / totals.leads : 0).toLocaleString('he-IL', { maximumFractionDigits: 1 })}</td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            );
          })()}
        </Card>
      )}

      {/* Summary Stats for Facebook Ecommerce */}
      {hasFacebookEcommerce && filteredRecords && filteredRecords.length > 0 && (
        <Card className="mb-4 overflow-hidden">
          {(() => {
            // Group records by campaign_name
            const campaignGroups = filteredRecords.reduce((acc, record) => {
              const campaignName = String(record.data?.campaign_name || 'ללא קמפיין');
              if (!acc[campaignName]) {
                acc[campaignName] = { 
                  impressions: 0, 
                  clicks: 0, 
                  spend: 0, 
                  purchases: 0, 
                  purchase_value: 0,
                  add_to_cart: 0,
                };
              }
              acc[campaignName].impressions += Number(record.data?.impressions) || 0;
              acc[campaignName].clicks += Number(record.data?.clicks) || 0;
              acc[campaignName].spend += Number(record.data?.spend) || 0;
              acc[campaignName].purchases += Number(record.data?.purchases) || 0;
              acc[campaignName].purchase_value += Number(record.data?.purchase_value) || 0;
              acc[campaignName].add_to_cart += Number(record.data?.add_to_cart) || 0;
              return acc;
            }, {} as Record<string, { impressions: number; clicks: number; spend: number; purchases: number; purchase_value: number; add_to_cart: number }>);

            const totals = Object.values(campaignGroups).reduce((acc, campaign) => ({
              impressions: acc.impressions + campaign.impressions,
              clicks: acc.clicks + campaign.clicks,
              spend: acc.spend + campaign.spend,
              purchases: acc.purchases + campaign.purchases,
              purchase_value: acc.purchase_value + campaign.purchase_value,
              add_to_cart: acc.add_to_cart + campaign.add_to_cart,
            }), { impressions: 0, clicks: 0, spend: 0, purchases: 0, purchase_value: 0, add_to_cart: 0 });

            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" dir="rtl">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-2 text-right font-medium">קמפיין</th>
                      <th className="p-2 text-center font-medium">חשיפות</th>
                      <th className="p-2 text-center font-medium">קליקים</th>
                      <th className="p-2 text-center font-medium">הוצאה</th>
                      <th className="p-2 text-center font-medium">הוספות לעגלה</th>
                      <th className="p-2 text-center font-medium">רכישות</th>
                      <th className="p-2 text-center font-medium">ערך רכישות</th>
                      <th className="p-2 text-center font-medium">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const currency = table.integration_settings?.currency === 'USD' ? '$' : '₪';
                      return Object.entries(campaignGroups).map(([campaignName, data]) => {
                        const roas = data.spend > 0 ? data.purchase_value / data.spend : 0;
                        return (
                          <tr key={campaignName} className="border-b hover:bg-muted/30">
                            <td className="p-2 text-right font-medium">{campaignName}</td>
                            <td className="p-2 text-center">{data.impressions.toLocaleString('he-IL')}</td>
                            <td className="p-2 text-center">{data.clicks.toLocaleString('he-IL')}</td>
                            <td className="p-2 text-center">{currency}{data.spend.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</td>
                            <td className="p-2 text-center text-orange-600">{data.add_to_cart.toLocaleString('he-IL')}</td>
                            <td className="p-2 text-center text-green-600 font-medium">{data.purchases.toLocaleString('he-IL')}</td>
                            <td className="p-2 text-center text-green-600">{currency}{data.purchase_value.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</td>
                            <td className="p-2 text-center text-blue-600 font-medium">{roas.toLocaleString('he-IL', { maximumFractionDigits: 2 })}x</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot className="bg-primary/10 font-bold">
                    {(() => {
                      const currency = table.integration_settings?.currency === 'USD' ? '$' : '₪';
                      const totalRoas = totals.spend > 0 ? totals.purchase_value / totals.spend : 0;
                      return (
                        <tr>
                          <td className="p-2 text-right">סה״כ</td>
                          <td className="p-2 text-center">{totals.impressions.toLocaleString('he-IL')}</td>
                          <td className="p-2 text-center">{totals.clicks.toLocaleString('he-IL')}</td>
                          <td className="p-2 text-center">{currency}{totals.spend.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</td>
                          <td className="p-2 text-center text-orange-600">{totals.add_to_cart.toLocaleString('he-IL')}</td>
                          <td className="p-2 text-center text-green-600">{totals.purchases.toLocaleString('he-IL')}</td>
                          <td className="p-2 text-center text-green-600">{currency}{totals.purchase_value.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</td>
                          <td className="p-2 text-center text-blue-600">{totalRoas.toLocaleString('he-IL', { maximumFractionDigits: 2 })}x</td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            );
          })()}
        </Card>
      )}


      {/* Summary Stats for Google Ads */}
      {hasGoogleAds && filteredRecords && filteredRecords.length > 0 && (
        <Card className="mb-4 overflow-hidden">
          {(() => {
            const isEcommerce = table?.integration_settings?.campaign_type === 'ecommerce';
            
            const campaignGroups = filteredRecords.reduce((acc, record) => {
              const campaignName = String(record.data?.campaign_name || 'ללא קמפיין');
              if (!acc[campaignName]) {
                acc[campaignName] = { 
                  impressions: 0, 
                  clicks: 0, 
                  conversions: 0, 
                  cost: 0,
                  conversions_value: 0,
                  all_conversions: 0,
                  all_conversions_value: 0,
                  roas_sum: 0,
                  roas_count: 0
                };
              }
              acc[campaignName].impressions += Number(record.data?.impressions) || 0;
              acc[campaignName].clicks += Number(record.data?.clicks) || 0;
              // Support both standard Google Ads fields and Make.com ecommerce fields
              acc[campaignName].conversions += Number(record.data?.conversions) || Number(record.data?.purchases) || 0;
              acc[campaignName].cost += Number(record.data?.cost) || 0;
              // Support both conversions_value and purchase_value (from Make.com)
              acc[campaignName].conversions_value += Number(record.data?.conversions_value) || Number(record.data?.purchase_value) || 0;
              acc[campaignName].all_conversions += Number(record.data?.all_conversions) || 0;
              acc[campaignName].all_conversions_value += Number(record.data?.all_conversions_value) || 0;
              // Track ROAS if it's pre-calculated in the data
              if (record.data?.roas) {
                acc[campaignName].roas_sum += Number(record.data.roas) || 0;
                acc[campaignName].roas_count += 1;
              }
              return acc;
            }, {} as Record<string, { impressions: number; clicks: number; conversions: number; cost: number; conversions_value: number; all_conversions: number; all_conversions_value: number; roas_sum: number; roas_count: number }>);

            const totals = Object.values(campaignGroups).reduce((acc, campaign) => ({
              impressions: acc.impressions + campaign.impressions,
              clicks: acc.clicks + campaign.clicks,
              conversions: acc.conversions + campaign.conversions,
              cost: acc.cost + campaign.cost,
              conversions_value: acc.conversions_value + campaign.conversions_value,
              all_conversions: acc.all_conversions + campaign.all_conversions,
              all_conversions_value: acc.all_conversions_value + campaign.all_conversions_value,
              roas_sum: acc.roas_sum + campaign.roas_sum,
              roas_count: acc.roas_count + campaign.roas_count,
            }), { impressions: 0, clicks: 0, conversions: 0, cost: 0, conversions_value: 0, all_conversions: 0, all_conversions_value: 0, roas_sum: 0, roas_count: 0 });
            
            // Calculate total ROAS - always use total conversions value / total cost
            const totalRoas = totals.cost > 0 ? totals.conversions_value / totals.cost : 0;

            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" dir="rtl">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-2 text-right font-medium">קמפיין</th>
                      <th className="p-2 text-center font-medium">חשיפות</th>
                      <th className="p-2 text-center font-medium">קליקים</th>
                      <th className="p-2 text-center font-medium">המרות</th>
                      <th className="p-2 text-center font-medium">עלות</th>
                      {isEcommerce ? (
                        <>
                          <th className="p-2 text-center font-medium">ערך המרות</th>
                          <th className="p-2 text-center font-medium">ROAS</th>
                        </>
                      ) : (
                        <th className="p-2 text-center font-medium">עלות להמרה</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(campaignGroups).map(([campaignName, data]) => {
                      const costPerConversion = data.conversions > 0 ? data.cost / data.conversions : 0;
                      // Calculate ROAS as conversions value / cost
                      const roas = data.cost > 0 ? data.conversions_value / data.cost : 0;
                      return (
                        <tr key={campaignName} className="border-b hover:bg-muted/30">
                          <td className="p-2 text-right font-medium">{campaignName}</td>
                          <td className="p-2 text-center">{data.impressions.toLocaleString('he-IL')}</td>
                          <td className="p-2 text-center">{data.clicks.toLocaleString('he-IL')}</td>
                          <td className="p-2 text-center text-green-600 font-medium">{data.conversions.toLocaleString('he-IL', { maximumFractionDigits: 1 })}</td>
                          <td className="p-2 text-center">₪{data.cost.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</td>
                          {isEcommerce ? (
                            <>
                              <td className="p-2 text-center text-purple-600 font-medium">₪{data.conversions_value.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</td>
                              <td className="p-2 text-center text-blue-600 font-medium">{roas.toLocaleString('he-IL', { maximumFractionDigits: 2 })}x</td>
                            </>
                          ) : (
                            <td className="p-2 text-center text-blue-600 font-medium">₪{costPerConversion.toLocaleString('he-IL', { maximumFractionDigits: 1 })}</td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-primary/10 font-bold">
                    <tr>
                      <td className="p-2 text-right">סה״כ</td>
                      <td className="p-2 text-center">{totals.impressions.toLocaleString('he-IL')}</td>
                      <td className="p-2 text-center">{totals.clicks.toLocaleString('he-IL')}</td>
                      <td className="p-2 text-center text-green-600">{totals.conversions.toLocaleString('he-IL', { maximumFractionDigits: 1 })}</td>
                      <td className="p-2 text-center">₪{totals.cost.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</td>
                      {isEcommerce ? (
                        <>
                          <td className="p-2 text-center text-purple-600">₪{totals.conversions_value.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</td>
                          <td className="p-2 text-center text-blue-600">{totalRoas.toLocaleString('he-IL', { maximumFractionDigits: 2 })}x</td>
                        </>
                      ) : (
                        <td className="p-2 text-center text-blue-600">₪{(totals.conversions > 0 ? totals.cost / totals.conversions : 0).toLocaleString('he-IL', { maximumFractionDigits: 1 })}</td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })()}
        </Card>
      )}

      {/* Google Analytics Dashboard */}
      {hasGoogleAnalytics && filteredRecords && filteredRecords.length > 0 && (
        <GoogleAnalyticsDashboard records={filteredRecords} />
      )}

      {/* Google Search Console Dashboard */}
      {hasGoogleSearchConsole && table?.id && (
        <SearchConsoleDashboard tableId={table.id} />
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="border rounded-lg overflow-hidden bg-background shadow-sm">
          <div className="overflow-auto">
            <div className="min-w-full inline-block">
              {/* Header */}
              <div className="flex border-b bg-muted/30 sticky top-0 z-10">
                <div className="w-12 flex-shrink-0 border-l p-2 flex items-center justify-center">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => addRowMutation.mutate()}
                    disabled={addRowMutation.isPending}
                    className="h-6 w-6 p-0"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                {fields?.map((field) => (
                  <div key={field.id} className="w-[150px] flex-shrink-0 border-l p-2">
                    {editingFieldId === field.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editingFieldName}
                          onChange={(e) => setEditingFieldName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveFieldName(field.id);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          autoFocus
                          className="h-7 text-sm font-medium"
                        />
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleSaveFieldName(field.id)}
                          disabled={updateFieldNameMutation.isPending}
                          className="h-6 w-6 p-0"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={handleCancelEdit}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 group">
                        <span 
                          className="text-sm font-medium cursor-pointer hover:text-primary transition-colors truncate text-blue-600 dark:text-blue-400" 
                          onClick={() => handleStartEdit(field)}
                        >
                          {field.name}
                        </span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleStartEdit(field)}
                            className="h-6 w-6 p-0"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => deleteColumnMutation.mutate(field.id)}
                            className="h-6 w-6 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div className="w-[150px] flex-shrink-0 border-l p-2">
                  <div className="flex items-center gap-1">
                    <Input
                      placeholder="עמודה חדשה"
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newColumnName.trim()) {
                          addColumnMutation.mutate(newColumnName);
                        }
                      }}
                      className="h-7 text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => newColumnName.trim() && addColumnMutation.mutate(newColumnName)}
                      disabled={!newColumnName.trim() || addColumnMutation.isPending}
                      className="h-6 w-6 p-0 flex-shrink-0"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Rows */}
              {filteredRecords?.map((record) => (
                <div key={record.id} className="flex border-b hover:bg-muted/20 transition-colors group">
                  <div className="w-12 flex-shrink-0 border-l p-2 flex items-center justify-center bg-muted/10">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => deleteRowMutation.mutate(record.id)}
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {fields?.map((field) => {
                    const cellKey = `${record.id}-${field.key}`;
                    const isEditing = editingCell?.recordId === record.id && editingCell?.fieldKey === field.key;
                    const rawValue = record.data[field.key];
                    const editValue = isEditing ? (cellValues[cellKey] ?? '') : '';
                    
                    // Format display value
                    const formatDisplayValue = (value: any, fieldType: string, fieldKey: string): string => {
                      if (value === null || value === undefined || value === '') return '';
                      
                      // Format date fields
                      if (fieldType === 'date' || fieldKey === 'date') {
                        try {
                          const date = new Date(value);
                          if (!isNaN(date.getTime())) {
                            return date.toLocaleDateString('he-IL', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            });
                          }
                        } catch {
                          return String(value);
                        }
                      }
                      
                      // Check if it's a number (either by field type or by actual type)
                      if (fieldType === 'number' || typeof value === 'number') {
                        const num = typeof value === 'number' ? value : parseFloat(value);
                        if (!isNaN(num)) {
                          // Check if it has decimals
                          if (num % 1 !== 0) {
                            // Format with max 1 decimal place and thousands separator
                            return num.toLocaleString('he-IL', { 
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 1 
                            });
                          } else {
                            // Integer - just add thousands separator
                            return num.toLocaleString('he-IL');
                          }
                        }
                      }
                      
                      return String(value);
                    };
                    
                    const displayValue = isEditing ? editValue : formatDisplayValue(rawValue, field.type, field.key);
                    
                    return (
                      <div 
                        key={field.id} 
                        className="w-[150px] flex-shrink-0 border-l p-0 cursor-text"
                        onClick={() => !isEditing && handleCellClick(record.id, field.key, String(rawValue ?? ''))}
                      >
                        {isEditing ? (
                          <Input
                            ref={cellInputRef}
                            value={displayValue}
                            onChange={(e) => handleCellValueChange(record.id, field.key, e.target.value)}
                            onBlur={() => handleCellBlur(record.id, field.key)}
                            onKeyDown={(e) => handleCellKeyDown(e, record.id, field.key)}
                            className="border-none rounded-none h-10 focus-visible:ring-1 focus-visible:ring-primary bg-background"
                          />
                        ) : (
                          <div className="p-2 h-10 flex items-center text-sm hover:bg-accent/50 transition-colors rounded-sm">
                            {displayValue || <span className="text-muted-foreground">ריק</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="w-[150px] flex-shrink-0 border-l" />
                </div>
              ))}

              {/* Empty state */}
              {(!filteredRecords || filteredRecords.length === 0) && (
                <div className="flex items-center justify-center p-12 text-center">
                  <div>
                    <p className="text-muted-foreground mb-3">{campaignSearch ? 'לא נמצאו קמפיינים תואמים' : 'אין שורות בטבלה'}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addRowMutation.mutate()}
                      disabled={addRowMutation.isPending}
                    >
                      <Plus className="ml-2 h-4 w-4" />
                      הוסף שורה ראשונה
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Make.com Automatic Sync Dialog for Google Ads */}
      <Dialog open={showMakeWebhookDialog} onOpenChange={setShowMakeWebhookDialog}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GoogleAdsIcon className="h-5 w-5" />
              סנכרון Google Ads דרך Make.com
            </DialogTitle>
            <DialogDescription>
              הגדר את ה-Scenario ID להרצה ישירה מהטבלה
            </DialogDescription>
          </DialogHeader>
          
          <MakeScenarioSettings 
            table={table}
            onSync={() => {
              setShowMakeWebhookDialog(false);
              syncMakeGoogleAdsMutation.mutate();
            }}
            isSyncing={syncMakeGoogleAdsMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

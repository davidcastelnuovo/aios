import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Plus, Trash2, Send, Pencil, Check, X, MoreVertical, Calendar, RefreshCw, Facebook, Settings } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface CrmTable {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  integration_type: string | null;
  integration_settings: any;
}

interface CrmField {
  id: string;
  key: string;
  name: string;
  type: string;
  position: number;
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
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingFieldName, setEditingFieldName] = useState("");
  const [editingCell, setEditingCell] = useState<{ recordId: string; fieldKey: string; initialValue: string } | null>(null);
  const [cellValues, setCellValues] = useState<Record<string, string>>({});
  const [dateFilter, setDateFilter] = useState<string>("all");
  const cellInputRef = useRef<HTMLInputElement>(null);

  const dateFilterOptions = [
    { value: "all", label: "כל התאריכים" },
    { value: "today", label: "היום" },
    { value: "yesterday", label: "אתמול" },
    { value: "this_week", label: "השבוע" },
    { value: "last_7_days", label: "7 ימים אחרונים" },
    { value: "last_14_days", label: "14 יום" },
    { value: "last_30_days", label: "30 יום" },
    { value: "this_month", label: "החודש" },
  ];

  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ['crm-tables'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const response = await supabase.functions.invoke('crm-tables', { method: 'GET' });
      if (response.error) throw response.error;
      return response.data as CrmTable[];
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
      return response.data?.ad_accounts || [];
    },
    enabled: showSettingsDialog && table?.integration_type === 'facebook_insights',
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
    queryKey: ['crm-records', table?.id, dateFilter],
    queryFn: async () => {
      if (!table?.id) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const params = new URLSearchParams({ table_id: table.id });
      if (dateFilter !== 'all') {
        params.append('date_filter', dateFilter);
      }
      const response = await supabase.functions.invoke(`crm-records?${params.toString()}`, {
        method: 'GET',
      });
      if (response.error) throw response.error;
      return response.data as CrmRecord[];
    },
    enabled: !!table?.id,
  });

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
      const response = await supabase.functions.invoke('sync-facebook-insights', {
        method: 'POST',
        body: { table_id: table.id },
      });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', table?.id] });
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      toast.success(`נתוני פייסבוק סונכרנו בהצלחה (${data.records_synced} שורות)`);
    },
    onError: (error: any) => {
      toast.error('שגיאה בסנכרון מפייסבוק: ' + error.message);
    },
  });

  const updateTableSettingsMutation = useMutation({
    mutationFn: async (adAccountId: string) => {
      if (!table?.id) throw new Error('No table');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('crm_tables')
        .update({
          integration_settings: {
            ...table.integration_settings,
            ad_account_id: adAccountId,
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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(buildPath('/dynamic-tables'))}>
            <ArrowRight className="ml-2 h-4 w-4" />
            חזור
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{table.name}</h1>
              {table.integration_type === 'facebook_insights' && (
                <Badge variant="secondary" className="gap-1">
                  <Facebook className="h-3 w-3 text-blue-600" />
                  Facebook
                </Badge>
              )}
            </div>
            {table.description && <p className="text-muted-foreground mt-1">{table.description}</p>}
            {table.integration_type === 'facebook_insights' && table.integration_settings?.last_sync_at && (
              <p className="text-xs text-muted-foreground">
                עודכן לאחרונה: {new Date(table.integration_settings.last_sync_at).toLocaleString('he-IL')}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {table.integration_type === 'facebook_insights' && (
            <>
              <Button 
                variant="outline" 
                onClick={() => syncFacebookMutation.mutate()}
                disabled={syncFacebookMutation.isPending}
              >
                <RefreshCw className={`ml-2 h-4 w-4 ${syncFacebookMutation.isPending ? 'animate-spin' : ''}`} />
                {syncFacebookMutation.isPending ? 'מסנכרן...' : 'סנכרן עכשיו'}
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => {
                  setSelectedAdAccount(table.integration_settings?.ad_account_id || '');
                  setShowSettingsDialog(true);
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </>
          )}
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="סנן לפי תאריך" />
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
          <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
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
                    <Select 
                      value={selectedAdAccount} 
                      onValueChange={setSelectedAdAccount}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="בחר חשבון מודעות" />
                      </SelectTrigger>
                      <SelectContent>
                        {adAccounts?.map((account: any) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name} ({account.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
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

      {/* Summary Stats for Facebook Insights */}
      {table.integration_type === 'facebook_insights' && records && records.length > 0 && (
        <Card className="mb-4 p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            {(() => {
              const totals = records.reduce((acc, record) => ({
                impressions: acc.impressions + (Number(record.data?.impressions) || 0),
                clicks: acc.clicks + (Number(record.data?.clicks) || 0),
                leads: acc.leads + (Number(record.data?.leads) || 0),
                spend: acc.spend + (Number(record.data?.spend) || 0),
              }), { impressions: 0, clicks: 0, leads: 0, spend: 0 });
              
              const avgCostPerLead = totals.leads > 0 ? totals.spend / totals.leads : 0;
              
              return (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">חשיפות</p>
                    <p className="text-lg font-bold">{totals.impressions.toLocaleString('he-IL')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">קליקים</p>
                    <p className="text-lg font-bold">{totals.clicks.toLocaleString('he-IL')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">לידים</p>
                    <p className="text-lg font-bold text-green-600">{totals.leads.toLocaleString('he-IL')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">הוצאה</p>
                    <p className="text-lg font-bold">₪{totals.spend.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">עלות לליד</p>
                    <p className="text-lg font-bold text-blue-600">₪{avgCostPerLead.toLocaleString('he-IL', { maximumFractionDigits: 1 })}</p>
                  </div>
                </>
              );
            })()}
          </div>
        </Card>
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
                  <div key={field.id} className="min-w-[180px] flex-shrink-0 border-l p-2">
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
                <div className="min-w-[180px] flex-shrink-0 border-l p-2">
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
              {records?.map((record) => (
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
                        className="min-w-[180px] flex-shrink-0 border-l p-0 cursor-text"
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
                  <div className="min-w-[180px] flex-shrink-0 border-l" />
                </div>
              ))}

              {/* Empty state */}
              {(!records || records.length === 0) && (
                <div className="flex items-center justify-center p-12 text-center">
                  <div>
                    <p className="text-muted-foreground mb-3">אין שורות בטבלה</p>
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
    </div>
  );
}

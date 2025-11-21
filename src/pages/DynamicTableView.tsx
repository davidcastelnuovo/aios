import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Plus, Trash2, Send, Pencil, Check, X, MoreVertical } from "lucide-react";
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

interface CrmTable {
  id: string;
  name: string;
  slug: string;
  description: string | null;
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
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingFieldName, setEditingFieldName] = useState("");
  const [editingCell, setEditingCell] = useState<{ recordId: string; fieldKey: string; initialValue: string } | null>(null);
  const [cellValues, setCellValues] = useState<Record<string, string>>({});
  const cellInputRef = useRef<HTMLInputElement>(null);

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
    queryKey: ['crm-records', table?.id],
    queryFn: async () => {
      if (!table?.id) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const response = await supabase.functions.invoke(`crm-records?table_id=${table.id}`, {
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
            <h1 className="text-3xl font-bold">{table.name}</h1>
            {table.description && <p className="text-muted-foreground mt-1">{table.description}</p>}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
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
                    const displayValue = isEditing 
                      ? (cellValues[cellKey] ?? '') 
                      : (record.data[field.key] || '');
                    
                    return (
                      <div 
                        key={field.id} 
                        className="min-w-[180px] flex-shrink-0 border-l p-0 cursor-text"
                        onClick={() => !isEditing && handleCellClick(record.id, field.key, record.data[field.key] || '')}
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

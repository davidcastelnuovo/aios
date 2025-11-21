import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Plus, Trash2, Send, Pencil, Check, X } from "lucide-react";
import { useTenantPath } from "@/hooks/useTenantPath";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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
      return (response.data as CrmField[]).sort((a, b) => a.position - b.position);
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
      const response = await supabase.functions.invoke('crm-fields', {
        method: 'PATCH',
        body: { field_id: fieldId, name },
      });
      if (response.error) throw response.error;
      return response.data;
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
      const response = await supabase.functions.invoke('crm-fields', {
        method: 'DELETE',
        body: { field_id: fieldId },
      });
      if (response.error) throw response.error;
      return response.data;
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
      const response = await supabase.functions.invoke('crm-records', {
        method: 'DELETE',
        body: { record_id: recordId },
      });
      if (response.error) throw response.error;
      return response.data;
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
      
      const response = await supabase.functions.invoke('crm-records', {
        method: 'PATCH',
        body: {
          record_id: recordId,
          data: updatedData,
        },
      });
      if (response.error) throw response.error;
      return response.data;
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
        <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Send className="ml-2 h-4 w-4" />
              שלח ל-Webhook
            </Button>
          </DialogTrigger>
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
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card className="p-6">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  {fields?.map((field) => (
                    <TableHead key={field.id} className="min-w-[200px]">
                      {editingFieldId === field.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingFieldName}
                            onChange={(e) => setEditingFieldName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveFieldName(field.id);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            autoFocus
                            className="h-8"
                          />
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleSaveFieldName(field.id)}
                            disabled={updateFieldNameMutation.isPending}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={handleCancelEdit}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <span 
                            className="cursor-pointer hover:text-primary transition-colors" 
                            onClick={() => handleStartEdit(field)}
                          >
                            {field.name}
                          </span>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleStartEdit(field)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => deleteColumnMutation.mutate(field.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </TableHead>
                  ))}
                  <TableHead className="w-[150px]">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="עמודה חדשה"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && newColumnName.trim()) {
                            addColumnMutation.mutate(newColumnName);
                          }
                        }}
                        className="h-8"
                      />
                      <Button
                        size="sm"
                        onClick={() => newColumnName.trim() && addColumnMutation.mutate(newColumnName)}
                        disabled={!newColumnName.trim() || addColumnMutation.isPending}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records?.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => deleteRowMutation.mutate(record.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                    {fields?.map((field) => (
                      <TableCell key={field.id}>
                        <Input
                          value={record.data[field.key] || ''}
                          onChange={(e) => handleCellChange(record.id, field.key, e.target.value)}
                          className="border-0 focus-visible:ring-1"
                        />
                      </TableCell>
                    ))}
                    <TableCell></TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={(fields?.length || 0) + 2}>
                    <Button
                      variant="outline"
                      onClick={() => addRowMutation.mutate()}
                      disabled={addRowMutation.isPending}
                      className="w-full"
                    >
                      <Plus className="ml-2 h-4 w-4" />
                      הוסף שורה
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CustomField {
  id: string;
  entity_type: 'task' | 'client' | 'lead';
  field_key: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  is_visible: boolean;
  options: any;
  sort_order: number;
}

const FIELD_TYPES = [
  { value: 'text', label: 'טקסט' },
  { value: 'number', label: 'מספר' },
  { value: 'date', label: 'תאריך' },
  { value: 'select', label: 'בחירה מרשימה' },
  { value: 'textarea', label: 'טקסט ארוך' },
  { value: 'checkbox', label: 'תיבת סימון' },
  { value: 'email', label: 'אימייל' },
  { value: 'phone', label: 'טלפון' },
];

export default function FieldsManagement() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [selectedEntity, setSelectedEntity] = useState<'task' | 'client' | 'lead'>('task');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newField, setNewField] = useState({
    field_key: '',
    field_label: '',
    field_type: 'text',
    is_required: false,
    is_visible: true,
  });

  const { data: fields, isLoading } = useQuery({
    queryKey: ['custom-fields', tenantId, selectedEntity],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('entity_type', selectedEntity)
        .order('sort_order');

      if (error) throw error;
      return data as CustomField[];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async (field: Omit<CustomField, 'id' | 'sort_order' | 'options'>) => {
      const { data, error } = await supabase
        .from('custom_fields')
        .insert({
          ...field,
          tenant_id: tenantId,
          sort_order: (fields?.length || 0) + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      toast.success('שדה נוסף בהצלחה');
      setIsAddDialogOpen(false);
      setNewField({
        field_key: '',
        field_label: '',
        field_type: 'text',
        is_required: false,
        is_visible: true,
      });
    },
    onError: (error: Error) => {
      toast.error('שגיאה בהוספת שדה: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (field: Partial<CustomField> & { id: string }) => {
      const { data, error } = await supabase
        .from('custom_fields')
        .update(field)
        .eq('id', field.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      toast.success('שדה עודכן בהצלחה');
    },
    onError: (error: Error) => {
      toast.error('שגיאה בעדכון שדה: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_fields')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      toast.success('שדה נמחק בהצלחה');
    },
    onError: (error: Error) => {
      toast.error('שגיאה במחיקת שדה: ' + error.message);
    },
  });

  const handleAddField = () => {
    if (!newField.field_key || !newField.field_label) {
      toast.error('יש למלא את כל השדות הנדרשים');
      return;
    }

    createMutation.mutate({
      entity_type: selectedEntity,
      ...newField,
    });
  };

  const getEntityLabel = (entityType: string) => {
    switch (entityType) {
      case 'task':
        return 'משימות';
      case 'client':
        return 'לקוחות';
      case 'lead':
        return 'לידים';
      default:
        return '';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>טוען...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ניהול שדות</h1>
          <p className="text-muted-foreground mt-2">
            התאם אישית את השדות עבור משימות, לקוחות ולידים
          </p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              הוסף שדה
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>הוסף שדה חדש ל{getEntityLabel(selectedEntity)}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="field_key">מזהה שדה (באנגלית) *</Label>
                <Input
                  id="field_key"
                  value={newField.field_key}
                  onChange={(e) => setNewField({ ...newField, field_key: e.target.value })}
                  placeholder="custom_field_1"
                />
              </div>

              <div>
                <Label htmlFor="field_label">תווית שדה *</Label>
                <Input
                  id="field_label"
                  value={newField.field_label}
                  onChange={(e) => setNewField({ ...newField, field_label: e.target.value })}
                  placeholder="שדה מותאם אישית"
                />
              </div>

              <div>
                <Label htmlFor="field_type">סוג שדה</Label>
                <Select
                  value={newField.field_type}
                  onValueChange={(value) => setNewField({ ...newField, field_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_required"
                    checked={newField.is_required}
                    onCheckedChange={(checked) => setNewField({ ...newField, is_required: checked })}
                  />
                  <Label htmlFor="is_required">חובה</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="is_visible"
                    checked={newField.is_visible}
                    onCheckedChange={(checked) => setNewField({ ...newField, is_visible: checked })}
                  />
                  <Label htmlFor="is_visible">נראה</Label>
                </div>
              </div>

              <Button onClick={handleAddField} className="w-full" disabled={createMutation.isPending}>
                <Save className="h-4 w-4 ml-2" />
                שמור שדה
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={selectedEntity} onValueChange={(value) => setSelectedEntity(value as any)}>
        <TabsList>
          <TabsTrigger value="task">משימות</TabsTrigger>
          <TabsTrigger value="client">לקוחות</TabsTrigger>
          <TabsTrigger value="lead">לידים</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedEntity} className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>שדות {getEntityLabel(selectedEntity)}</CardTitle>
            </CardHeader>
            <CardContent>
              {!fields || fields.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  לא הוגדרו שדות מותאמים אישית עבור {getEntityLabel(selectedEntity)}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>תווית</TableHead>
                      <TableHead>מזהה</TableHead>
                      <TableHead>סוג</TableHead>
                      <TableHead>חובה</TableHead>
                      <TableHead>נראה</TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field) => (
                      <TableRow key={field.id}>
                        <TableCell className="font-medium">{field.field_label}</TableCell>
                        <TableCell className="text-muted-foreground">{field.field_key}</TableCell>
                        <TableCell>
                          {FIELD_TYPES.find((t) => t.value === field.field_type)?.label}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={field.is_required}
                            onCheckedChange={(checked) =>
                              updateMutation.mutate({ id: field.id, is_required: checked })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={field.is_visible}
                            onCheckedChange={(checked) =>
                              updateMutation.mutate({ id: field.id, is_visible: checked })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteMutation.mutate(field.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
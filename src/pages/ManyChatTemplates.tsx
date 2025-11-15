import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Trash2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Template {
  id: string;
  template_name: string;
  template_namespace: string;
  template_language: string;
  display_name: string;
  description: string | null;
  template_variables: any[];
  is_active: boolean;
}

export default function ManyChatTemplates() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  
  const [formData, setFormData] = useState({
    template_name: "",
    template_namespace: "",
    template_language: "he",
    display_name: "",
    description: "",
    template_variables: "[]",
  });

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['manychat-templates', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('manychat_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Template[];
    },
    enabled: !!tenantId,
  });

  // Add template mutation
  const addTemplateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!tenantId) throw new Error('No tenant selected');
      
      const { error } = await supabase
        .from('manychat_templates')
        .insert({
          ...data,
          tenant_id: tenantId,
          template_variables: JSON.parse(data.template_variables),
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manychat-templates'] });
      toast.success('טמפלייט נוסף בהצלחה');
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error('שגיאה בהוספת טמפלייט: ' + error.message);
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const updateData: any = { ...data };
      if (data.template_variables) {
        updateData.template_variables = JSON.parse(data.template_variables);
      }
      
      const { error } = await supabase
        .from('manychat_templates')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manychat-templates'] });
      toast.success('טמפלייט עודכן בהצלחה');
      setEditingTemplate(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error('שגיאה בעדכון טמפלייט: ' + error.message);
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('manychat_templates')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manychat-templates'] });
      toast.success('סטטוס טמפלייט עודכן');
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('manychat_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manychat-templates'] });
      toast.success('טמפלייט נמחק בהצלחה');
    },
  });

  const resetForm = () => {
    setFormData({
      template_name: "",
      template_namespace: "",
      template_language: "he",
      display_name: "",
      description: "",
      template_variables: "[]",
    });
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      template_name: template.template_name,
      template_namespace: template.template_namespace,
      template_language: template.template_language,
      display_name: template.display_name,
      description: template.description || "",
      template_variables: JSON.stringify(template.template_variables || []),
    });
  };

  const handleSubmit = () => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      addTemplateMutation.mutate(formData);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">WhatsApp Templates</h1>
          <p className="text-muted-foreground mt-1">
            נהל טמפלייטים של WhatsApp לשליחת הודעות מחוץ לחלון 24 השעות
          </p>
        </div>
        <Dialog open={isAddDialogOpen || !!editingTemplate} onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingTemplate(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 ml-2" />
              הוסף טמפלייט
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'ערוך טמפלייט' : 'הוסף טמפלייט חדש'}</DialogTitle>
              <DialogDescription>
                הזן את פרטי הטמפלייט שכבר יצרת ואושר ב-ManyChat
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>שם טמפלייט (Template Name)</Label>
                  <Input
                    value={formData.template_name}
                    onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                    placeholder="greeting_message"
                  />
                </div>
                <div>
                  <Label>Namespace</Label>
                  <Input
                    value={formData.template_namespace}
                    onChange={(e) => setFormData({ ...formData, template_namespace: e.target.value })}
                    placeholder="your_namespace"
                  />
                </div>
              </div>
              
              <div>
                <Label>שם תצוגה (בעברית)</Label>
                <Input
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="הודעת ברכה"
                />
              </div>
              
              <div>
                <Label>תיאור</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="תיאור קצר של מה הטמפלייט עושה"
                  rows={3}
                />
              </div>
              
              <div>
                <Label>שפה</Label>
                <Input
                  value={formData.template_language}
                  onChange={(e) => setFormData({ ...formData, template_language: e.target.value })}
                  placeholder="he"
                />
              </div>
              
              <div>
                <Label>משתנים (JSON Array)</Label>
                <Textarea
                  value={formData.template_variables}
                  onChange={(e) => setFormData({ ...formData, template_variables: e.target.value })}
                  placeholder='["name", "date"]'
                  rows={3}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  רשימת שמות המשתנים בטמפלייט (JSON array)
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleSubmit}
                disabled={addTemplateMutation.isPending || updateTemplateMutation.isPending}
              >
                {editingTemplate ? 'עדכן' : 'הוסף'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>חשוב:</strong> טמפלייטים נוצרים ומאושרים דרך ManyChat Dashboard בלבד. 
          כאן תוכל להוסיף את הפרטים של טמפלייטים שכבר אושרו על ידי WhatsApp.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="text-center py-8">טוען טמפלייטים...</div>
      ) : templates && templates.length > 0 ? (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {template.display_name}
                      <Badge variant={template.is_active ? "default" : "secondary"}>
                        {template.is_active ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {template.description || 'אין תיאור'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEdit(template)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => deleteTemplateMutation.mutate(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Template Name:</span>
                    <p className="font-mono">{template.template_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Namespace:</span>
                    <p className="font-mono">{template.template_namespace}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">שפה:</span>
                    <p>{template.template_language}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">משתנים:</span>
                    <p>{template.template_variables?.length || 0}</p>
                  </div>
                </div>
                {template.template_variables && template.template_variables.length > 0 && (
                  <div className="mt-3">
                    <span className="text-sm text-muted-foreground">משתנים: </span>
                    {template.template_variables.map((v: string, i: number) => (
                      <Badge key={i} variant="outline" className="ml-1">
                        {v}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex items-center gap-2">
                  <Switch
                    checked={template.is_active}
                    onCheckedChange={(checked) => 
                      toggleActiveMutation.mutate({ id: template.id, is_active: checked })
                    }
                  />
                  <Label>טמפלייט פעיל</Label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground mb-4">אין טמפלייטים עדיין</p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 ml-2" />
              הוסף טמפלייט ראשון
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

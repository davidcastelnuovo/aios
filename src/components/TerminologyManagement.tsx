import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Save, RotateCcw, Edit } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TerminologyItem {
  id: string;
  term_key: string;
  singular: string;
  plural: string;
  original_singular: string;
  original_plural: string;
}

export default function TerminologyManagement() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<TerminologyItem | null>(null);
  const [editForm, setEditForm] = useState({ singular: '', plural: '' });

  const { data: terms = [], isLoading } = useQuery({
    queryKey: ['terminology', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_terminology' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('term_key');

      if (error) throw error;
      return ((data || []) as unknown) as TerminologyItem[];
    },
    enabled: !!tenantId,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, singular, plural }: { id: string; singular: string; plural: string }) => {
      const { error } = await supabase
        .from('tenant_terminology' as any)
        .update({ singular, plural })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminology'] });
      toast.success('המונח עודכן בהצלחה');
      setIsEditDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error('שגיאה בעדכון מונח: ' + error.message);
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (id: string) => {
      const term = terms.find(t => t.id === id);
      if (!term) return;

      const { error } = await supabase
        .from('tenant_terminology' as any)
        .update({ 
          singular: term.original_singular, 
          plural: term.original_plural 
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminology'] });
      toast.success('המונח אופס לברירת מחדל');
    },
    onError: (error: Error) => {
      toast.error('שגיאה באיפוס מונח: ' + error.message);
    },
  });

  const openEditDialog = (term: TerminologyItem) => {
    setEditingTerm(term);
    setEditForm({ singular: term.singular, plural: term.plural });
    setIsEditDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingTerm) return;
    updateMutation.mutate({
      id: editingTerm.id,
      singular: editForm.singular,
      plural: editForm.plural,
    });
  };

  const getTermLabel = (key: string): string => {
    const labels: Record<string, string> = {
      // Module names
      agency: 'מודול: סוכנות',
      client: 'מודול: לקוח',
      lead: 'מודול: ליד',
      task: 'מודול: משימה',
      campaigner: 'מודול: קמפיינר',
      sales_person: 'מודול: איש מכירות',
      supplier: 'מודול: ספק',
      product: 'מודול: מוצר',
      onboarding: 'מודול: קליטה',
      // Role names
      role_owner: 'תפקיד: בעלים',
      role_team_manager: 'תפקיד: מנהל צוות',
      role_campaigner: 'תפקיד: קמפיינר',
      role_sales_person: 'תפקיד: איש מכירות',
      role_seo: 'תפקיד: SEO',
      role_super_admin: 'תפקיד: סופר אדמין',
    };
    return labels[key] || key;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p>טוען...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ניהול שמות מודולים</CardTitle>
          <p className="text-sm text-muted-foreground">
            התאם אישית את שמות המודולים והמסננים במערכת. השינויים ישפיעו על כל המערכת.
          </p>
        </CardHeader>
        <CardContent>
          {!terms || terms.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              לא נמצאו מונחים להגדרה
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>מודול</TableHead>
                  <TableHead>יחיד</TableHead>
                  <TableHead>רבים</TableHead>
                  <TableHead>ברירת מחדל</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terms.map((term) => (
                  <TableRow key={term.id}>
                    <TableCell className="font-medium">
                      {getTermLabel(term.term_key)}
                    </TableCell>
                    <TableCell>{term.singular}</TableCell>
                    <TableCell>{term.plural}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {term.original_singular} / {term.original_plural}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(term)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => resetMutation.mutate(term.id)}
                          disabled={
                            resetMutation.isPending ||
                            (term.singular === term.original_singular &&
                              term.plural === term.original_plural)
                          }
                          title="איפוס לברירת מחדל"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              עריכת מונח: {editingTerm && getTermLabel(editingTerm.term_key)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="singular">יחיד</Label>
              <Input
                id="singular"
                value={editForm.singular}
                onChange={(e) => setEditForm({ ...editForm, singular: e.target.value })}
                placeholder="סניף"
              />
            </div>

            <div>
              <Label htmlFor="plural">רבים</Label>
              <Input
                id="plural"
                value={editForm.plural}
                onChange={(e) => setEditForm({ ...editForm, plural: e.target.value })}
                placeholder="סניפים"
              />
            </div>

            {editingTerm && (
              <div className="text-sm text-muted-foreground">
                ברירת מחדל: {editingTerm.original_singular} / {editingTerm.original_plural}
              </div>
            )}

            <Button onClick={handleSave} className="w-full" disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 ml-2" />
              שמור שינויים
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

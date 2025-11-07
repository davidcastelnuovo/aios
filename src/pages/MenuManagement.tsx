import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Eye, EyeOff, Save, RotateCcw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MenuItem {
  id: string;
  menu_key: string;
  custom_label: string | null;
  original_label: string;
  is_visible: boolean;
  sort_order: number;
  icon: string | null;
  route: string;
}

export default function MenuManagement() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [editingItems, setEditingItems] = useState<Record<string, string>>({});

  const { data: menuItems, isLoading } = useQuery({
    queryKey: ['menu-items', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order');

      if (error) throw error;
      return data as MenuItem[];
    },
    enabled: !!tenantId,
  });

  const updateMutation = useMutation({
    mutationFn: async (item: Partial<MenuItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('menu_items')
        .update(item)
        .eq('id', item.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      toast.success('פריט התפריט עודכן בהצלחה');
    },
    onError: (error: Error) => {
      toast.error('שגיאה בעדכון פריט התפריט: ' + error.message);
    },
  });

  const handleLabelChange = (id: string, value: string) => {
    setEditingItems(prev => ({ ...prev, [id]: value }));
  };

  const handleSaveLabel = (item: MenuItem) => {
    const newLabel = editingItems[item.id];
    if (newLabel !== undefined) {
      updateMutation.mutate({
        id: item.id,
        custom_label: newLabel.trim() || null,
      });
      setEditingItems(prev => {
        const updated = { ...prev };
        delete updated[item.id];
        return updated;
      });
    }
  };

  const handleResetLabel = (item: MenuItem) => {
    updateMutation.mutate({
      id: item.id,
      custom_label: null,
    });
    setEditingItems(prev => {
      const updated = { ...prev };
      delete updated[item.id];
      return updated;
    });
  };

  const handleToggleVisibility = (item: MenuItem) => {
    updateMutation.mutate({
      id: item.id,
      is_visible: !item.is_visible,
    });
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
      <div>
        <h1 className="text-3xl font-bold">ניהול תפריטים</h1>
        <p className="text-muted-foreground mt-2">
          התאם אישית את שמות פריטי התפריט והנראות שלהם
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>פריטי תפריט</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם מקורי</TableHead>
                <TableHead>שם מותאם</TableHead>
                <TableHead>נראה</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {menuItems?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.original_label}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        value={
                          editingItems[item.id] !== undefined
                            ? editingItems[item.id]
                            : item.custom_label || item.original_label
                        }
                        onChange={(e) => handleLabelChange(item.id, e.target.value)}
                        className="max-w-xs"
                        placeholder={item.original_label}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={item.is_visible}
                      onCheckedChange={() => handleToggleVisibility(item)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {editingItems[item.id] !== undefined && (
                        <Button
                          size="sm"
                          onClick={() => handleSaveLabel(item)}
                          disabled={updateMutation.isPending}
                        >
                          <Save className="h-4 w-4 ml-1" />
                          שמור
                        </Button>
                      )}
                      {item.custom_label && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResetLabel(item)}
                          disabled={updateMutation.isPending}
                        >
                          <RotateCcw className="h-4 w-4 ml-1" />
                          אפס
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
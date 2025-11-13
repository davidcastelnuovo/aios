import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, EyeOff, Save, RotateCcw, ChevronUp, ChevronDown } from "lucide-react";
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
  badge?: 'coming_soon' | 'premium' | null;
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

  const handleBadgeChange = (item: MenuItem, badge: string | null) => {
    updateMutation.mutate({
      id: item.id,
      badge: badge === 'none' ? null : badge as 'coming_soon' | 'premium',
    });
  };

  const handleMoveUp = (item: MenuItem, index: number) => {
    if (index === 0 || !menuItems) return;
    
    const previousItem = menuItems[index - 1];
    updateMutation.mutate({
      id: item.id,
      sort_order: previousItem.sort_order,
    });
    updateMutation.mutate({
      id: previousItem.id,
      sort_order: item.sort_order,
    });
  };

  const handleMoveDown = (item: MenuItem, index: number) => {
    if (!menuItems || index === menuItems.length - 1) return;
    
    const nextItem = menuItems[index + 1];
    updateMutation.mutate({
      id: item.id,
      sort_order: nextItem.sort_order,
    });
    updateMutation.mutate({
      id: nextItem.id,
      sort_order: item.sort_order,
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
                <TableHead className="w-12">סדר</TableHead>
                <TableHead>שם מקורי</TableHead>
                <TableHead>שם מותאם</TableHead>
                <TableHead>בדג'</TableHead>
                <TableHead>נראה</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {menuItems?.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleMoveUp(item, index)}
                        disabled={index === 0 || updateMutation.isPending}
                        className="h-8 w-8"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleMoveDown(item, index)}
                        disabled={index === menuItems.length - 1 || updateMutation.isPending}
                        className="h-8 w-8"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
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
                    <Select
                      value={item.badge || 'none'}
                      onValueChange={(value) => handleBadgeChange(item, value === 'none' ? null : value)}
                      disabled={updateMutation.isPending}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">ללא</SelectItem>
                        <SelectItem value="coming_soon">בקרוב</SelectItem>
                        <SelectItem value="premium">פרימיום</SelectItem>
                      </SelectContent>
                    </Select>
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
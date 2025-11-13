import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, RotateCcw, GripVertical, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  category?: string | null;
  parent_menu_key?: string | null;
}

interface SortableMenuItemProps {
  item: MenuItem;
  editingItems: Record<string, string>;
  updateMutation: any;
  onLabelChange: (id: string, value: string) => void;
  onSaveLabel: (item: MenuItem) => void;
  onResetLabel: (item: MenuItem) => void;
  onToggleVisibility: (item: MenuItem) => void;
  onBadgeChange: (item: MenuItem, badge: string | null) => void;
  isChild?: boolean;
}

function SortableMenuItem({
  item,
  editingItems,
  updateMutation,
  onLabelChange,
  onSaveLabel,
  onResetLabel,
  onToggleVisibility,
  onBadgeChange,
  isChild = false,
}: SortableMenuItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className="group border-b hover:bg-muted/50">
      <td className="p-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-2 hover:bg-muted rounded flex items-center gap-2"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
          {isChild && <span className="text-muted-foreground mr-2">└─</span>}
        </div>
      </td>
      <td className="p-2 font-medium">{item.original_label}</td>
      <td className="p-2">
        <Input
          value={
            editingItems[item.id] !== undefined
              ? editingItems[item.id]
              : item.custom_label || item.original_label
          }
          onChange={(e) => onLabelChange(item.id, e.target.value)}
          className="max-w-xs"
          placeholder={item.original_label}
        />
      </td>
      <td className="p-2">
        <Select
          value={item.badge || 'none'}
          onValueChange={(value) => onBadgeChange(item, value === 'none' ? null : value)}
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
      </td>
      <td className="p-2">
        <Switch
          checked={item.is_visible}
          onCheckedChange={() => onToggleVisibility(item)}
        />
      </td>
      <td className="p-2">
        <div className="flex items-center gap-2">
          {editingItems[item.id] !== undefined && (
            <Button
              size="sm"
              onClick={() => onSaveLabel(item)}
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
              onClick={() => onResetLabel(item)}
              disabled={updateMutation.isPending}
            >
              <RotateCcw className="h-4 w-4 ml-1" />
              אפס
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

interface MenuGroupProps {
  title: string;
  items: MenuItem[];
  editingItems: Record<string, string>;
  updateMutation: any;
  onLabelChange: (id: string, value: string) => void;
  onSaveLabel: (item: MenuItem) => void;
  onResetLabel: (item: MenuItem) => void;
  onToggleVisibility: (item: MenuItem) => void;
  onBadgeChange: (item: MenuItem, badge: string | null) => void;
  children?: MenuItem[];
  defaultOpen?: boolean;
}

function MenuGroup({
  title,
  items,
  children,
  editingItems,
  updateMutation,
  onLabelChange,
  onSaveLabel,
  onResetLabel,
  onToggleVisibility,
  onBadgeChange,
  defaultOpen = false,
}: MenuGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <CardTitle className="text-lg">{title}</CardTitle>
            <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="p-0">
            <SortableContext
              items={items.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <table className="w-full">
                <tbody>
                  {items.map((item) => (
                    <SortableMenuItem
                      key={item.id}
                      item={item}
                      editingItems={editingItems}
                      updateMutation={updateMutation}
                      onLabelChange={onLabelChange}
                      onSaveLabel={onSaveLabel}
                      onResetLabel={onResetLabel}
                      onToggleVisibility={onToggleVisibility}
                      onBadgeChange={onBadgeChange}
                    />
                  ))}
                </tbody>
              </table>
            </SortableContext>
            {children && children.length > 0 && (
              <div className="mr-8 border-r-2 border-muted">
                <SortableContext
                  items={children.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <table className="w-full">
                    <tbody>
                      {children.map((child) => (
                        <SortableMenuItem
                          key={child.id}
                          item={child}
                          editingItems={editingItems}
                          updateMutation={updateMutation}
                          onLabelChange={onLabelChange}
                          onSaveLabel={onSaveLabel}
                          onResetLabel={onResetLabel}
                          onToggleVisibility={onToggleVisibility}
                          onBadgeChange={onBadgeChange}
                          isChild
                        />
                      ))}
                    </tbody>
                  </table>
                </SortableContext>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function MenuManagement() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [editingItems, setEditingItems] = useState<Record<string, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !menuItems) return;

    const oldIndex = menuItems.findIndex((item) => item.id === active.id);
    const newIndex = menuItems.findIndex((item) => item.id === over.id);

    const newMenuItems = arrayMove(menuItems, oldIndex, newIndex);

    // Update sort_order for all affected items
    newMenuItems.forEach((item, index) => {
      if (item.sort_order !== index + 1) {
        updateMutation.mutate({
          id: item.id,
          sort_order: index + 1,
        });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>טוען...</p>
      </div>
    );
  }

  // Group menu items by category
  const mainItems = menuItems?.filter(item => item.category === 'main' && !item.parent_menu_key) || [];
  const managementParent = menuItems?.find(item => item.menu_key === 'management');
  const managementItems = menuItems?.filter(item => item.parent_menu_key === 'management') || [];
  const salesParent = menuItems?.find(item => item.menu_key === 'sales');
  const salesItems = menuItems?.filter(item => item.parent_menu_key === 'sales') || [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">ניהול תפריטים</h1>
        <p className="text-muted-foreground mt-2">
          גרור פריטים כדי לשנות את הסדר, ערוך שמות והגדרות. פריטים עם תת-תפריטים מוצגים בקבוצות מתקפלות.
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="mb-4">
          <Card>
            <CardContent className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-right w-24">גרירה</th>
                    <th className="p-2 text-right">שם מקורי</th>
                    <th className="p-2 text-right">שם מותאם</th>
                    <th className="p-2 text-right">בדג'</th>
                    <th className="p-2 text-right">נראה</th>
                    <th className="p-2 text-right">פעולות</th>
                  </tr>
                </thead>
              </table>
            </CardContent>
          </Card>
        </div>

        <MenuGroup
          title="תפריט ראשי"
          items={mainItems}
          editingItems={editingItems}
          updateMutation={updateMutation}
          onLabelChange={handleLabelChange}
          onSaveLabel={handleSaveLabel}
          onResetLabel={handleResetLabel}
          onToggleVisibility={handleToggleVisibility}
          onBadgeChange={handleBadgeChange}
          defaultOpen={true}
        />

        {managementParent && (
          <MenuGroup
            title={managementParent.custom_label || managementParent.original_label}
            items={[managementParent]}
            children={managementItems}
            editingItems={editingItems}
            updateMutation={updateMutation}
            onLabelChange={handleLabelChange}
            onSaveLabel={handleSaveLabel}
            onResetLabel={handleResetLabel}
            onToggleVisibility={handleToggleVisibility}
            onBadgeChange={handleBadgeChange}
            defaultOpen={true}
          />
        )}

        {salesParent && (
          <MenuGroup
            title={salesParent.custom_label || salesParent.original_label}
            items={[salesParent]}
            children={salesItems}
            editingItems={editingItems}
            updateMutation={updateMutation}
            onLabelChange={handleLabelChange}
            onSaveLabel={handleSaveLabel}
            onResetLabel={handleResetLabel}
            onToggleVisibility={handleToggleVisibility}
            onBadgeChange={handleBadgeChange}
            defaultOpen={true}
          />
        )}
      </DndContext>
    </div>
  );
}
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Save, RotateCcw, GripVertical, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
  isRootOrg?: boolean;
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
  isRootOrg = false,
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
    <TableRow ref={setNodeRef} style={style} className="group">
      <TableCell className="w-12">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-2 hover:bg-muted rounded flex items-center gap-2"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
          {isChild && <span className="text-muted-foreground">└─</span>}
        </div>
      </TableCell>
      <TableCell className="font-medium">{item.original_label}</TableCell>
      <TableCell>
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
      </TableCell>
      {isRootOrg && (
        <TableCell>
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
        </TableCell>
      )}
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={item.is_visible}
            onCheckedChange={() => onToggleVisibility(item)}
            disabled={updateMutation.isPending}
          />
          <span className="text-sm text-muted-foreground">
            {item.is_visible ? 'מוצג' : 'מוסתר'}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSaveLabel(item)}
            disabled={
              editingItems[item.id] === undefined || 
              updateMutation.isPending
            }
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onResetLabel(item)}
            disabled={!item.custom_label || updateMutation.isPending}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface MenuGroupProps {
  category: string;
  items: MenuItem[];
  children: MenuItem[];
  editingItems: Record<string, string>;
  updateMutation: any;
  onLabelChange: (id: string, value: string) => void;
  onSaveLabel: (item: MenuItem) => void;
  onResetLabel: (item: MenuItem) => void;
  onToggleVisibility: (item: MenuItem) => void;
  onBadgeChange: (item: MenuItem, badge: string | null) => void;
  onDragEnd: (items: MenuItem[], event: DragEndEvent) => void;
  isRootOrg?: boolean;
}

function MenuGroup({
  category,
  items,
  children,
  editingItems,
  updateMutation,
  onLabelChange,
  onSaveLabel,
  onResetLabel,
  onToggleVisibility,
  onBadgeChange,
  onDragEnd,
  isRootOrg = false,
}: MenuGroupProps) {
  const [isOpen, setIsOpen] = useState(true);

  const categoryLabels: Record<string, string> = {
    dashboard: 'לוח בקרה',
    management: 'ניהול',
    sales: 'מכירות',
    reports: 'דוחות',
    settings: 'הגדרות',
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Combine items and children for this group
  const allGroupItems = [...items, ...children];

  const handleGroupDragEnd = (event: DragEndEvent) => {
    onDragEnd(allGroupItems, event);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-6">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center gap-2">
              <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
              {categoryLabels[category] || category}
              <span className="text-sm text-muted-foreground font-normal">
                ({allGroupItems.length})
              </span>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleGroupDragEnd}
            >
              <SortableContext
                items={allGroupItems.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">סדר</TableHead>
                        <TableHead>שם מקורי</TableHead>
                        <TableHead>שם מותאם</TableHead>
                        {isRootOrg && <TableHead>תג</TableHead>}
                        <TableHead>תצוגה</TableHead>
                        <TableHead>פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
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
                          isRootOrg={isRootOrg}
                        />
                      ))}
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
                          isRootOrg={isRootOrg}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </SortableContext>
            </DndContext>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function MenuManagement() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [editingItems, setEditingItems] = useState<Record<string, string>>({});
  const [groupOrder, setGroupOrder] = useState<string[]>(['main', 'management', 'sales']);

  // Get org_type directly from DB (types not updated yet)
  const { data: tenantData } = useQuery({
    queryKey: ['tenant-org-type', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from('tenants')
        .select('org_type, is_premium')
        .eq('id', tenantId)
        .single();
      return data as any;
    },
    enabled: !!tenantId,
  });

  const isRootOrg = tenantData?.org_type === 'root_organization';

  const groupSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load group order
  const { data: groupOrderSetting } = useQuery({
    queryKey: ['menu-group-order', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase.rpc('get_effective_setting', {
        _tenant_id: tenantId,
        _setting_key: 'menu_group_order',
      });
      if (error) {
        console.error('Error fetching group order:', error);
        return null;
      }
      return data;
    },
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (Array.isArray(groupOrderSetting)) {
      setGroupOrder(groupOrderSetting as string[]);
    }
  }, [groupOrderSetting]);

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
      queryClient.invalidateQueries({ queryKey: ['menu-items', tenantId] });
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

  const handleGroupDragEnd = (groupItems: MenuItem[], event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = groupItems.findIndex(item => item.id === active.id);
    const newIndex = groupItems.findIndex(item => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(groupItems, oldIndex, newIndex);

    // Update sort_order for all items in this group
    const updates = reordered.map((item, index) => ({
      id: item.id,
      sort_order: index,
    }));

    // Update all items in parallel
    Promise.all(
      updates.map(update =>
        supabase
          .from('menu_items')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id)
      )
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: ['menu-items', tenantId] });
      toast.success('סדר הפריטים עודכן');
    }).catch((error) => {
      toast.error('שגיאה בעדכון הסדר: ' + error.message);
    });
  };

  // Group ordering disabled until RPC function is created
  const handleGroupOrderDragEnd = (event: DragEndEvent) => {
    // Disabled for now
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!menuItems) return null;

  // Group menu items by parent - new hierarchical structure
  const parentItems = menuItems.filter(item => !item.parent_menu_key);
  
  const groups = parentItems.map(parent => {
    const children = menuItems.filter(item => item.parent_menu_key === parent.menu_key);
    return {
      category: parent.menu_key,
      items: [parent],
      children: children
    };
  });

  return (
    <div className="p-8 space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold mb-2">ניהול תפריט</h1>
        <p className="text-muted-foreground">
          התאם אישית את תפריט הניווט - ערוך שמות, שנה סדר וקבע נראות
        </p>
      </div>

      <DndContext
        sensors={groupSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleGroupOrderDragEnd}
      >
        <SortableContext
          items={groupOrder}
          strategy={verticalListSortingStrategy}
        >
          {groups.map((group) => group && (
            <div key={group.category}>
              <MenuGroup
                category={group.category}
                items={group.items}
                children={group.children}
                editingItems={editingItems}
                updateMutation={updateMutation}
                onLabelChange={handleLabelChange}
                onSaveLabel={handleSaveLabel}
                onResetLabel={handleResetLabel}
                onToggleVisibility={handleToggleVisibility}
                onBadgeChange={handleBadgeChange}
                onDragEnd={handleGroupDragEnd}
                isRootOrg={isRootOrg}
              />
            </div>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

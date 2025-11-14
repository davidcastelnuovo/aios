import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

export interface MenuItem {
  id: string;
  menu_key: string;
  custom_label: string | null;
  original_label: string;
  is_visible: boolean;
  sort_order: number;
  icon: string | null;
  route: string;
  badge?: 'coming_soon' | 'premium' | null;
  parent_menu_key?: string | null;
}

export function useMenuItems() {
  const { tenantId, tenant } = useCurrentTenant();

  const { data: menuItems, isLoading } = useQuery({
    queryKey: ['menu-items', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order');

      if (error) {
        console.error('Error fetching menu items:', error);
        return [];
      }
      
      return data as MenuItem[];
    },
    enabled: !!tenantId,
  });

  // Create a lookup map for quick access by menu_key
  const menuItemsMap = new Map<string, MenuItem>();
  menuItems?.forEach(item => {
    menuItemsMap.set(item.menu_key, item);
  });

  // Get org_type and is_premium directly from DB (types not updated yet)
  const { data: tenantData } = useQuery({
    queryKey: ['tenant-premium-status', tenantId],
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

  return {
    menuItems: menuItems || [],
    menuItemsMap,
    isLoading,
    orgType: tenantData?.org_type,
    isPremium: tenantData?.is_premium,
  };
}

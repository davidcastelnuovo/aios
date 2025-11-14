import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Building2,
  Users,
  Megaphone,
  DollarSign,
  CheckSquare,
  Clock,
  Truck,
  BarChart3,
  User,
  UserPlus,
  ShieldCheck,
  UserCheck,
  Target,
  TrendingUp,
  ChevronDown,
  Settings,
  Building,
  Zap,
  PanelRightClose,
  PanelRightOpen,
  Package,
  Palette,
  Bot,
  Menu,
  ListTree,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useUserTenants } from "@/hooks/useUserTenants";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTenant } from "@/contexts/TenantContext";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useTheme } from "@/contexts/ThemeContext";
import { useMenuItems, MenuItem } from "@/hooks/useMenuItems";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const iconMap: Record<string, any> = {
  LayoutDashboard,
  Users,
  Building2,
  CheckSquare,
  FileText: Target,
  UserPlus,
  Calendar: Clock,
  Package,
  Settings,
  Briefcase: Building,
  TrendingUp,
  DollarSign,
  BarChart3,
  Clock,
  Megaphone,
  Target,
  ShieldCheck,
  User,
  UserCheck,
  Truck,
  Zap,
  Building,
  Palette,
  Bot,
  Menu,
  ListTree,
};

export function AppSidebar() {
  const { state, setOpenMobile, isMobile, toggleSidebar } = useSidebar();
  const { hasPermission, isLoading } = useUserPermissions();
  const { logoUrl } = useTheme();
  const { buildPath } = useTenantPath();
  const { menuItems: dbMenuItems, menuItemsMap, isLoading: isLoadingMenuItems, orgType, isPremium } = useMenuItems();
  const isCollapsed = state === "collapsed";
  const navigate = useNavigate();

  const { userId } = useCurrentUser();
  const { currentTenantId, setCurrentTenantId } = useTenant();
  const tenantPath = useTenantPath();
  
  const { data: userTenants, isLoading: isLoadingTenants } = useQuery({
    queryKey: ["user-tenants", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("tenant_users")
        .select("tenant_id, tenants(id, name)")
        .eq("user_id", userId);
      
      if (error) throw error;
      return data?.map(tu => tu.tenants).filter(Boolean) as Array<{id: string, name: string}>;
    },
    enabled: !!userId,
  });

  const handleTenantChange = async (newTenantId: string) => {
    if (!userId) return;

    try {
      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("role")
        .eq("tenant_id", newTenantId)
        .eq("user_id", userId)
        .single();

      if (tenantUser) {
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .eq("tenant_id", newTenantId)
          .single();

        if (!existingRole) {
          await supabase.from("user_roles").insert([{
            user_id: userId,
            role: tenantUser.role as any,
            tenant_id: newTenantId,
          }]);
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({ active_tenant_id: newTenantId } as any)
        .eq("id", userId);

      if (error) throw error;

      setCurrentTenantId(newTenantId);

      const { data: newTenant } = await supabase
        .from("tenants")
        .select("slug")
        .eq("id", newTenantId)
        .single();

      if (newTenant?.slug) {
        navigate(`/t/${newTenant.slug}/dashboard`);
      }
    } catch (error) {
      console.error("Error changing tenant:", error);
    }
  };

  const handleLinkClick = () => {
    if (isMobile && setOpenMobile) {
      setOpenMobile(false);
    }
  };

  // Get menu items ordered by sort_order
  const allMenuItems = [...dbMenuItems].sort((a, b) => a.sort_order - b.sort_order);
  
  // Separate parent items from child items
  const parentItems = allMenuItems.filter(item => !item.parent_menu_key && item.is_visible);
  const childItemsMap = new Map<string, MenuItem[]>();
  
  allMenuItems.forEach(item => {
    if (item.parent_menu_key && item.is_visible) {
      if (!childItemsMap.has(item.parent_menu_key)) {
        childItemsMap.set(item.parent_menu_key, []);
      }
      childItemsMap.get(item.parent_menu_key)?.push(item);
    }
  });

  const getMenuItemLabel = (item: MenuItem) => {
    return item.custom_label || item.original_label;
  };

  const getMenuItemBadge = (item: MenuItem) => {
    if (item.badge === 'premium' && !isPremium) return 'premium';
    if (item.badge === 'coming_soon') return 'coming_soon';
    return null;
  };

  const canAccessMenuItem = (item: MenuItem) => {
    const modulePermissions: Record<string, string> = {
      'users': 'users',
      'agencies': 'agencies',
      'leads': 'leads',
      'clients': 'clients',
      'tasks': 'tasks',
      'client-onboarding': 'client_onboarding',
      'products': 'products',
      'settings': 'settings',
      'finance': 'finance',
      'sales-dashboard': 'sales',
      'reports': 'reports',
      'time-tracking': 'time_tracking',
      'campaigners': 'campaigners',
      'sales-people': 'sales_people',
      'dashboard': 'dashboard',
      'suppliers': 'suppliers',
      'automations': 'automations',
      'tenants': 'tenants',
      'branding': 'branding',
      'accounting-integrations': 'accounting',
      'ai-support': 'ai_support',
      'menu-management': 'menu_management',
      'fields-management': 'fields_management',
      'lead-integrations': 'lead_integrations',
    };

    const permission = modulePermissions[item.menu_key];
    if (!permission) return true;
    return hasPermission(permission as any);
  };

  const getIcon = (iconName: string | null) => {
    if (!iconName) return LayoutDashboard;
    return iconMap[iconName] || LayoutDashboard;
  };

  const renderMenuItem = (item: MenuItem) => {
    const Icon = getIcon(item.icon);
    const label = getMenuItemLabel(item);
    const badge = getMenuItemBadge(item);
    const canAccess = canAccessMenuItem(item);
    const isDisabled = badge === 'premium' || badge === 'coming_soon' || !canAccess;
    const children = childItemsMap.get(item.menu_key) || [];
    const hasChildren = children.length > 0;

    if (hasChildren) {
      // Parent item with children - render as collapsible
      return (
        <Collapsible key={item.menu_key} defaultOpen className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip={label}>
                <Icon className="h-4 w-4" />
                {!isCollapsed && <span>{label}</span>}
                {!isCollapsed && (
                  <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                )}
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {children.map(child => {
                  const ChildIcon = getIcon(child.icon);
                  const childLabel = getMenuItemLabel(child);
                  const childBadge = getMenuItemBadge(child);
                  const childCanAccess = canAccessMenuItem(child);
                  const childIsDisabled = childBadge === 'premium' || childBadge === 'coming_soon' || !childCanAccess;

                  if (childIsDisabled) {
                    return (
                      <SidebarMenuSubItem key={child.menu_key}>
                        <div className="flex items-center gap-2 w-full px-3 py-2 opacity-50 cursor-not-allowed">
                          <ChildIcon className="h-4 w-4" />
                          <span className="flex-1">{childLabel}</span>
                          {childBadge === 'premium' && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">
                              Premium
                            </Badge>
                          )}
                          {childBadge === 'coming_soon' && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              בקרוב
                            </Badge>
                          )}
                        </div>
                      </SidebarMenuSubItem>
                    );
                  }

                  return (
                    <SidebarMenuSubItem key={child.menu_key}>
                      <SidebarMenuSubButton asChild>
                        <NavLink
                          to={buildPath(child.route)}
                          onClick={handleLinkClick}
                          className={({ isActive }) =>
                            isActive
                              ? "flex items-center gap-2 w-full bg-sidebar-accent text-sidebar-accent-foreground"
                              : "flex items-center gap-2 w-full hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }
                        >
                          <ChildIcon className="h-4 w-4" />
                          <span className="flex-1">{childLabel}</span>
                          {childBadge === 'premium' && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">
                              Premium
                            </Badge>
                          )}
                          {childBadge === 'coming_soon' && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              בקרוב
                            </Badge>
                          )}
                        </NavLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      );
    }

    // Regular menu item without children
    return (
      <SidebarMenuItem key={item.menu_key}>
        <SidebarMenuButton
          asChild={!isDisabled}
          disabled={isDisabled}
          className={isDisabled ? "opacity-50 cursor-not-allowed" : ""}
          tooltip={isCollapsed ? label : undefined}
        >
          {isDisabled ? (
            <div className="flex items-center gap-2 w-full">
              <Icon className="h-4 w-4" />
              {!isCollapsed && <span className="flex-1">{label}</span>}
              {!isCollapsed && badge === 'premium' && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                  Premium
                </Badge>
              )}
              {!isCollapsed && badge === 'coming_soon' && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  בקרוב
                </Badge>
              )}
            </div>
          ) : (
            <NavLink
              to={buildPath(item.route)}
              onClick={handleLinkClick}
              className={({ isActive }) =>
                isActive
                  ? "flex items-center gap-2 w-full bg-sidebar-accent text-sidebar-accent-foreground"
                  : "flex items-center gap-2 w-full hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }
            >
              <Icon className="h-4 w-4" />
              {!isCollapsed && <span className="flex-1">{label}</span>}
              {!isCollapsed && badge === 'premium' && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                  Premium
                </Badge>
              )}
              {!isCollapsed && badge === 'coming_soon' && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  בקרוב
                </Badge>
              )}
            </NavLink>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  if (isLoadingMenuItems || isLoading || isLoadingTenants) {
    return null;
  }

  return (
    <Sidebar collapsible="icon" side="right">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between px-2 py-2" dir="rtl">
          <button
            onClick={toggleSidebar}
            className="flex-shrink-0 p-2 hover:bg-sidebar-accent rounded-md"
          >
            {isCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            {!isCollapsed && userTenants && userTenants.length > 1 && (
              <Select value={currentTenantId || undefined} onValueChange={handleTenantChange}>
                <SelectTrigger className="h-8 border-0 shadow-none focus:ring-0 min-w-0 bg-sidebar-background">
                  <SelectValue placeholder="בחר ארגון" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {userTenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!isCollapsed && userTenants && userTenants.length === 1 && (
              <span className="text-sm font-semibold truncate">{userTenants[0].name}</span>
            )}
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain flex-shrink-0" />
            ) : (
              <Building2 className="h-8 w-8 flex-shrink-0" />
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {parentItems.map(item => renderMenuItem(item))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

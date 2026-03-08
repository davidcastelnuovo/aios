import React, { useState, useMemo, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Table,
  Plus,
  Table2,
  MessageSquare,
  MessagesSquare,
  Download,
  PenLine,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useAgency } from "@/contexts/AgencyContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useMenuItems, MenuItem } from "@/hooks/useMenuItems";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SimpleTableDialog } from "@/components/dynamic-tables/SimpleTableDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  Table,
  Table2,
  MessageSquare,
  MessagesSquare,
  FolderKanban: Table,
  Database: Table,
  Layers: Table,
  FileSignature: PenLine,
};

export function AppSidebar() {
  const { state, setOpenMobile, isMobile, toggleSidebar } = useSidebar();
  const { hasPermission, isLoading } = useUserPermissions();
  const { logoUrl } = useTheme();
  const { buildPath } = useTenantPath();
  const { menuItems: dbMenuItems, menuItemsMap, isLoading: isLoadingMenuItems, orgType, isPremium } = useMenuItems();
  const isCollapsed = state === "collapsed";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  const { userId } = useCurrentUser();
  const { currentTenantId, setCurrentTenantId } = useTenant();
  const { tenantId: urlTenantId } = useCurrentTenant(); // Get tenant from URL
  const { selectedAgency } = useAgency();
  const tenantPath = useTenantPath();
  
  // Use URL tenant ID for display, context tenant for operations
  const displayTenantId = urlTenantId || currentTenantId;
  
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

  // Fetch dynamic CRM tables
  const { data: crmTables, isLoading: isLoadingCrmTables } = useQuery({
    queryKey: ['crm-tables', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const response = await supabase.functions.invoke('crm-tables', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        console.error('Error fetching CRM tables:', response.error);
        return [];
      }
      
      // Ensure we always return an array
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: !!currentTenantId,
  });

  const handleTenantChange = async (newTenantId: string) => {
    console.log("🔄 handleTenantChange called with:", newTenantId);
    
    if (!userId) {
      console.error("❌ No userId available");
      return;
    }

    try {
      // First, get the new tenant slug before any state changes
      console.log("📍 Fetching tenant slug for:", newTenantId);
      const { data: newTenant, error: slugError } = await supabase
        .from("tenants")
        .select("slug")
        .eq("id", newTenantId)
        .single();

      if (slugError) {
        console.error("❌ Error fetching tenant slug:", slugError);
      }
      console.log("✅ Got tenant slug:", newTenant?.slug);

      // Ensure user has a role in the new tenant
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

      // Update user_active_tenant in DB BEFORE redirect
      const { error } = await supabase
        .from("user_active_tenant")
        .upsert(
          {
            user_id: userId,
            tenant_id: newTenantId,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

      if (error) {
        console.error("❌ Error upserting user_active_tenant:", error);
        throw error;
      }

      // CRITICAL: Full page reload ensures complete data refresh
      // React Router navigation can leave stale cached data
      if (newTenant?.slug) {
        const currentPath = window.location.pathname;
        const pathMatch = currentPath.match(/^\/t\/[^/]+\/(.+)$/);
        const currentModule = pathMatch ? pathMatch[1] : 'dashboard';
        
        const newUrl = `/t/${newTenant.slug}/${currentModule}`;
        console.log("🚀 Redirecting to:", newUrl);
        
        // Force full page reload to ensure clean state
        window.location.href = newUrl;
        return;
      } else {
        console.log("🚀 No slug found, redirecting to /");
        window.location.href = '/';
        return;
      }
    } catch (error) {
      console.error("❌ Error changing tenant:", error);
    }
  };

  const handleLinkClick = () => {
    if (isMobile && setOpenMobile) {
      setOpenMobile(false);
    }
  };

  const getMenuItemLabel = (item: MenuItem) => {
    return item.custom_label || item.original_label;
  };

  const getMenuItemBadge = (item: MenuItem) => {
    if (item.badge === 'premium' && !isPremium) return 'premium';
    if (item.badge === 'coming_soon') return 'coming_soon';
    return null;
  };

  const canAccessMenuItem = (item: MenuItem) => {
    // מיפוי בין menu_key לבין permission module
    const modulePermissions: Record<string, string> = {
      'users': 'users',
      'agencies': 'agencies',
      'leads': 'leads',
      'clients': 'clients',
      'tasks': 'tasks',
      'client-onboarding': 'client_onboarding',
      'products': 'products',
      'finance': 'finance',
      'sales-dashboard': 'sales_dashboard',
      'reports': 'reports',
      'time-tracking': 'time_tracking',
      'campaigners': 'campaigners',
      'sales-people': 'sales_people',
      'dashboard': 'dashboard',
      'suppliers': 'suppliers',
      'automations': 'automations',
      'tenants': 'tenants',
      'branding': 'branding',
      'accounting-integrations': 'accounting_integrations',
      'ai-support': 'ai_support',
      'menu-management': 'menu_management',
      'fields-management': 'fields_management',
      'lead-integrations': 'lead_integrations',
      'integrations': 'lead_integrations',
      'manychat-settings': 'manychat_settings',
      'green-api-settings': 'green_api_settings',
      'chat-integrations': 'chat_integrations',
      'chat': 'chat',
      'dynamic-tables': 'dynamic_tables',
      'recordings': 'recordings',
      'team-chat': 'team_chat',
      'site_analytics': 'clients', // אנליטיקס אתרים - מי שיש לו גישה ללקוחות יכול לראות
      'rank_tracking': 'clients', // מעקב מיקומים - מי שיש לו גישה ללקוחות יכול לראות
    };

    // פריטים שאינם דורשים הרשאה מיוחדת (נגישים לכולם)
    const publicMenuKeys = ['my-profile'];
    
    if (publicMenuKeys.includes(item.menu_key)) {
      return true;
    }

    // אם זה פריט קבוצה (parent) ללא route, הוא נגיש אם יש לו ילדים נגישים
    if (item.route === '#' && !item.parent_menu_key) {
      return true; // הבדיקה של ילדים נעשית אחר כך
    }

    const permission = modulePermissions[item.menu_key];
    if (!permission) {
      // אם אין permission מוגדר, בודקים אם זה sub-item של קבוצה
      // במקרה כזה, מניחים שצריך הרשאה
      return false;
    }
    
    return hasPermission(permission as any);
  };

  const getIcon = (iconName: string | null) => {
    if (!iconName) return LayoutDashboard;
    return iconMap[iconName] || LayoutDashboard;
  };

  // Get menu items ordered by sort_order
  const allMenuItems = [...dbMenuItems].sort((a, b) => a.sort_order - b.sort_order);
  
  // Separate parent items from child items, filtering by visibility and permissions
  const childItemsMap = new Map<string, MenuItem[]>();
  
  // First, collect all children with access
  allMenuItems.forEach(item => {
    if (item.parent_menu_key && item.is_visible && canAccessMenuItem(item)) {
      if (!childItemsMap.has(item.parent_menu_key)) {
        childItemsMap.set(item.parent_menu_key, []);
      }
      childItemsMap.get(item.parent_menu_key)?.push(item);
    }
  });
  
  // Filter parent items: show only if user has access AND (it's not a group OR has accessible children)
  // EXCLUDE 'management' group - it will be shown as a dropdown in the header
  const parentItems = allMenuItems.filter(item => {
    if (item.parent_menu_key || !item.is_visible) return false;
    if (!canAccessMenuItem(item)) return false;
    
    // Exclude management group - will be rendered in header dropdown
    if (item.menu_key === 'management') return false;
    
    // If it's a group (has children), only show if it has accessible children
    const children = childItemsMap.get(item.menu_key) || [];
    if (item.route === '#') {
      return children.length > 0;
    }
    
    return true;
  });

  // Get management menu items for the dropdown
  const managementItems = childItemsMap.get('management') || [];

  const renderMenuItem = (item: MenuItem) => {
    const Icon = getIcon(item.icon);
    const label = getMenuItemLabel(item);
    const badge = getMenuItemBadge(item);
    const isDisabled = badge === 'premium' || badge === 'coming_soon';
    const children = childItemsMap.get(item.menu_key) || [];
    const hasChildren = children.length > 0;

    if (hasChildren) {
      // Parent item with children - render as collapsible
      return (
        <Collapsible key={item.menu_key} defaultOpen className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip={label} dir="rtl">
                {!isCollapsed && <span className="flex-1 text-right">{label}</span>}
                <Icon className="h-4 w-4" />
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
                  const childIsDisabled = childBadge === 'premium' || childBadge === 'coming_soon';

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
                          dir="rtl"
                        >
                          <span className="flex-1 text-right">{childLabel}</span>
                          <ChildIcon className="h-4 w-4" />
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
                <div className="flex items-center gap-2 w-full" dir="rtl">
                  {!isCollapsed && <span className="flex-1 text-right">{label}</span>}
                  <Icon className="h-4 w-4" />
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
                  dir="rtl"
                >
                  {!isCollapsed && <span className="flex-1 text-right">{label}</span>}
                  <Icon className="h-4 w-4" />
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
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 py-2">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
            ) : (
              <Building2 className="h-8 w-8" />
            )}
            {/* Management dropdown in collapsed mode */}
            {managementItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-2 hover:bg-sidebar-accent rounded-md transition-colors"
                    title="ניהול"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  side="left"
                  className="w-56 bg-popover z-50"
                >
                  {managementItems.map(item => {
                    const Icon = getIcon(item.icon);
                    const label = getMenuItemLabel(item);
                    const badge = getMenuItemBadge(item);
                    const isDisabled = badge === 'premium' || badge === 'coming_soon';
                    
                    return (
                      <DropdownMenuItem
                        key={item.menu_key}
                        disabled={isDisabled}
                        className={isDisabled ? "opacity-50" : ""}
                        asChild={!isDisabled}
                      >
                        {isDisabled ? (
                          <div className="flex items-center gap-2 w-full">
                            <Icon className="h-4 w-4" />
                            <span className="flex-1">{label}</span>
                            {badge === 'premium' && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">Premium</Badge>
                            )}
                            {badge === 'coming_soon' && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">בקרוב</Badge>
                            )}
                          </div>
                        ) : (
                          <NavLink
                            to={buildPath(item.route)}
                            onClick={handleLinkClick}
                            className="flex items-center gap-2 w-full"
                          >
                            <Icon className="h-4 w-4" />
                            <span className="flex-1">{label}</span>
                          </NavLink>
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button
              onClick={toggleSidebar}
              className="p-2 hover:bg-sidebar-accent rounded-md transition-colors"
            >
              <PanelRightOpen className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-2 py-2" dir="rtl">
            <div className="flex items-center gap-1">
              <button
                onClick={toggleSidebar}
                className="flex-shrink-0 p-2 hover:bg-sidebar-accent rounded-md transition-colors"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
              {/* Management dropdown */}
              {managementItems.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex-shrink-0 p-2 hover:bg-sidebar-accent rounded-md transition-colors"
                      title="ניהול"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="start" 
                    side="bottom"
                    className="w-56 bg-popover z-50"
                  >
                    {managementItems.map(item => {
                      const Icon = getIcon(item.icon);
                      const label = getMenuItemLabel(item);
                      const badge = getMenuItemBadge(item);
                      const isDisabled = badge === 'premium' || badge === 'coming_soon';
                      
                      return (
                        <DropdownMenuItem
                          key={item.menu_key}
                          disabled={isDisabled}
                          className={isDisabled ? "opacity-50" : ""}
                          asChild={!isDisabled}
                        >
                          {isDisabled ? (
                            <div className="flex items-center gap-2 w-full">
                              <Icon className="h-4 w-4" />
                              <span className="flex-1">{label}</span>
                              {badge === 'premium' && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">Premium</Badge>
                              )}
                              {badge === 'coming_soon' && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">בקרוב</Badge>
                              )}
                            </div>
                          ) : (
                            <NavLink
                              to={buildPath(item.route)}
                              onClick={handleLinkClick}
                              className="flex items-center gap-2 w-full"
                            >
                              <Icon className="h-4 w-4" />
                              <span className="flex-1">{label}</span>
                            </NavLink>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
              {userTenants && userTenants.length > 1 && (
                <Select value={displayTenantId || undefined} onValueChange={handleTenantChange}>
                  <SelectTrigger className="h-8 border-0 shadow-none focus:ring-0 min-w-0 bg-sidebar-background">
                    <SelectValue placeholder="בחר ארגון" />
                  </SelectTrigger>
                  <SelectContent 
                    className="bg-popover border border-border shadow-lg z-[9999]" 
                    position="popper" 
                    sideOffset={4}
                    align="start"
                    side="bottom"
                  >
                    {userTenants.filter(tenant => tenant.id).map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {userTenants && userTenants.length === 1 && (
                <span className="text-sm font-semibold truncate">{userTenants[0].name}</span>
              )}
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain flex-shrink-0" />
              ) : (
                <Building2 className="h-8 w-8 flex-shrink-0" />
              )}
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {parentItems.map(item => renderMenuItem(item))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Dynamic CRM Tables Section */}
        {hasPermission('dynamic_tables') && (() => {
          // Filter tables by selected agency
          const filteredCrmTables = (crmTables || []).filter((table: any) => {
            if (!selectedAgency || selectedAgency === 'all') return true;
            // Show general tables (no agency_id) and tables matching selected agency
            return table.agency_id === null || table.agency_id === selectedAgency;
          });
          
          return (
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <div className="flex items-center justify-between">
                    <CollapsibleTrigger className="flex items-center gap-2 flex-1 hover:bg-accent rounded-md px-2 py-1">
                      <Table2 className="h-4 w-4" />
                      {!isCollapsed && <span>ניהול טבלאות</span>}
                      <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180 mr-auto" />
                    </CollapsibleTrigger>
                    {!isCollapsed && (
                      <button
                        onClick={() => setIsQuickCreateOpen(true)}
                        className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors"
                        title="טבלה חדשה"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {/* Management Link */}
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={buildPath('dynamic-tables')}
                            onClick={handleLinkClick}
                            className={({ isActive }) =>
                              isActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            }
                          >
                            <Settings className="h-4 w-4" />
                            {!isCollapsed && <span>ניהול טבלאות</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>

                      {/* Individual Tables */}
                      {filteredCrmTables.map((table: any) => {
                        const Icon = iconMap[table.icon] || Table;
                        return (
                          <SidebarMenuItem key={table.id}>
                            <SidebarMenuButton asChild>
                              <NavLink
                                to={buildPath(`table/${table.slug}`)}
                                onClick={handleLinkClick}
                                className={({ isActive }) =>
                                  isActive
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                }
                              >
                                <Icon className="h-4 w-4" />
                                {!isCollapsed && <span>{table.name}</span>}
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })()}
      </SidebarContent>

      {/* Install PWA Button */}
      <InstallAppButton isCollapsed={isCollapsed} />

      {/* Quick Create Table Dialog */}
      <SimpleTableDialog 
        open={isQuickCreateOpen}
        onOpenChange={setIsQuickCreateOpen}
      />
    </Sidebar>
  );
}

function InstallAppButton({ isCollapsed }: { isCollapsed: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback for iOS / browsers that don't support beforeinstallprompt
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        alert('להתקנה באייפון:\n1. לחץ על כפתור השיתוף (⬆️)\n2. בחר "Add to Home Screen"');
      } else {
        alert('פתח את התפריט של הדפדפן ובחר "התקן אפליקציה" או "הוסף למסך הבית"');
      }
    }
  };

  if (isInstalled) return null;

  return (
    <div className="p-2 border-t border-sidebar-border">
      <button
        onClick={handleInstall}
        className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
      >
        <Download className="h-4 w-4 shrink-0" />
        {!isCollapsed && <span>התקן אפליקציה</span>}
      </button>
    </div>
  );
}

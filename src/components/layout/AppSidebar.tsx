import { NavLink, useNavigate } from "react-router-dom";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useUserTenants } from "@/hooks/useUserTenants";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTenant } from "@/contexts/TenantContext";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useTheme } from "@/contexts/ThemeContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const menuItems = [
  { title: "סוכנויות", path: "agencies", icon: Building2, module: "agencies" as const },
  { title: "לקוחות", path: "clients", icon: Users, module: "clients" as const },
  { title: "משימות", path: "tasks", icon: CheckSquare, module: "tasks" as const },
  { title: "לקוחות בקליטה", path: "client-onboarding", icon: UserPlus, module: "client_onboarding" as const },
  { title: "שעון נוכחות", path: "time-tracking", icon: Clock, module: "time_tracking" as const },
  { title: "צוות", path: "campaigners", icon: Megaphone, module: "campaigners" as const },
  { title: "ניהול משתמשים", path: "users", icon: ShieldCheck, module: "users" as const },
  { title: "אזור אישי", path: "my-profile", icon: User, module: null },
];

const managementMenuItems = [
  { title: "דשבורד", path: "dashboard", icon: LayoutDashboard, module: "dashboard" as const },
  { title: "כספים", path: "finance", icon: DollarSign, module: "finance" as const },
  { title: "דוחות", path: "reports", icon: BarChart3, module: "reports" as const },
  { title: "ספקים", path: "suppliers", icon: Truck, module: "suppliers" as const },
  { title: "אוטומציות", path: "automations", icon: Zap, module: "automations" as const },
  { title: "ניהול ארגונים", path: "tenants", icon: Building, module: "tenants" as const },
  { title: "התאמת מערכת", path: "branding", icon: Palette, module: "branding" as const },
  { title: "הנהלת חשבונות", path: "accounting-integrations", icon: Building, module: "accounting" as const },
  { title: "תמיכה טכנית AI", path: "ai-support", icon: Bot, module: "ai_support" as const },
  { title: "ניהול תפריטים", path: "menu-management", icon: Menu, module: "menu_management" as const },
  { title: "ניהול שדות", path: "fields-management", icon: ListTree, module: "fields_management" as const },
];

const salesMenuItems = [
  { title: "דשבורד מכירות", path: "sales-dashboard", icon: TrendingUp, module: "sales_dashboard" as const },
  { title: "לידים", path: "leads", icon: Target, module: "leads" as const },
  { title: "מוצרים ושירותים", path: "products", icon: Package, module: "leads" as const },
  { title: "אנשי מכירות", path: "sales-people", icon: UserCheck, module: "sales_people" as const },
  { title: "אינטגרציות לידים", path: "lead-integrations", icon: Settings, module: "lead_integrations" as const },
];

export function AppSidebar() {
  const { state, setOpenMobile, isMobile, toggleSidebar } = useSidebar();
  const { hasPermission, isLoading } = useUserPermissions();
  const { logoUrl } = useTheme();
  const { buildPath } = useTenantPath();
  const isCollapsed = state === "collapsed";
  const navigate = useNavigate();

  const { userId } = useCurrentUser();
  const { currentTenantId, setCurrentTenantId, currentTenant } = useTenant();

  const { userTenants } = useUserTenants(userId);


  const currentTenantName = (userTenants || []).find((t: any) => t.id === currentTenantId)?.name || currentTenant?.name;
  
  console.log("Current tenant dropdown:", {
    totalTenants: userTenants?.length,
    currentTenantId,
    currentTenantName,
    tenants: userTenants?.map((t: any) => ({ id: t.id, name: t.name }))
  });

  const handleTenantChange = async (tenantId: string) => {
    try {
      // Get target tenant
      const targetTenant = userTenants?.find((t: any) => t.id === tenantId);
      if (!targetTenant?.slug) {
        console.error("No slug found for tenant", tenantId);
        return;
      }

      // Check if user is super admin
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "super_admin");
      
      const isSuperAdmin = roles && roles.length > 0;
      
      // If super admin, ensure they're a member of the tenant
      if (isSuperAdmin) {
        const { data: existingMembership } = await supabase
          .from("tenant_users")
          .select("id")
          .eq("user_id", userId)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        
        if (!existingMembership) {
          await supabase
            .from("tenant_users")
            .insert({ user_id: userId, tenant_id: tenantId, role: "member" });
        }
      }
      
      // Update active tenant
      await supabase
        .from("user_active_tenant")
        .upsert({
          user_id: userId,
          tenant_id: tenantId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      
      setCurrentTenantId(tenantId);
      
      // Navigate to new tenant dashboard
      navigate(`/t/${targetTenant.slug}/dashboard`, { replace: true });
    } catch (e) {
      console.error("Error switching tenant:", e);
    }
  };

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Filter menu items based on permissions
  const visibleMenuItems = menuItems.filter((item) => {
    // Items without module requirement are always visible (My Profile)
    if (!item.module) return true;

    // While permissions are loading, hide restricted items to avoid leaks
    if (isLoading) return false;

    // All other items require permission check
    return hasPermission(item.module);
  });

  const visibleManagementItems = managementMenuItems.filter((item) => {
    if (isLoading) return false;
    return hasPermission(item.module);
  });

  const visibleSalesItems = salesMenuItems.filter((item) => {
    if (isLoading) return false;
    return hasPermission(item.module);
  });

  return (
    <Sidebar side="right" collapsible="icon" className="transition-all duration-300 ease-in-out">
      <SidebarHeader className="border-b p-2">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2 px-2">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
                ) : (
                  <Building2 className="h-4 w-4 text-sidebar-foreground" />
                )}
                {userTenants && userTenants.length > 1 ? (
                  <Select value={currentTenantId || ""} onValueChange={handleTenantChange}>
                    <SelectTrigger className="h-8 w-[180px] bg-sidebar text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent">
                      <SelectValue placeholder="בחר ארגון" />
                    </SelectTrigger>
                    <SelectContent className="bg-sidebar border-sidebar-border z-[1000]">
                      {userTenants.map((t: any) => (
                        <SelectItem 
                          key={t.id} 
                          value={t.id}
                          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:bg-sidebar-accent focus:text-sidebar-accent-foreground cursor-pointer"
                        >
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-sidebar-foreground">{currentTenantName || "—"}</span>
                )}
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-accent rounded-md transition-colors"
            aria-label={isCollapsed ? "פתח סרגל צד" : "סגור סרגל צד"}
          >
            {isCollapsed ? (
              <PanelRightOpen className="h-4 w-4" />
            ) : (
              <PanelRightClose className="h-4 w-4" />
            )}
          </button>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>תפריט ראשי</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={buildPath(item.path)}
                      end
                      onClick={handleLinkClick}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : ""
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* ניהול - תפריט מתקפל */}
              {visibleManagementItems.length > 0 && (
                <Collapsible className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="ניהול">
                        <Settings className="h-4 w-4" />
                        {!isCollapsed && <span>ניהול</span>}
                        {!isCollapsed && (
                          <ChevronDown className="mr-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {visibleManagementItems.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton asChild>
                              <NavLink
                                to={buildPath(item.path)}
                                end
                                onClick={handleLinkClick}
                                className={({ isActive }) =>
                                  isActive
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                    : ""
                                }
                              >
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {/* ניהול מכירות - תפריט מתקפל */}
              {visibleSalesItems.length > 0 && (
                <Collapsible className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="ניהול מכירות">
                        <DollarSign className="h-4 w-4" />
                        {!isCollapsed && <span>ניהול מכירות</span>}
                        {!isCollapsed && (
                          <ChevronDown className="mr-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {visibleSalesItems.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton asChild>
                              <NavLink
                                to={buildPath(item.path)}
                                onClick={handleLinkClick}
                                className={({ isActive }) =>
                                  isActive
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                    : ""
                                }
                              >
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

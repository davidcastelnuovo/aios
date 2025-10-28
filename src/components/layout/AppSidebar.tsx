import { NavLink } from "react-router-dom";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const menuItems = [
  { title: "סוכנויות", url: "/agencies", icon: Building2, module: "agencies" as const },
  { title: "לקוחות", url: "/clients", icon: Users, module: "clients" as const },
  { title: "משימות", url: "/tasks", icon: CheckSquare, module: "tasks" as const },
  { title: "לקוחות בקליטה", url: "/client-onboarding", icon: UserPlus, module: "client_onboarding" as const },
  { title: "שעון נוכחות", url: "/time-tracking", icon: Clock, module: "time_tracking" as const },
  { title: "צוות", url: "/campaigners", icon: Megaphone, module: "campaigners" as const },
  { title: "ניהול משתמשים", url: "/users", icon: ShieldCheck, module: "users" as const },
  { title: "אזור אישי", url: "/my-profile", icon: User, module: null },
];

const managementMenuItems = [
  { title: "דשבורד", url: "/", icon: LayoutDashboard, module: "dashboard" as const },
  { title: "כספים", url: "/finance", icon: DollarSign, module: "finance" as const },
  { title: "דוחות", url: "/reports", icon: BarChart3, module: "reports" as const },
  { title: "ספקים", url: "/suppliers", icon: Truck, module: "suppliers" as const },
];

const salesMenuItems = [
  { title: "דשבורד מכירות", url: "/sales-dashboard", icon: TrendingUp, module: "sales_dashboard" as const },
  { title: "לידים", url: "/leads", icon: Target, module: "leads" as const },
  { title: "אנשי מכירות", url: "/sales-people", icon: UserCheck, module: "sales_people" as const },
  { title: "אינטגרציות לידים", url: "/lead-integrations", icon: Settings, module: "lead_integrations" as const },
];

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const { hasPermission, isLoading } = useUserPermissions();
  const isCollapsed = state === "collapsed";

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

  const showSuperAdminMenu = false; // TODO: Add super admin check when ready

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>תפריט ראשי</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
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
                                to={item.url}
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
                                to={item.url}
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

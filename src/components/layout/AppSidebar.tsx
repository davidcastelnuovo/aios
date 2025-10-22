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
  useSidebar,
} from "@/components/ui/sidebar";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const menuItems = [
  { title: "דשבורד", url: "/", icon: LayoutDashboard, module: "dashboard" as const },
  { title: "אזור אישי", url: "/my-profile", icon: User, module: null },
  { title: "סוכנויות", url: "/agencies", icon: Building2, module: "agencies" as const },
  { title: "לקוחות", url: "/clients", icon: Users, module: "clients" as const },
  { title: "משימות", url: "/tasks", icon: CheckSquare, module: "tasks" as const },
  { title: "לקוחות בקליטה", url: "/client-onboarding", icon: UserPlus, module: "client_onboarding" as const },
  { title: "שעון נוכחות", url: "/time-tracking", icon: Clock, module: "time_tracking" as const },
  { title: "קמפיינרים", url: "/campaigners", icon: Megaphone, module: "campaigners" as const },
  { title: "ספקים", url: "/suppliers", icon: Truck, module: "suppliers" as const },
  { title: "כספים", url: "/finance", icon: DollarSign, module: "finance" as const },
  { title: "דוחות", url: "/reports", icon: BarChart3, module: "reports" as const },
  { title: "ניהול משתמשים", url: "/users", icon: ShieldCheck, module: null },
];

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const { hasPermission } = useUserPermissions();
  const isCollapsed = state === "collapsed";

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Filter menu items based on permissions
  const visibleMenuItems = menuItems.filter((item) => {
    // Items without module are always visible (like my-profile and users)
    if (!item.module) return true;
    // Check permission for the module
    return hasPermission(item.module);
  });

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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

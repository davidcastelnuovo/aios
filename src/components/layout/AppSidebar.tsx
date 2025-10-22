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
  UserCog,
  UserPlus,
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
import { useUserRole } from "@/hooks/useUserRole";

const menuItems = [
  { title: "דשבורד", url: "/", icon: LayoutDashboard, roles: ["admin", "owner", "agency_manager"] },
  { title: "סוכנויות", url: "/agencies", icon: Building2, roles: ["admin", "user", "owner", "agency_manager"] },
  { title: "לקוחות", url: "/clients", icon: Users, roles: ["admin", "user", "owner", "agency_manager"] },
  { title: "משימות", url: "/tasks", icon: CheckSquare, roles: ["admin", "user", "owner", "agency_manager"] },
  { title: "לקוחות בקליטה", url: "/client-onboarding", icon: UserPlus, roles: ["admin", "user", "owner", "agency_manager"] },
  { title: "שעון נוכחות", url: "/time-tracking", icon: Clock, roles: ["admin", "user", "owner", "agency_manager"] },
  { title: "קמפיינרים", url: "/campaigners", icon: Megaphone, roles: ["admin", "owner", "agency_manager"] },
  { title: "ספקים", url: "/suppliers", icon: Truck, roles: ["owner", "agency_manager"] },
  { title: "כספים", url: "/finance", icon: DollarSign, roles: ["owner", "agency_manager"] },
  { title: "דוחות", url: "/reports", icon: BarChart3, roles: ["admin", "owner", "agency_manager"] },
  { title: "משתמשים", url: "/users", icon: UserCog, roles: ["admin", "owner"] },
];

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const { role, isLoading } = useUserRole();
  const isCollapsed = state === "collapsed";

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter(item => 
    role && item.roles.includes(role)
  );

  if (isLoading) {
    return null;
  }

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>תפריט ראשי</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMenuItems.map((item) => (
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
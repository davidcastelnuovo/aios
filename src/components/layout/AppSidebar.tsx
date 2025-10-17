import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Users,
  Megaphone,
  DollarSign,
  CheckSquare,
  Truck,
  BarChart3,
  UserCog,
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
  { title: "דשבורד", url: "/", icon: LayoutDashboard, roles: ["admin", "owner"] },
  { title: "סוכנויות", url: "/agencies", icon: Building2, roles: ["admin", "user", "owner"] },
  { title: "לקוחות", url: "/clients", icon: Users, roles: ["admin", "user", "owner"] },
  { title: "משימות", url: "/tasks", icon: CheckSquare, roles: ["admin", "user", "owner"] },
  { title: "קמפיינרים", url: "/campaigners", icon: Megaphone, roles: ["admin", "owner"] },
  { title: "ספקים", url: "/suppliers", icon: Truck, roles: ["owner"] },
  { title: "כספים", url: "/finance", icon: DollarSign, roles: ["owner"] },
  { title: "דוחות", url: "/reports", icon: BarChart3, roles: ["admin", "owner"] },
  { title: "משתמשים", url: "/users", icon: UserCog, roles: ["admin", "owner"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { role, isLoading } = useUserRole();
  const isCollapsed = state === "collapsed";

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
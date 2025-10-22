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

const menuItems = [
  { title: "דשבורד", url: "/", icon: LayoutDashboard },
  { title: "אזור אישי", url: "/my-profile", icon: User },
  { title: "סוכנויות", url: "/agencies", icon: Building2 },
  { title: "לקוחות", url: "/clients", icon: Users },
  { title: "משימות", url: "/tasks", icon: CheckSquare },
  { title: "לקוחות בקליטה", url: "/client-onboarding", icon: UserPlus },
  { title: "שעון נוכחות", url: "/time-tracking", icon: Clock },
  { title: "קמפיינרים", url: "/campaigners", icon: Megaphone },
  { title: "ספקים", url: "/suppliers", icon: Truck },
  { title: "כספים", url: "/finance", icon: DollarSign },
  { title: "דוחות", url: "/reports", icon: BarChart3 },
  { title: "ניהול משתמשים", url: "/users", icon: ShieldCheck },
];

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>תפריט ראשי</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
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

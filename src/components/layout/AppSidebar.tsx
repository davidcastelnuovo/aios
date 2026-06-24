import { useState } from "react";
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
  Table,
  Plus,
  Table2,
  MessageSquare,
  MessagesSquare,
  Download,
  PenLine,
  Mail,
  Radar,
  Plug,
  Cpu,
  Share2,
  CalendarRange,
  ShoppingCart,
  BarChart2,
  Globe,
  Home,
  Briefcase,
  Wrench,
  Megaphone as MegaphoneIcon,
  ClipboardList,
  AlertTriangle,
  Send,
  Brain,
  Sparkles,
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

// ─── Icon map ────────────────────────────────────────────────────────────────
const iconMap: Record<string, any> = {
  LayoutDashboard, Users, Building2, CheckSquare,
  FileText: Target, UserPlus, Calendar: Clock, Package,
  Settings, Briefcase: Building, TrendingUp, DollarSign,
  BarChart3, Clock, Megaphone, Target, ShieldCheck, User,
  UserCheck, Truck, Zap, Building, Palette, Bot, Menu,
  ListTree, Table, Table2, MessageSquare, MessagesSquare,
  FolderKanban: Table, Database: Table, Layers: Table,
  FileSignature: PenLine, Mail, Radar, Plug, Cpu, Share2,
  CalendarRange, Home, Globe, BarChart2, Wrench,
};

// ─── Menu structure ───────────────────────────────────────────────────────────
// Imported from a shared module so the Visual Workspace and the sidebar stay in sync.
import { MENU_TABS as BASE_MENU_TABS, type MenuTab, type MenuSection, type MenuTabId } from "@/lib/menuStructure";
import { computeSidebarOverlay } from "@/visual-workspace/hooks/useSitemap";

// Permission map
/**
 * modulePermissions
 * מיפוי בין menu_key (מפתח בתפריט) לבין ModulePermission (הרשאה ב-useUserPermissions).
 * כשמוסיפים מודול עתידי – יש להוסיף כאן שורה בפורמט: "menu-key": "permission_id"
 */
const modulePermissions: Record<string, string> = {
  // ── ניהול שוטף ──────────────────────────────────────────────────────
  dashboard: "dashboard",
  clients: "clients",
  
  tasks: "tasks",
  "time-tracking": "time_tracking",
  recordings: "recordings",
  // ── תקשורת ──────────────────────────────────────────────────────────
  chat: "chat",
  "team-chat": "team_chat",
  gmail: "gmail",
  signatures: "signatures",
  // ── מכירות ──────────────────────────────────────────────────────────
  "sales-dashboard": "sales_dashboard",
  leads: "leads",
  "sales-people": "sales_people",
  campaigners: "campaigners",
  products: "products",
  // ── שיווק ואנליטיקס ─────────────────────────────────────────────────
  marketing: "social_media",
  reports: "finance",
  "dynamic-tables": "dynamic_tables",
  // ── ניהול ארגון ─────────────────────────────────────────────────────
  agencies: "agencies",
  suppliers: "suppliers",
  tenants: "tenants",
  users: "users",
  // ── אוטומציה ו-AI ───────────────────────────────────────────────────
  automations: "automations",
  agents: "agents",
  skins: "agents",
  "carmen-insights": "agents",
  "visual-workspace": "agents",
  // ── אינטגרציות ──────────────────────────────────────────────────────
  "lead-integrations": "lead_integrations",
  integrations: "integrations",
  "chat-integrations": "chat_integrations",
  "manychat-settings": "manychat_settings",
  "green-api-settings": "green_api_settings",
  "manus-wa-settings": "manus_wa_settings",
  "accounting-integrations": "accounting_integrations",
  // ── הגדרות מערכת ────────────────────────────────────────────────────
  branding: "branding",
  "menu-management": "menu_management",
  "fields-management": "fields_management",
  "ai-support": "ai_support",
  // ── כספים ───────────────────────────────────────────────────────────
  finance: "finance",
  // ── מיפויים לתאימות לאחור ────────────────────────────────────────────
  site_analytics: "site_analytics",
  "site-analytics": "site_analytics",
  rank_tracking: "rank_tracking",
  "rank-tracking": "rank_tracking",
  "dmm-dashboard": "crm_dashboard",
};

// ─── Component ────────────────────────────────────────────────────────────────
export function AppSidebar() {
  const { state, setOpenMobile, isMobile, toggleSidebar } = useSidebar();
  const { hasPermission, isLoading } = useUserPermissions();
  const { logoUrl } = useTheme();
  const { buildPath } = useTenantPath();
  const { menuItems: dbMenuItems, isLoading: isLoadingMenuItems } = useMenuItems();
  const isCollapsed = state === "collapsed";
  const [activeTab, setActiveTab] = useState<string>("daily");
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  const { userId } = useCurrentUser();
  const { currentTenantId } = useTenant();
  const { selectedAgency } = useAgency();

  // Build a set of visible menu_keys from DB
  const visibleKeys = new Set<string>(
    dbMenuItems.filter(m => m.is_visible).map(m => m.menu_key)
  );

  // Custom labels from DB
  const customLabels = new Map<string, string>(
    dbMenuItems.filter(m => m.custom_label).map(m => [m.menu_key, m.custom_label!])
  );

  // Apply Visual-Workspace overrides (tab/section labels + module reassignment)
  const overlay = computeSidebarOverlay(dbMenuItems);
  const effectiveTabs: MenuTab[] = BASE_MENU_TABS.map(tab => ({
    ...tab,
    label: overlay.tabLabels.get(tab.id) || tab.label,
    sections: tab.sections.map(section => ({
      ...section,
      label: overlay.sectionLabels.get(`${tab.id}:${section.label}`) || section.label,
      // Drop modules that have been reassigned elsewhere via overlay
      items: section.items.filter(item => {
        const home = overlay.moduleHome.get(item.key);
        return !home || (home.tabId === tab.id && home.sectionLabel === section.label);
      }),
    })),
  }));
  // Insert reassigned modules into their target section
  for (const [moduleKey, target] of overlay.moduleHome) {
    // Find original module
    let original: MenuSection["items"][number] | undefined;
    for (const tab of BASE_MENU_TABS) {
      for (const sec of tab.sections) {
        const m = sec.items.find(i => i.key === moduleKey);
        if (m) { original = m; break; }
      }
      if (original) break;
    }
    if (!original) continue;
    const targetTab = effectiveTabs.find(t => t.id === target.tabId);
    if (!targetTab) continue;
    let targetSection = targetTab.sections.find(s =>
      s.label === target.sectionLabel ||
      (overlay.sectionLabels.get(`${target.tabId}:${target.sectionLabel}`) === s.label)
    );
    if (!targetSection) {
      targetSection = { label: target.sectionLabel, items: [] };
      targetTab.sections.push(targetSection);
    }
    if (!targetSection.items.some(i => i.key === moduleKey)) {
      targetSection.items.push(original);
    }
  }


  const { data: userTenants, isLoading: isLoadingTenants } = useQuery({
    queryKey: ["user-tenants", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("tenant_users")
        .select("tenant_id, tenants(id, name)")
        .eq("user_id", userId);
      if (error) throw error;
      return data?.map(tu => tu.tenants).filter(Boolean) as Array<{ id: string; name: string }>;
    },
    enabled: !!userId,
  });

  // Fetch dynamic CRM tables
  const { data: crmTables } = useQuery({
    queryKey: ["crm-tables", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const response = await supabase.functions.invoke("crm-tables", {
        method: "GET",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.error) return [];
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: !!currentTenantId,
  });

  const handleTenantChange = async (newTenantId: string) => {
    if (!userId) return;
    try {
      const { data: newTenant } = await supabase
        .from("tenants").select("slug").eq("id", newTenantId).single();
      await supabase.from("user_active_tenant").upsert(
        { user_id: userId, tenant_id: newTenantId, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (newTenant?.slug) {
        const currentPath = window.location.pathname;
        const pathMatch = currentPath.match(/^\/t\/[^/]+\/(.+)$/);
        const currentModule = pathMatch ? pathMatch[1] : "dashboard";
        window.location.href = `/t/${newTenant.slug}/${currentModule}`;
      } else {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Error changing tenant:", error);
    }
  };

  const handleLinkClick = () => {
    if (isMobile && setOpenMobile) setOpenMobile(false);
  };

  const canAccess = (key: string) => {
    if (key === "my-profile") return true;
    const perm = modulePermissions[key];
    if (!perm) return false;
    return hasPermission(perm as any);
  };

  const getLabel = (key: string, fallback: string) =>
    customLabels.get(key) || fallback;

  // Filter items in a section to only those the user can access and are visible
  const filterItems = (items: MenuSection["items"]) =>
    items.filter(item => {
      // If DB has this key and it's hidden, skip
      if (dbMenuItems.some(m => m.menu_key === item.key) && !visibleKeys.has(item.key)) return false;
      return canAccess(item.key);
    });

  const activeMenuTab = effectiveTabs.find(t => t.id === activeTab) || effectiveTabs[0];

  if (isLoadingMenuItems || isLoading) return null;

  return (
    <Sidebar collapsible="icon" side="right">
      {/* ── Header ── */}
      <SidebarHeader className="border-b border-sidebar-border">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 py-2">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
            ) : (
              <Building2 className="h-8 w-8" />
            )}
            {/* Tab icons in collapsed mode */}
            {effectiveTabs.map(tab => {
              const TabIcon = tab.icon;
              return (
                <Tooltip key={tab.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { setActiveTab(tab.id); if (isCollapsed) toggleSidebar(); }}
                      className={`p-2 rounded-md transition-colors ${
                        activeTab === tab.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-sidebar-accent"
                      }`}
                    >
                      <TabIcon className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">{tab.label}</TooltipContent>
                </Tooltip>
              );
            })}
            <button
              onClick={toggleSidebar}
              className="p-2 hover:bg-sidebar-accent rounded-md transition-colors"
            >
              <PanelRightOpen className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 px-2 py-2" dir="rtl">
            {/* Top row: logo + tenant + collapse */}
            <div className="flex items-center justify-between">
              <button
                onClick={toggleSidebar}
                className="flex-shrink-0 p-1.5 hover:bg-sidebar-accent rounded-md transition-colors"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                {userTenants && userTenants.length > 1 && (
                  <Select value={currentTenantId || undefined} onValueChange={handleTenantChange}>
                    <SelectTrigger className="h-7 border-0 shadow-none focus:ring-0 min-w-0 bg-sidebar-background text-xs">
                      <SelectValue placeholder="בחר ארגון" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border shadow-lg z-[9999]" position="popper" sideOffset={4} align="start" side="bottom">
                      {userTenants.filter(t => t.id).map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
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

            {/* Tab switcher — 3 main tabs */}
            <div className="flex gap-1 bg-sidebar-accent/40 rounded-lg p-1">
              {effectiveTabs.filter(t => t.id !== "daily").map(tab => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <TabIcon className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Daily tab — separate row */}
            {(() => {
              const dailyTab = effectiveTabs.find(t => t.id === "daily")!;
              const DailyIcon = dailyTab.icon;
              const isActive = activeTab === "daily";
              return (
                <button
                  onClick={() => setActiveTab("daily")}
                  className={`w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                  }`}
                >
                  <DailyIcon className="h-3.5 w-3.5" />
                  <span>{dailyTab.label}</span>
                </button>
              );
            })()}
          </div>
        )}
      </SidebarHeader>

      {/* ── Content ── */}
      <SidebarContent>
        {/* Home link */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={isCollapsed ? "בית" : undefined}>
                  <NavLink
                    to={buildPath("home")}
                    onClick={handleLinkClick}
                    className={({ isActive }) =>
                      isActive
                        ? "flex items-center gap-2 w-full bg-sidebar-accent text-sidebar-accent-foreground"
                        : "flex items-center gap-2 w-full hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }
                    dir="rtl"
                  >
                    {!isCollapsed && <span className="flex-1 text-right">בית</span>}
                    <Home className="h-4 w-4" />
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Active tab sections */}
        {activeMenuTab.sections.map(section => {
          const visibleItems = filterItems(section.items);
          if (visibleItems.length === 0) return null;
          return (
            <Collapsible key={section.label} defaultOpen className="group/collapsible">
              <SidebarGroup>
                {!isCollapsed && (
                  <SidebarGroupLabel asChild>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full hover:bg-accent/50 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide" dir="rtl">
                      <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-180 ml-auto" />
                      <span className="flex-1 text-right">{section.label}</span>
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                )}
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {visibleItems.map(item => {
                        const Icon = item.icon;
                        const label = getLabel(item.key, item.label);
                        return (
                          <SidebarMenuItem key={item.key}>
                            <SidebarMenuButton asChild tooltip={isCollapsed ? label : undefined}>
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
        })}

        {/* Dynamic CRM Tables — shown in marketing tab */}
        {activeTab === "marketing" && hasPermission("dynamic_tables") && (() => {
          const filteredCrmTables = (crmTables || []).filter((table: any) => {
            if (!selectedAgency || selectedAgency === "all") return true;
            return table.agency_id === null || table.agency_id === selectedAgency;
          });
          return (
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <div className="flex items-center justify-between">
                    <CollapsibleTrigger className="flex items-center gap-2 flex-1 hover:bg-accent rounded-md px-2 py-1" dir="rtl">
                      <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180 ml-auto" />
                      {!isCollapsed && <span className="flex-1 text-right">טבלאות דינמיות</span>}
                      <Table2 className="h-4 w-4" />
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
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={buildPath("dynamic-tables")}
                            onClick={handleLinkClick}
                            className={({ isActive }) =>
                              isActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            }
                          >
                            <Settings className="h-4 w-4" />
                            {!isCollapsed && <span>ניהול דוחות</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
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
      <SimpleTableDialog open={isQuickCreateOpen} onOpenChange={setIsQuickCreateOpen} />
    </Sidebar>
  );
}

// ─── PWA Install Button ───────────────────────────────────────────────────────
function InstallAppButton({ isCollapsed }: { isCollapsed: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useState(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    if (window.matchMedia("(display-mode: standalone)").matches) setIsInstalled(true);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  });

  if (isInstalled || !deferredPrompt) return null;

  return (
    <div className="p-2 border-t border-sidebar-border">
      <button
        onClick={async () => {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === "accepted") setIsInstalled(true);
          setDeferredPrompt(null);
        }}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-sidebar-accent transition-colors"
        dir="rtl"
      >
        {!isCollapsed && <span className="flex-1 text-right">התקן אפליקציה</span>}
        <Download className="h-4 w-4" />
      </button>
    </div>
  );
}

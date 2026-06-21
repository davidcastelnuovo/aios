/**
 * Single source of truth for the sidebar / sitemap structure.
 * Both AppSidebar and the Visual Workspace consume this catalog.
 *
 * Override mechanism (stored per-tenant in `menu_items`):
 *   - menu_key === module key            → custom_label / is_visible / sort_order / parent_menu_key
 *   - menu_key === `tab:<tabId>`         → custom_label for a tab name
 *   - menu_key === `section:<tabId>:<sectionLabel>` → custom_label for a section name
 *   - parent_menu_key on a module row, when shaped as `tab:<tabId>:<sectionLabel>`,
 *     reassigns that module to a different tab+section (drag-and-drop in workspace)
 */
import {
  LayoutDashboard, Building2, Users, Megaphone, DollarSign, CheckSquare, Clock,
  Truck, BarChart3, User, UserPlus, ShieldCheck, UserCheck, Target, TrendingUp,
  Settings, Building, Zap, Package, Palette, Bot, Menu, ListTree, Table, Table2,
  MessageSquare, MessagesSquare, PenLine, Mail, Plug, Cpu, Share2, Home, Briefcase,
  ClipboardList, AlertTriangle, Send, Brain, Sparkles, Globe, ShoppingCart,
  CalendarRange, FileText, type LucideIcon,
} from "lucide-react";

export type MenuTabId = "daily" | "sales" | "marketing" | "admin";

export type MenuModule = {
  key: string;
  label: string;
  route: string;
  icon: LucideIcon;
};

export type MenuSection = {
  label: string;
  items: MenuModule[];
};

export type MenuTab = {
  id: MenuTabId;
  label: string;
  icon: LucideIcon;
  sections: MenuSection[];
};

export const MENU_TABS: MenuTab[] = [
  {
    id: "daily",
    label: "ניהול שוטף",
    icon: ClipboardList,
    sections: [
      {
        label: "לקוחות",
        items: [
          { key: "clients", label: "לקוחות", route: "/clients", icon: Users },
          { key: "dmm-dashboard", label: "דשבורד CRM סוכנות", route: "/dmm-dashboard", icon: LayoutDashboard },
          { key: "client-onboarding", label: "לקוחות בקליטה", route: "/client-onboarding", icon: UserPlus },
          { key: "tasks", label: "משימות", route: "/tasks", icon: CheckSquare },
          { key: "time-tracking", label: "מעקב זמני עבודה", route: "/time-tracking", icon: Clock },
        ],
      },
      {
        label: "צוות",
        items: [
          { key: "campaigners", label: "קמפיינרים", route: "/campaigners", icon: Megaphone },
        ],
      },
      {
        label: "תקשורת",
        items: [
          { key: "chat", label: "צ'אט", route: "/chat", icon: MessageSquare },
          { key: "team-chat", label: "צ'אט צוות", route: "/team-chat", icon: MessagesSquare },
        ],
      },
    ],
  },
  {
    id: "sales",
    label: "מכירות",
    icon: TrendingUp,
    sections: [
      {
        label: "מכירות",
        items: [
          { key: "sales-dashboard", label: "דשבורד מכירות", route: "/sales-dashboard", icon: TrendingUp },
          { key: "leads", label: "לידים", route: "/leads", icon: Target },
        ],
      },
      {
        label: "צוות מכירות",
        items: [
          { key: "sales-people", label: "אנשי מכירות", route: "/sales-people", icon: UserCheck },
        ],
      },
      {
        label: "כלים",
        items: [
          { key: "products", label: "מוצרים ושירותים", route: "/products", icon: Package },
          { key: "lead-integrations", label: "אינטגרציות לידים", route: "/lead-integrations", icon: Plug },
        ],
      },
    ],
  },
  {
    id: "marketing",
    label: "שיווק",
    icon: Share2,
    sections: [
      {
        label: "קמפיינים",
        items: [
          { key: "social-media", label: "ניהול סושיאל", route: "/social-media", icon: Share2 },
          { key: "recordings", label: "הקלטות", route: "/recordings", icon: Cpu },
        ],
      },
      {
        label: "אנליטיקס",
        items: [
          { key: "dynamic-tables", label: "דשבורדים ודוחות", route: "/dynamic-tables", icon: Table2 },
          { key: "ai-detection", label: "ניטור נראות AI", route: "/ai-detection", icon: Bot },
        ],
      },
      {
        label: "תקשורת",
        items: [
          { key: "gmail", label: "Gmail", route: "/gmail", icon: Mail },
          { key: "signatures", label: "חתימות", route: "/signatures", icon: PenLine },
        ],
      },
      {
        label: "אינטגרציות",
        items: [
          { key: "integrations", label: "אינטגרציות", route: "/integrations", icon: Plug },
          { key: "chat-integrations", label: "אינטגרציות צ'אט", route: "/chat-integrations", icon: MessageSquare },
        ],
      },
    ],
  },
  {
    id: "admin",
    label: "ניהול",
    icon: Settings,
    sections: [
      {
        label: "ניהול",
        items: [
          { key: "dashboard", label: "דשבורד", route: "/dashboard", icon: LayoutDashboard },
          { key: "tenants", label: "ניהול ארגונים", route: "/tenants", icon: Building },
          { key: "agencies", label: "סוכנויות", route: "/agencies", icon: Building2 },
          { key: "users", label: "משתמשים", route: "/users", icon: Users },
          { key: "suppliers", label: "ספקים", route: "/suppliers", icon: Truck },
        ],
      },
      {
        label: "כספים",
        items: [
          { key: "accounting-integrations", label: "הנהלת חשבונות", route: "/accounting-integrations", icon: BarChart3 },
        ],
      },
      {
        label: "אוטומציה ו-AI",
        items: [
          { key: "automations", label: "אוטומציות", route: "/automations", icon: Zap },
          { key: "campaign-alerts", label: "התראות קמפיינים", route: "/campaign-alerts", icon: AlertTriangle },
          { key: "social-publisher", label: "רשתות חברתיות", route: "/social-publisher", icon: Send },
          { key: "agents", label: "סוכני AI", route: "/agents", icon: Bot },
          { key: "carmen-insights", label: "למידה של כרמן", route: "/carmen-insights", icon: Brain },
          { key: "visual-workspace", label: "Visual Workspace", route: "/visual-workspace", icon: Sparkles },
        ],
      },
      {
        label: "הגדרות",
        items: [
          { key: "my-profile", label: "אזור אישי", route: "/my-profile", icon: User },
          { key: "branding", label: "התאמת מערכת", route: "/branding", icon: Palette },
          { key: "menu-management", label: "ניהול תפריטים", route: "/menu-management", icon: Menu },
          { key: "fields-management", label: "ניהול שדות", route: "/fields-management", icon: ListTree },
          { key: "ai-support", label: "תמיכה טכנית AI", route: "/ai-support", icon: ShieldCheck },
        ],
      },
    ],
  },
];

/** Routes that exist in App.tsx but are sub-pages / settings of another module.
 *  Drawn in workspace as connected to their parent via a secondary line.
 */
export const SUB_MODULES: Array<MenuModule & { parentKey: string }> = [
  { key: "social-gantt", parentKey: "social-media", label: "סושיאל גאנט", route: "/social-gantt", icon: CalendarRange },
  { key: "social", parentKey: "social-media", label: "סושיאל", route: "/social", icon: Share2 },
  { key: "gmail-settings", parentKey: "gmail", label: "הגדרות Gmail", route: "/gmail-settings", icon: Settings },
  { key: "agent-tasks", parentKey: "agents", label: "משימות סוכן", route: "/agent-tasks", icon: CheckSquare },
  { key: "manus-tasks", parentKey: "agents", label: "Manus Tasks", route: "/manus-tasks", icon: CheckSquare },
  { key: "github-agent", parentKey: "agents", label: "GitHub Agent", route: "/github-agent", icon: Bot },
  { key: "rank-tracking", parentKey: "ai-detection", label: "מעקב מיקומים", route: "/rank-tracking", icon: Target },
  { key: "site-analytics", parentKey: "dynamic-tables", label: "אנליטיקס אתרים", route: "/site-analytics", icon: BarChart3 },
  { key: "accounting-settings", parentKey: "accounting-integrations", label: "הגדרות הנה״ח", route: "/accounting-settings", icon: Settings },
];

/** Settings pages reachable only from /integrations or /lead-integrations.
 *  Shown in workspace as connected to their parent module.
 */
export const INTEGRATION_SETTINGS: Array<MenuModule & { parentKey: string }> = [
  { key: "manychat-settings", parentKey: "chat-integrations", label: "ManyChat", route: "/manychat-settings", icon: MessageSquare },
  { key: "green-api-settings", parentKey: "chat-integrations", label: "Green API", route: "/green-api-settings", icon: MessageSquare },
  { key: "manus-wa-settings", parentKey: "chat-integrations", label: "Manus WA", route: "/manus-wa-settings", icon: MessageSquare },
  { key: "telegram-settings", parentKey: "chat-integrations", label: "Telegram", route: "/telegram-settings", icon: Send },
  { key: "facebook-settings", parentKey: "lead-integrations", label: "Facebook", route: "/facebook-settings", icon: Globe },
  { key: "google-ads-settings", parentKey: "lead-integrations", label: "Google Ads", route: "/google-ads-settings", icon: Globe },
  { key: "google-analytics-settings", parentKey: "lead-integrations", label: "Google Analytics", route: "/google-analytics-settings", icon: BarChart3 },
  { key: "google-search-console-settings", parentKey: "lead-integrations", label: "Search Console", route: "/google-search-console-settings", icon: Globe },
  { key: "ahrefs-settings", parentKey: "lead-integrations", label: "Ahrefs", route: "/ahrefs-settings", icon: BarChart3 },
  { key: "tiktok-settings", parentKey: "lead-integrations", label: "TikTok", route: "/tiktok-settings", icon: Share2 },
  { key: "make-settings", parentKey: "lead-integrations", label: "Make", route: "/make-settings", icon: Plug },
  { key: "serpapi-settings", parentKey: "lead-integrations", label: "SerpAPI", route: "/integrations/serpapi", icon: Globe },
  { key: "zoom-settings", parentKey: "lead-integrations", label: "Zoom", route: "/zoom-settings", icon: CalendarRange },
  { key: "telephony-settings", parentKey: "lead-integrations", label: "טלפוניה", route: "/telephony-settings", icon: MessageSquare },
  { key: "maskyoo-settings", parentKey: "lead-integrations", label: "Maskyoo", route: "/maskyoo-settings", icon: MessageSquare },
  { key: "wordpress-settings", parentKey: "lead-integrations", label: "WordPress", route: "/wordpress-settings", icon: Globe },
  { key: "manus-settings", parentKey: "agents", label: "Manus", route: "/manus-settings", icon: Bot },
  { key: "unified-settings", parentKey: "lead-integrations", label: "Unified.to", route: "/unified-settings", icon: Plug },
];

/** Routes that exist in App.tsx but have no clear path from the sidebar.
 *  Surfaced under "אין דרך ישירה" in the visual workspace.
 */
export const ORPHAN_MODULES: MenuModule[] = [
  { key: "home", label: "בית", route: "/home", icon: Home },
  { key: "landing-page-submissions", label: "פניות מדפי נחיתה", route: "/landing-page-submissions", icon: FileText },
  { key: "finance", label: "כספים", route: "/finance", icon: DollarSign },
];

export type SectionKey = `${MenuTabId}:${string}`;

export function sectionKey(tabId: MenuTabId, sectionLabel: string): SectionKey {
  return `${tabId}:${sectionLabel}` as SectionKey;
}

/** Decode a parent_menu_key shaped `tab:<tabId>:<sectionLabel>` */
export function parseParentMenuKey(parentMenuKey: string | null | undefined):
  | { tabId: MenuTabId; sectionLabel: string }
  | null {
  if (!parentMenuKey || !parentMenuKey.startsWith("tab:")) return null;
  const rest = parentMenuKey.slice(4);
  const i = rest.indexOf(":");
  if (i === -1) return null;
  return { tabId: rest.slice(0, i) as MenuTabId, sectionLabel: rest.slice(i + 1) };
}

export function buildParentMenuKey(tabId: MenuTabId, sectionLabel: string): string {
  return `tab:${tabId}:${sectionLabel}`;
}

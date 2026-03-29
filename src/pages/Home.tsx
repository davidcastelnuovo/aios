import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  LayoutDashboard, Building2, Users, Megaphone, DollarSign,
  CheckSquare, Clock, Truck, BarChart3, UserCheck, Target,
  TrendingUp, Settings, Building, Zap, Package, Palette, Bot,
  Menu, ListTree, Table2, MessageSquare, MessagesSquare,
  PenLine, Mail, Radar, Plug, Share2, UserPlus, ShieldCheck,
  BarChart2, Home as HomeIcon,
} from "lucide-react";

// ─── Module definitions ───────────────────────────────────────────────────────
type ModuleItem = {
  key: string;
  label: string;
  description: string;
  route: string;
  icon: any;
  permission?: string;
  color: string;
};

type Category = {
  id: string;
  label: string;
  icon: any;
  color: string;
  modules: ModuleItem[];
};

const CATEGORIES: Category[] = [
  {
    id: "sales",
    label: "ניהול מכירות",
    icon: TrendingUp,
    color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
    modules: [
      { key: "sales-dashboard", label: "דשבורד מכירות", description: "סקירה כללית של ביצועי המכירות", route: "/sales-dashboard", icon: TrendingUp, permission: "sales_dashboard", color: "bg-emerald-500/10 text-emerald-600" },
      { key: "leads", label: "לידים", description: "ניהול לידים ומעקב אחר תהליך המכירה", route: "/leads", icon: Target, permission: "leads", color: "bg-emerald-500/10 text-emerald-600" },
      { key: "sales-people", label: "אנשי מכירות", description: "ניהול צוות המכירות", route: "/sales-people", icon: UserCheck, permission: "sales_people", color: "bg-emerald-500/10 text-emerald-600" },
      { key: "campaigners", label: "קמפיינרים", description: "ניהול קמפיינרים וסוכנויות", route: "/campaigners", icon: Megaphone, permission: "campaigners", color: "bg-emerald-500/10 text-emerald-600" },
      { key: "products", label: "מוצרים ושירותים", description: "קטלוג מוצרים ומחירים", route: "/products", icon: Package, permission: "leads", color: "bg-emerald-500/10 text-emerald-600" },
    ],
  },
  {
    id: "clients",
    label: "לקוחות",
    icon: Users,
    color: "from-teal-500/20 to-teal-600/10 border-teal-500/30",
    modules: [
      { key: "clients", label: "לקוחות", description: "ניהול לקוחות ופרטי קשר", route: "/clients", icon: Users, permission: "clients", color: "bg-teal-500/10 text-teal-600" },
      { key: "client-onboarding", label: "לקוחות בקליטה", description: "תהליך קליטת לקוחות חדשים", route: "/client-onboarding", icon: UserPlus, permission: "client_onboarding", color: "bg-teal-500/10 text-teal-600" },
      { key: "tasks", label: "משימות", description: "ניהול משימות ומעקב התקדמות", route: "/tasks", icon: CheckSquare, permission: "tasks", color: "bg-teal-500/10 text-teal-600" },
    ],
  },
  {
    id: "marketing",
    label: "שיווק ודיגיטל",
    icon: Share2,
    color: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
    modules: [
      { key: "social-media", label: "ניהול סושיאל", description: "תזמון פוסטים וניהול ערוצי סושיאל", route: "/social-media", icon: Share2, permission: "dashboard", color: "bg-blue-500/10 text-blue-600" },

      { key: "reports", label: "דוחות", description: "דוחות מותאמים אישית", route: "/reports", icon: BarChart2, permission: "reports", color: "bg-blue-500/10 text-blue-600" },
      { key: "dynamic-tables", label: "דשבורדים ודוחות", description: "בניית דשבורדים ודוחות דינמיים", route: "/dynamic-tables", icon: Table2, permission: "dynamic_tables", color: "bg-blue-500/10 text-blue-600" },
      { key: "ai-detection", label: "ניטור נראות AI", description: "ניטור נראות המותג במנועי AI", route: "/ai-detection", icon: Bot, permission: "dashboard", color: "bg-blue-500/10 text-blue-600" },
      { key: "chat", label: "צ'אט", description: "ניהול שיחות עם לקוחות", route: "/chat", icon: MessageSquare, permission: "chat", color: "bg-blue-500/10 text-blue-600" },
      { key: "gmail", label: "Gmail", description: "ניהול דואר אלקטרוני", route: "/gmail", icon: Mail, color: "bg-blue-500/10 text-blue-600" },
      { key: "signatures", label: "חתימות", description: "ניהול חתימות דיגיטליות", route: "/signatures", icon: PenLine, permission: "signatures", color: "bg-blue-500/10 text-blue-600" },
      { key: "team-chat", label: "צ'אט צוות", description: "תקשורת פנים-ארגונית", route: "/team-chat", icon: MessagesSquare, permission: "team_chat", color: "bg-blue-500/10 text-blue-600" },
      { key: "integrations", label: "אינטגרציות", description: "חיבורים לפלטפורמות חיצוניות", route: "/integrations", icon: Plug, permission: "lead_integrations", color: "bg-blue-500/10 text-blue-600" },
      { key: "recordings", label: "הקלטות", description: "ניהול הקלטות שיחות", route: "/recordings", icon: Plug, permission: "recordings", color: "bg-blue-500/10 text-blue-600" },
    ],
  },
  {
    id: "admin",
    label: "ניהול מערכת",
    icon: Settings,
    color: "from-violet-500/20 to-violet-600/10 border-violet-500/30",
    modules: [
      { key: "dashboard", label: "דשבורד", description: "סקירה כללית של המערכת", route: "/dashboard", icon: LayoutDashboard, permission: "dashboard", color: "bg-violet-500/10 text-violet-600" },
      { key: "tenants", label: "ניהול ארגונים", description: "ניהול ארגונים וסוכנויות", route: "/tenants", icon: Building, permission: "tenants", color: "bg-violet-500/10 text-violet-600" },
      { key: "agencies", label: "סוכנויות", description: "ניהול סוכנויות ושיוכים", route: "/agencies", icon: Building2, permission: "agencies", color: "bg-violet-500/10 text-violet-600" },
      { key: "users", label: "משתמשים", description: "ניהול משתמשים והרשאות", route: "/users", icon: Users, permission: "users", color: "bg-violet-500/10 text-violet-600" },
      { key: "suppliers", label: "ספקים", description: "ניהול ספקים וחוזים", route: "/suppliers", icon: Truck, permission: "suppliers", color: "bg-violet-500/10 text-violet-600" },
      { key: "finance", label: "כספים", description: "ניהול כספי ותשלומים", route: "/finance", icon: DollarSign, permission: "finance", color: "bg-violet-500/10 text-violet-600" },
      { key: "accounting-integrations", label: "הנהלת חשבונות", description: "אינטגרציות לתוכנות חשבונאות", route: "/accounting-integrations", icon: BarChart3, permission: "accounting", color: "bg-violet-500/10 text-violet-600" },
      { key: "time-tracking", label: "מעקב זמן", description: "מעקב שעות עבודה", route: "/time-tracking", icon: Clock, permission: "time_tracking", color: "bg-violet-500/10 text-violet-600" },
      { key: "automations", label: "אוטומציות", description: "בניית תהליכים אוטומטיים", route: "/automations", icon: Zap, permission: "automations", color: "bg-violet-500/10 text-violet-600" },
      { key: "agents", label: "סוכני AI", description: "ניהול סוכני בינה מלאכותית", route: "/agents", icon: Bot, color: "bg-violet-500/10 text-violet-600" },
      { key: "branding", label: "התאמת מערכת", description: "עיצוב ומיתוג המערכת", route: "/branding", icon: Palette, permission: "branding", color: "bg-violet-500/10 text-violet-600" },
      { key: "menu-management", label: "ניהול תפריטים", description: "הגדרת תפריטי הניווט", route: "/menu-management", icon: Menu, permission: "menu_management", color: "bg-violet-500/10 text-violet-600" },
      { key: "fields-management", label: "ניהול שדות", description: "הגדרת שדות מותאמים אישית", route: "/fields-management", icon: ListTree, permission: "fields_management", color: "bg-violet-500/10 text-violet-600" },
      { key: "ai-support", label: "תמיכה טכנית AI", description: "תמיכה טכנית מבוססת AI", route: "/ai-support", icon: ShieldCheck, color: "bg-violet-500/10 text-violet-600" },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const { hasPermission } = useUserPermissions();

  const canAccess = (permission?: string) => {
    if (!permission) return true;
    return hasPermission(permission as any);
  };

  const handleNavigate = (route: string) => {
    navigate(buildPath(route));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <HomeIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">ברוכים הבאים</h1>
            <p className="text-muted-foreground text-sm">בחר מודול להתחלה</p>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-10">
        {CATEGORIES.map(category => {
          const CategoryIcon = category.icon;
          const accessibleModules = category.modules.filter(m => canAccess(m.permission));
          if (accessibleModules.length === 0) return null;

          return (
            <div key={category.id}>
              {/* Category header */}
              <div className="flex items-center gap-2 mb-4">
                <div className={`p-1.5 rounded-md bg-gradient-to-br ${category.color} border`}>
                  <CategoryIcon className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-semibold">{category.label}</h2>
                <div className="flex-1 h-px bg-border mr-2" />
              </div>

              {/* Module cards grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {accessibleModules.map(module => {
                  const ModuleIcon = module.icon;
                  return (
                    <button
                      key={module.key}
                      onClick={() => handleNavigate(module.route)}
                      className="group flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/30 hover:shadow-md transition-all duration-200 text-center"
                    >
                      <div className={`p-2.5 rounded-lg ${module.color} group-hover:scale-110 transition-transform duration-200`}>
                        <ModuleIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-tight">{module.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-tight line-clamp-2 hidden sm:block">
                          {module.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

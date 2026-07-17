/**
 * modules.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * מקור האמת היחיד לכל המודולים / הרשאות במערכת.
 *
 * ה-catalog נגזר אוטומטית ממבנה התפריט (menuStructure.ts):
 *   tab   → PermissionCategory
 *   module → ModuleConfig (id = permissionForMenuKey(key))
 *
 * כדי להוסיף מודול עתידי:
 *  1. הוסף אותו ל-MENU_TABS ב-menuStructure.ts (עם `permission` רק אם ה-id
 *     שונה מברירת המחדל key.replace(/-/g, "_"))
 *  2. הוסף Route ב-App.tsx עם requiredPermission
 * זהו — הסרגל, דיאלוג ההרשאות וה-catalog מתעדכנים אוטומטית.
 * הרשאות ללא מודול בתפריט מוגדרות ב-EXTRA_PERMISSIONS למטה.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { MENU_TABS, ORPHAN_MODULES, permissionForMenuKey } from "./menuStructure";

export interface ModuleConfig {
  /** מזהה ייחודי – permission id (snake_case) */
  id: string;
  /** תווית לתצוגה בעברית */
  label: string;
  /** תיאור קצר המוצג בדיאלוג ההרשאות */
  description: string;
  /** קטגוריה – חייב להתאים ל-id של PermissionCategory */
  category: string;
}

export interface PermissionCategory {
  /** מזהה קטגוריה */
  id: string;
  /** כותרת לתצוגה */
  label: string;
  /** תיאור קצר */
  description?: string;
  /** מודולים השייכים לקטגוריה זו */
  modules: ModuleConfig[];
}

// ─────────────────────────────────────────────────────────────────────────────
// תיאורים (משמרים את הטקסטים מה-catalog הידני הקודם)
// ─────────────────────────────────────────────────────────────────────────────

const DESCRIPTIONS: Record<string, string> = {
  dashboard: "צפייה בדשבורד הראשי",
  crm_dashboard: "דשבורד ניהול לקוחות עם Health Score ודגלים",
  clients: "צפייה ועריכת לקוחות",
  client_onboarding: "ניהול תהליך קליטת לקוחות חדשים",
  tasks: "ניהול משימות",
  time_tracking: "שעון נוכחות ומעקב שעות",
  recordings: "ניהול הקלטות מכל המקורות",
  chat: "מודול צ'אט עם לקוחות ולידים",
  team_chat: "תקשורת פנים-ארגונית בסגנון Slack",
  gmail: "שליחת וקבלת מיילים דרך Gmail",
  signatures: "ניהול מסמכים וחתימות דיגיטליות",
  sales_dashboard: "דשבורד ייעודי למכירות",
  leads: "צפייה ועריכת לידים",
  sales_people: "צפייה ועריכת אנשי מכירות",
  campaigners: "צפייה ועריכת קמפיינרים",
  products: "ניהול מוצרים ושירותים",
  social_media: "ניהול פוסטים ולוח שנה לרשתות חברתיות",
  campaign_alerts: "התראות וניטור קמפיינים",
  broadcast: "שליחת דיוור המוני ללקוחות, לידים וצוות בערוצי WhatsApp",
  dynamic_tables: "יצירת דשבורדים וטבלאות מותאמות אישית",
  site_analytics: "מעקב אנליטיקס ונתוני אתר",
  rank_tracking: "מעקב דירוגי מילות מפתח בגוגל",
  ai_detection: "מעקב אחר נראות המותג במנועי AI",
  agencies: "צפייה ועריכת סוכנויות",
  suppliers: "צפייה ועריכת ספקים",
  tenants: "ניהול ארגונים ומנויים (מנהל בלבד)",
  users: "הוספה ועריכת משתמשים",
  automations: "הגדרת אוטומציות מבוססות טריגרים",
  agents: "ניהול והפעלת סוכני AI",
  integrations: "גישה למסך האינטגרציות המרכזי",
  lead_integrations: "ניהול אינטגרציות לידים, פייסבוק, גוגל ועוד",
  chat_integrations: "ניהול אינטגרציות צ'אט",
  manychat_settings: "אינטגרציה עם ManyChat",
  green_api_settings: "אינטגרציה עם Green API (WhatsApp)",
  manus_wa_settings: "אינטגרציה עם Manus WA (WhatsApp)",
  accounting_integrations: "חיבור למערכות הנהלת חשבונות",
  branding: "התאמת לוגו, צבעים ומראה המערכת",
  menu_management: "התאמת תפריט הניווט",
  fields_management: "הוספת שדות מותאמים אישית",
  ai_support: "גישה לצ'אטבוט AI לתמיכה טכנית",
  finance: "גישה מלאה לניהול פיננסי",
  finance_view: "הרשאת צפייה בנתונים פיננסיים בלבד (ללא עריכה)",
  home: "עמוד הבית",
  landing_page_submissions: "פניות מדפי נחיתה",
};

/** תוויות עדיפות ל-catalog (כשהתווית בתפריט קצרה/שונה מהתווית בדיאלוג ההרשאות) */
const LABEL_OVERRIDES: Record<string, string> = {
  clients: "ניהול לקוחות",
  time_tracking: "מעקב זמן",
  signatures: "חתימות דיגיטליות",
  leads: "ניהול לידים",
  sales_people: "ניהול אנשי מכירות",
  campaigners: "ניהול קמפיינרים",
  social_media: "ניהול סושיאל",
  agencies: "ניהול סוכנויות",
  suppliers: "ניהול ספקים",
  users: "ניהול משתמשים",
  branding: "ברנדינג והתאמת מערכת",
  finance: "ניהול כספים",
};

/** מפתחות תפריט שאינם הרשאה (נגישים תמיד) — לא נכללים ב-catalog */
const NON_PERMISSION_MENU_KEYS = new Set(["my-profile"]);

// ─────────────────────────────────────────────────────────────────────────────
// הרשאות ללא מודול בתפריט (catalog-only)
// ─────────────────────────────────────────────────────────────────────────────

export const EXTRA_PERMISSIONS: ModuleConfig[] = [
  { id: "client_onboarding", label: "קליטת לקוחות", description: DESCRIPTIONS.client_onboarding, category: "daily" },
  { id: "site_analytics", label: "אנליטיקס אתרים", description: DESCRIPTIONS.site_analytics, category: "marketing" },
  { id: "rank_tracking", label: "מעקב דירוגים", description: DESCRIPTIONS.rank_tracking, category: "marketing" },
  { id: "ai_detection", label: "ניטור נראות AI", description: DESCRIPTIONS.ai_detection, category: "marketing" },
  { id: "manychat_settings", label: "הגדרות ManyChat", description: DESCRIPTIONS.manychat_settings, category: "marketing" },
  { id: "green_api_settings", label: "הגדרות Green API", description: DESCRIPTIONS.green_api_settings, category: "marketing" },
  { id: "manus_wa_settings", label: "הגדרות Manus WA", description: DESCRIPTIONS.manus_wa_settings, category: "marketing" },
  { id: "finance_view", label: "צפייה בנתונים פיננסיים", description: DESCRIPTIONS.finance_view, category: "special" },
];

// ─────────────────────────────────────────────────────────────────────────────
// יצירת ה-catalog מהתפריט
// ─────────────────────────────────────────────────────────────────────────────

function buildPermissionCategories(): PermissionCategory[] {
  const seen = new Set<string>();
  const categories: PermissionCategory[] = [];
  const categoryById = new Map<string, PermissionCategory>();

  const ensureCategory = (id: string, label: string, description?: string): PermissionCategory => {
    let cat = categoryById.get(id);
    if (!cat) {
      cat = { id, label, description, modules: [] };
      categoryById.set(id, cat);
      categories.push(cat);
    }
    return cat;
  };

  const addModule = (cat: PermissionCategory, id: string, menuLabel: string) => {
    if (seen.has(id)) return; // dedupe by permission id — first label wins
    seen.add(id);
    cat.modules.push({
      id,
      label: LABEL_OVERRIDES[id] ?? menuLabel,
      description: DESCRIPTIONS[id] ?? menuLabel,
      category: cat.id,
    });
  };

  // Tabs → categories, menu modules → permissions
  for (const tab of MENU_TABS) {
    const cat = ensureCategory(tab.id, tab.label);
    for (const section of tab.sections) {
      for (const item of section.items) {
        if (NON_PERMISSION_MENU_KEYS.has(item.key)) continue;
        addModule(cat, permissionForMenuKey(item.key), item.label);
      }
    }
  }

  // Orphan modules (routes with no sidebar entry)
  const special = ensureCategory("special", "הרשאות מיוחדות", "גישה למידע רגיש ומודולים ללא תפריט");
  for (const orphan of ORPHAN_MODULES) {
    addModule(special, permissionForMenuKey(orphan.key), orphan.label);
  }

  // Catalog-only permissions with no menu entry
  for (const extra of EXTRA_PERMISSIONS) {
    const cat = categoryById.get(extra.category) ?? special;
    if (seen.has(extra.id)) continue;
    seen.add(extra.id);
    cat.modules.push({ ...extra, category: cat.id });
  }

  return categories;
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = buildPermissionCategories();

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compatible exports (שומרים על תאימות לקוד קיים)
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated השתמש ב-PERMISSION_CATEGORIES במקום */
export const MAIN_MODULES: ModuleConfig[] =
  PERMISSION_CATEGORIES.find(c => c.id === "daily")?.modules ?? [];

/** @deprecated השתמש ב-PERMISSION_CATEGORIES במקום */
export const SALES_MODULES: ModuleConfig[] =
  PERMISSION_CATEGORIES.find(c => c.id === "sales")?.modules ?? [];

/** @deprecated השתמש ב-PERMISSION_CATEGORIES במקום */
export const SETTINGS_MODULES: ModuleConfig[] = [
  ...(PERMISSION_CATEGORIES.find(c => c.id === "settings")?.modules ?? []),
  ...(PERMISSION_CATEGORIES.find(c => c.id === "admin")?.modules ?? []),
  ...(PERMISSION_CATEGORIES.find(c => c.id === "integrations")?.modules ?? []),
];

/** @deprecated השתמש ב-PERMISSION_CATEGORIES במקום */
export const SPECIAL_PERMISSIONS: ModuleConfig[] =
  PERMISSION_CATEGORIES.find(c => c.id === "special")?.modules ?? [];

// ─────────────────────────────────────────────────────────────────────────────
// Utility functions
// ─────────────────────────────────────────────────────────────────────────────

/** מחזיר את כל המודולים מכל הקטגוריות במערך שטוח */
export function getAllModules(): ModuleConfig[] {
  return PERMISSION_CATEGORIES.flatMap(cat => cat.modules);
}

/** מחזיר מודולים לפי קטגוריה */
export function getModulesByCategory(categoryId: string): ModuleConfig[] {
  return PERMISSION_CATEGORIES.find(c => c.id === categoryId)?.modules ?? [];
}

/** מחזיר מודול לפי ID */
export function getModuleById(id: string): ModuleConfig | undefined {
  return getAllModules().find(m => m.id === id);
}

/** מחזיר קטגוריה לפי ID */
export function getCategoryById(id: string): PermissionCategory | undefined {
  return PERMISSION_CATEGORIES.find(c => c.id === id);
}

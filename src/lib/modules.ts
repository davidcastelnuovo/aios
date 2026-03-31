/**
 * modules.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * מקור האמת היחיד לכל המודולים / הרשאות במערכת.
 *
 * כדי להוסיף מודול עתידי:
 *  1. הוסף ערך ל-ModulePermission (useUserPermissions.ts)
 *  2. הוסף ModuleConfig לקטגוריה המתאימה כאן
 *  3. הוסף את ה-key ל-modulePermissions ב-AppSidebar.tsx
 *  4. הוסף Route ב-App.tsx עם requiredPermission
 *
 * הדיאלוג EditUserPermissionsDialog קורא PERMISSION_CATEGORIES ומרנדר
 * אוטומטית כל מודול שמוסיפים – אין צורך לעדכן את הדיאלוג עצמו.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ModuleConfig {
  /** מזהה ייחודי – חייב להתאים ל-ModulePermission ב-useUserPermissions.ts */
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
// קטגוריות ומודולים
// ─────────────────────────────────────────────────────────────────────────────

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  // ── ניהול שוטף ──────────────────────────────────────────────────────────
  {
    id: "daily",
    label: "ניהול שוטף",
    description: "מודולים לעבודה יומיומית עם לקוחות ומשימות",
    modules: [
      {
        id: "dashboard",
        label: "דשבורד",
        description: "צפייה בדשבורד הראשי",
        category: "daily",
      },
      {
        id: "clients",
        label: "ניהול לקוחות",
        description: "צפייה ועריכת לקוחות",
        category: "daily",
      },
      {
        id: "client_onboarding",
        label: "קליטת לקוחות",
        description: "ניהול תהליך קליטת לקוחות חדשים",
        category: "daily",
      },
      {
        id: "tasks",
        label: "משימות",
        description: "ניהול משימות",
        category: "daily",
      },
      {
        id: "time_tracking",
        label: "מעקב זמן",
        description: "שעון נוכחות ומעקב שעות",
        category: "daily",
      },
      {
        id: "recordings",
        label: "הקלטות",
        description: "ניהול הקלטות מכל המקורות",
        category: "daily",
      },
    ],
  },

  // ── תקשורת ──────────────────────────────────────────────────────────────
  {
    id: "communication",
    label: "תקשורת",
    description: "כלי תקשורת עם לקוחות וצוות",
    modules: [
      {
        id: "chat",
        label: "צ'אט",
        description: "מודול צ'אט עם לקוחות ולידים",
        category: "communication",
      },
      {
        id: "team_chat",
        label: "צ'אט צוות",
        description: "תקשורת פנים-ארגונית בסגנון Slack",
        category: "communication",
      },
      {
        id: "gmail",
        label: "Gmail",
        description: "שליחת וקבלת מיילים דרך Gmail",
        category: "communication",
      },
      {
        id: "signatures",
        label: "חתימות דיגיטליות",
        description: "ניהול מסמכים וחתימות דיגיטליות",
        category: "communication",
      },
    ],
  },

  // ── מכירות ──────────────────────────────────────────────────────────────
  {
    id: "sales",
    label: "מכירות",
    description: "מודולי מכירות ולידים",
    modules: [
      {
        id: "sales_dashboard",
        label: "דשבורד מכירות",
        description: "דשבורד ייעודי למכירות",
        category: "sales",
      },
      {
        id: "leads",
        label: "ניהול לידים",
        description: "צפייה ועריכת לידים",
        category: "sales",
      },
      {
        id: "sales_people",
        label: "ניהול אנשי מכירות",
        description: "צפייה ועריכת אנשי מכירות",
        category: "sales",
      },
      {
        id: "campaigners",
        label: "ניהול קמפיינרים",
        description: "צפייה ועריכת קמפיינרים",
        category: "sales",
      },
      {
        id: "products",
        label: "מוצרים ושירותים",
        description: "ניהול מוצרים ושירותים",
        category: "sales",
      },
    ],
  },

  // ── שיווק ────────────────────────────────────────────────────────────────
  {
    id: "marketing",
    label: "שיווק ואנליטיקס",
    description: "כלי שיווק, ניטור ואנליטיקס",
    modules: [
      {
        id: "social_media",
        label: "ניהול סושיאל",
        description: "ניהול פוסטים ולוח שנה לרשתות חברתיות",
        category: "marketing",
      },
      {
        id: "reports",
        label: "דוחות",
        description: "צפייה בדוחות ואנליטיקה",
        category: "marketing",
      },
      {
        id: "dynamic_tables",
        label: "דשבורדים ודוחות",
        description: "יצירת דשבורדים וטבלאות מותאמות אישית",
        category: "marketing",
      },
      {
        id: "ai_detection",
        label: "ניטור נראות AI",
        description: "מעקב אחר נראות המותג במנועי AI",
        category: "marketing",
      },
    ],
  },

  // ── ניהול ארגון ──────────────────────────────────────────────────────────
  {
    id: "organization",
    label: "ניהול ארגון",
    description: "ניהול ישויות ארגוניות",
    modules: [
      {
        id: "agencies",
        label: "ניהול סוכנויות",
        description: "צפייה ועריכת סוכנויות",
        category: "organization",
      },
      {
        id: "suppliers",
        label: "ניהול ספקים",
        description: "צפייה ועריכת ספקים",
        category: "organization",
      },
      {
        id: "tenants",
        label: "ניהול ארגונים",
        description: "ניהול ארגונים ומנויים (מנהל בלבד)",
        category: "organization",
      },
      {
        id: "users",
        label: "ניהול משתמשים",
        description: "הוספה ועריכת משתמשים",
        category: "organization",
      },
    ],
  },

  // ── אוטומציה ו-AI ────────────────────────────────────────────────────────
  {
    id: "automation",
    label: "אוטומציה ו-AI",
    description: "כלי אוטומציה וסוכני AI",
    modules: [
      {
        id: "automations",
        label: "אוטומציות",
        description: "הגדרת אוטומציות מבוססות טריגרים",
        category: "automation",
      },
      {
        id: "agents",
        label: "סוכני AI",
        description: "ניהול והפעלת סוכני AI",
        category: "automation",
      },
    ],
  },

  // ── אינטגרציות ──────────────────────────────────────────────────────────
  {
    id: "integrations",
    label: "אינטגרציות",
    description: "חיבורים לכלים ושירותים חיצוניים",
    modules: [
      {
        id: "lead_integrations",
        label: "אינטגרציות לידים",
        description: "ניהול אינטגרציות לידים, פייסבוק, גוגל ועוד",
        category: "integrations",
      },
      {
        id: "chat_integrations",
        label: "אינטגרציות צ'אט",
        description: "ניהול אינטגרציות צ'אט",
        category: "integrations",
      },
      {
        id: "manychat_settings",
        label: "הגדרות ManyChat",
        description: "אינטגרציה עם ManyChat",
        category: "integrations",
      },
      {
        id: "green_api_settings",
        label: "הגדרות Green API",
        description: "אינטגרציה עם Green API (WhatsApp)",
        category: "integrations",
      },
      {
        id: "accounting_integrations",
        label: "אינטגרציות הנה\"ח",
        description: "חיבור למערכות הנהלת חשבונות",
        category: "integrations",
      },
    ],
  },

  // ── הגדרות מערכת ────────────────────────────────────────────────────────
  {
    id: "settings",
    label: "הגדרות מערכת",
    description: "הגדרות והתאמות מערכת (בעלים בלבד)",
    modules: [
      {
        id: "branding",
        label: "ברנדינג והתאמת מערכת",
        description: "התאמת לוגו, צבעים ומראה המערכת",
        category: "settings",
      },
      {
        id: "menu_management",
        label: "ניהול תפריטים",
        description: "התאמת תפריט הניווט",
        category: "settings",
      },
      {
        id: "fields_management",
        label: "ניהול שדות",
        description: "הוספת שדות מותאמים אישית",
        category: "settings",
      },
      {
        id: "ai_support",
        label: "תמיכה טכנית AI",
        description: "גישה לצ'אטבוט AI לתמיכה טכנית",
        category: "settings",
      },
    ],
  },

  // ── הרשאות מיוחדות ──────────────────────────────────────────────────────
  {
    id: "special",
    label: "הרשאות מיוחדות",
    description: "גישה למידע רגיש",
    modules: [
      {
        id: "finance",
        label: "ניהול כספים",
        description: "גישה מלאה לניהול פיננסי",
        category: "special",
      },
      {
        id: "finance_view",
        label: "צפייה בנתונים פיננסיים",
        description: "הרשאת צפייה בנתונים פיננסיים בלבד (ללא עריכה)",
        category: "special",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compatible exports (שומרים על תאימות לקוד קיים)
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated השתמש ב-PERMISSION_CATEGORIES במקום */
export const MAIN_MODULES: ModuleConfig[] =
  PERMISSION_CATEGORIES.find(c => c.id === "daily")!.modules;

/** @deprecated השתמש ב-PERMISSION_CATEGORIES במקום */
export const SALES_MODULES: ModuleConfig[] =
  PERMISSION_CATEGORIES.find(c => c.id === "sales")!.modules;

/** @deprecated השתמש ב-PERMISSION_CATEGORIES במקום */
export const SETTINGS_MODULES: ModuleConfig[] = [
  ...PERMISSION_CATEGORIES.find(c => c.id === "settings")!.modules,
  ...PERMISSION_CATEGORIES.find(c => c.id === "integrations")!.modules,
];

/** @deprecated השתמש ב-PERMISSION_CATEGORIES במקום */
export const SPECIAL_PERMISSIONS: ModuleConfig[] =
  PERMISSION_CATEGORIES.find(c => c.id === "special")!.modules;

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

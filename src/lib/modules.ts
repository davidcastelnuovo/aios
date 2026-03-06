export interface ModuleConfig {
  id: string;
  label: string;
  description: string;
  category?: string;
}

// מודולים כלליים
export const MAIN_MODULES: ModuleConfig[] = [
  { id: "dashboard", label: "דשבורד", description: "צפייה בדשבורד הראשי", category: "main" },
  { id: "clients", label: "ניהול לקוחות", description: "צפייה ועריכת לקוחות", category: "main" },
  { id: "agencies", label: "ניהול סוכנויות", description: "צפייה ועריכת סוכנויות", category: "main" },
  { id: "campaigners", label: "ניהול קמפיינרים", description: "צפייה ועריכת קמפיינרים", category: "main" },
  { id: "client_onboarding", label: "קליטת לקוחות", description: "ניהול תהליך קליטת לקוחות חדשים", category: "main" },
  { id: "suppliers", label: "ניהול ספקים", description: "צפייה ועריכת ספקים", category: "main" },
  { id: "tasks", label: "משימות", description: "ניהול משימות", category: "main" },
  { id: "time_tracking", label: "מעקב זמן", description: "שעון נוכחות ומעקב שעות", category: "main" },
  { id: "reports", label: "דוחות", description: "צפייה בדוחות ואנליטיקה", category: "main" },
  { id: "chat", label: "צ'אט", description: "מודול צ'אט עם לקוחות ולידים", category: "main" },
  { id: "team_chat", label: "צ'אט צוות", description: "תקשורת פנים-ארגונית בסגנון Slack", category: "main" },
  { id: "recordings", label: "הקלטות", description: "ניהול הקלטות מכל המקורות", category: "main" },
];

// מודולי מכירות
export const SALES_MODULES: ModuleConfig[] = [
  { id: "sales_dashboard", label: "דשבורד מכירות", description: "דשבורד ייעודי למכירות", category: "sales" },
  { id: "leads", label: "ניהול לידים", description: "צפייה ועריכת לידים", category: "sales" },
  { id: "sales_people", label: "ניהול אנשי מכירות", description: "צפייה ועריכת אנשי מכירות", category: "sales" },
  { id: "products", label: "מוצרים ושירותים", description: "ניהול מוצרים ושירותים", category: "sales" },
];

// הגדרות ואינטגרציות
export const SETTINGS_MODULES: ModuleConfig[] = [
  { id: "users", label: "ניהול משתמשים", description: "הוספה ועריכת משתמשים", category: "settings" },
  { id: "branding", label: "ברנדינג", description: "התאמת לוגו וצבעים", category: "settings" },
  { id: "menu_management", label: "ניהול תפריטים", description: "התאמת תפריט הניווט", category: "settings" },
  { id: "fields_management", label: "ניהול שדות", description: "הוספת שדות מותאמים אישית", category: "settings" },
  { id: "automations", label: "אוטומציות", description: "הגדרת אוטומציות מבוססות טריגרים", category: "settings" },
  { id: "dynamic_tables", label: "טבלאות דינמיות", description: "יצירת טבלאות מותאמות אישית", category: "settings" },
  { id: "ai_support", label: "תמיכה טכנית AI", description: "גישה לצ'אטבוט AI לתמיכה טכנית", category: "settings" },
  { id: "manychat_settings", label: "הגדרות ManyChat", description: "אינטגרציה עם ManyChat", category: "settings" },
  { id: "green_api_settings", label: "הגדרות Green API", description: "אינטגרציה עם Green API", category: "settings" },
  { id: "chat_integrations", label: "אינטגרציות צ'אט", description: "ניהול אינטגרציות צ'אט", category: "settings" },
  { id: "lead_integrations", label: "אינטגרציות", description: "ניהול אינטגרציות לידים ופייסבוק", category: "settings" },
  { id: "accounting_integrations", label: "אינטגרציות הנה\"ח", description: "חיבור למערכות הנהלת חשבונות", category: "settings" },
];

// הרשאות מיוחדות
export const SPECIAL_PERMISSIONS: ModuleConfig[] = [
  { id: "finance", label: "צפייה בכספים", description: "גישה למידע פיננסי רגיש", category: "special" },
  { id: "finance_view", label: "צפייה בנתונים פיננסיים", description: "הרשאה לצפייה בנתונים פיננסיים בלבד (ללא עריכה)", category: "special" },
];

/**
 * מחזיר את כל המודולים במערך שטוח
 */
export function getAllModules(): ModuleConfig[] {
  return [
    ...MAIN_MODULES,
    ...SALES_MODULES,
    ...SETTINGS_MODULES,
    ...SPECIAL_PERMISSIONS,
  ];
}

/**
 * מחזיר מודולים לפי קטגוריה
 */
export function getModulesByCategory(category: string): ModuleConfig[] {
  return getAllModules().filter(module => module.category === category);
}

/**
 * מחזיר מודול לפי ID
 */
export function getModuleById(id: string): ModuleConfig | undefined {
  return getAllModules().find(module => module.id === id);
}

// Shared catalog of Carmen's built-in tools, grouped for settings UIs.
// Used by the per-agent ToolsTab (allowlist) and the Carmen Access page
// (denylist). Keep names in sync with ALL_TOOLS in run-ai-agent.
export interface AgentToolEntry {
  name: string;
  label: string;
  group: string;
}

export const AGENT_TOOLS_CATALOG: AgentToolEntry[] = [
  { name: "create_lead", label: "יצירת ליד", group: "לידים" },
  { name: "list_leads", label: "צפייה בלידים", group: "לידים" },
  { name: "update_lead_status", label: "עדכון סטטוס ליד", group: "לידים" },
  { name: "add_lead_update", label: "הוספת עדכון לליד", group: "לידים" },
  { name: "create_task", label: "יצירת משימה לצוות", group: "משימות" },
  { name: "create_agent_task", label: "משימה לסוכן עצמו", group: "משימות" },
  { name: "list_tasks", label: "צפייה במשימות", group: "משימות" },
  { name: "search_tasks", label: "חיפוש משימות", group: "משימות" },
  { name: "update_task_status", label: "עדכון סטטוס משימה", group: "משימות" },
  { name: "list_clients", label: "צפייה בלקוחות", group: "לקוחות" },
  { name: "get_client_info", label: "מידע על לקוח", group: "לקוחות" },
  { name: "add_client_update", label: "הוספת עדכון ללקוח", group: "לקוחות" },
  { name: "update_client_health", label: "עדכון Health Score", group: "לקוחות" },
  { name: "send_message", label: "שליחת WhatsApp", group: "תקשורת" },
  { name: "search_entities", label: "חיפוש כללי", group: "כללי" },
  { name: "create_social_post", label: "יצירת פוסט", group: "סושיאל" },
  { name: "generate_ad_image", label: "יצירת תמונה (AI)", group: "סושיאל" },
  { name: "list_campaigners", label: "רשימת קמפיינרים", group: "צוות" },
  { name: "list_sales_people", label: "רשימת אנשי מכירות", group: "צוות" },
  { name: "list_automations", label: "אוטומציות", group: "אוטומציות" },
  { name: "toggle_automation", label: "הפעלה/כיבוי אוטומציה", group: "אוטומציות" },
  { name: "list_integrations", label: "אינטגרציות", group: "אינטגרציות" },
  { name: "get_dashboard_stats", label: "סטטיסטיקות דשבורד", group: "דוחות" },
  { name: "analyze_campaign_performance", label: "ניתוח קמפיינים", group: "דוחות" },
  { name: "get_finance_summary", label: "סיכום כספי", group: "דוחות" },
  { name: "list_agents", label: "רשימת סוכנים", group: "ניהול AI" },
  { name: "create_agent", label: "יצירת סוכן", group: "ניהול AI" },
  { name: "update_agent", label: "עדכון סוכן", group: "ניהול AI" },
  { name: "delegate_to_github_agent", label: "האצלה ל-GitHub Agent", group: "ניהול AI" },
  { name: "save_memory", label: "שמירת זיכרון", group: "זיכרון" },
  { name: "recall_memory", label: "שליפת זיכרון", group: "זיכרון" },
  { name: "kb_search", label: "חיפוש בידע", group: "ידע" },
  { name: "kb_open", label: "פתיחת ידע", group: "ידע" },
  { name: "kb_learn", label: "למידה לזיכרון ארוך", group: "ידע" },
];

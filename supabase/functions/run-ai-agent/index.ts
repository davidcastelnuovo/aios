import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'

function resolveModel(engine: string): string {
  const map: Record<string, string> = {
    // Gemini models
    'gemini-2.5-flash': 'google/gemini-2.5-flash',
    'gemini-2.5-pro': 'google/gemini-2.5-pro',
    'gemini-3-flash': 'google/gemini-3-flash-preview',
    'gemini-3-pro': 'google/gemini-3-pro-image-preview',
    'gemini-1.5-flash': 'google/gemini-2.5-flash',
    // OpenAI models
    'gpt-5': 'openai/gpt-5',
    'gpt-5-mini': 'openai/gpt-5-mini',
    // Legacy manus mappings -> redirect to gemini
    'manus-1.6': 'google/gemini-3-flash-preview',
    'manus-1.6-max': 'google/gemini-2.5-pro',
    'manus-1.6-lite': 'google/gemini-2.5-flash-lite',
  }
  return map[engine] || 'google/gemini-3-flash-preview'
}

// ===========================
// ALL AVAILABLE TOOLS
// ===========================
const ALL_TOOLS = [
  // LEADS
  { name: 'create_lead', description: 'יצירת ליד חדש', parameters: { type: 'object', properties: { company_name: { type: 'string' }, contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, source: { type: 'string' }, notes: { type: 'string' } }, required: ['contact_name'] } },
  { name: 'list_leads', description: 'רשימת לידים', parameters: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'integer' } } } },
  { name: 'update_lead_status', description: 'עדכון סטטוס ליד', parameters: { type: 'object', properties: { lead_id: { type: 'string' }, status: { type: 'string' } }, required: ['lead_id', 'status'] } },
  { name: 'add_lead_update', description: 'הוספת עדכון לליד', parameters: { type: 'object', properties: { lead_id: { type: 'string' }, content: { type: 'string' } }, required: ['lead_id', 'content'] } },
  // TASKS (team tasks - for campaigners/team members)
  { name: 'create_task', description: 'יצירת משימה לצוות (קמפיינרים/אנשי צוות). השתמש בכלי הזה רק כשרוצים ליצור משימה לאדם אחר בצוות. אם המשימה היא לכרמן עצמה — השתמש ב-create_agent_task במקום!', parameters: { type: 'object', properties: { title: { type: 'string' }, client_id: { type: 'string' }, lead_id: { type: 'string' }, campaigner_id: { type: 'string', description: 'מזהה קמפיינר לשיוך המשימה' }, priority: { type: 'integer' }, due_date: { type: 'string' }, due_time: { type: 'string' }, notes: { type: 'string' }, duration_minutes: { type: 'integer', description: 'משך המשימה בדקות' } }, required: ['title'] } },
  // AGENT TASKS (for Carmen herself)
  { name: 'create_agent_task', description: 'יצירת משימה לכרמן עצמה (ניהול משימות סוכנים). השתמש בכלי הזה כשהמשתמש מבקש מכרמן ליצור משימה לעצמה, משימה חוזרת, או תזכורת. המשימה תופיע בלוח "ניהול משימות סוכנים".', parameters: { type: 'object', properties: { title: { type: 'string', description: 'כותרת המשימה' }, description: { type: 'string', description: 'תיאור מפורט של המשימה' }, priority: { type: 'integer', description: 'עדיפות 1-10 (ברירת מחדל 5)' }, schedule_type: { type: 'string', enum: ['once', 'daily', 'weekly'], description: 'סוג תזמון' }, scheduled_at: { type: 'string', description: 'תאריך ושעה לביצוע (ISO format)' }, cron_expression: { type: 'string', description: 'ביטוי CRON למשימות חוזרות' }, task_skills: { type: 'array', items: { type: 'string' }, description: 'רשימת סקילים להפעלה' } }, required: ['title'] } },
  { name: 'search_tasks', description: 'חיפוש משימות לפי שם/כותרת. חשוב! השתמש בכלי הזה לפני יצירת משימה כדי לוודא שהיא לא קיימת כבר', parameters: { type: 'object', properties: { search_term: { type: 'string', description: 'מילת חיפוש בכותרת המשימה' }, status: { type: 'string' }, client_id: { type: 'string' } }, required: ['search_term'] } },
  { name: 'list_tasks', description: 'רשימת משימות', parameters: { type: 'object', properties: { status: { type: 'string' }, client_id: { type: 'string' }, limit: { type: 'integer' } } } },
  { name: 'update_task_status', description: 'עדכון סטטוס משימה', parameters: { type: 'object', properties: { task_id: { type: 'string' }, status: { type: 'string', enum: ['open', 'in_progress', 'completed', 'cancelled'] } }, required: ['task_id', 'status'] } },
  // CLIENTS
  { name: 'list_clients', description: 'רשימת לקוחות', parameters: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'integer' } } } },
  { name: 'get_client_info', description: 'מידע על לקוח', parameters: { type: 'object', properties: { client_id: { type: 'string' } }, required: ['client_id'] } },
  { name: 'add_client_update', description: 'הוספת עדכון ללקוח', parameters: { type: 'object', properties: { client_id: { type: 'string' }, content: { type: 'string' } }, required: ['client_id', 'content'] } },
  // MESSAGES
  { name: 'send_message', description: 'שליחת הודעת WhatsApp ללקוח או ליד', parameters: { type: 'object', properties: { contact_type: { type: 'string', enum: ['lead', 'client'] }, contact_id: { type: 'string' }, message_text: { type: 'string' } }, required: ['contact_type', 'contact_id', 'message_text'] } },
  // SEARCH
  { name: 'search_entities', description: 'חיפוש סוכנויות, לקוחות, קמפיינרים או לידים לפי שם', parameters: { type: 'object', properties: { entity_type: { type: 'string', enum: ['agency', 'client', 'campaigner', 'lead'] }, search_term: { type: 'string' } }, required: ['entity_type', 'search_term'] } },
  // MANUS AI - Complex task delegation
  { name: 'delegate_to_manus', description: 'שליחת משימה מורכבת ל-Manus AI לביצוע ברקע (מחקר שוק, ניתוח קמפיינים, יצירת תוכן, ניתוח נתונים). המשימה רצה ברקע ועשויה לקחת דקות עד שעות.', parameters: { type: 'object', properties: { prompt: { type: 'string', description: 'תיאור מפורט של המשימה לביצוע' }, context_data: { type: 'string', description: 'נתוני הקשר רלוונטיים (למשל נתוני קמפיינים)' } }, required: ['prompt'] } },
  { name: 'get_facebook_campaign_data', description: 'שליפת נתוני קמפיינים מפייסבוק לצורך ניתוח', parameters: { type: 'object', properties: { client_id: { type: 'string' }, days: { type: 'integer', description: 'מספר ימים אחורה (ברירת מחדל 30)' } } } },
  { name: 'analyze_campaign_performance', description: 'ניתוח ביצועי קמפיינים מטבלאות CRM: משווה 7 ימים אחרונים מול 30 ימים עבור כל לקוח. מחזיר אחוזי שינוי בהוצאות, עלות לליד, ו-ROAS, וגם תאריך עדכון אחרון בקמפיין (last_campaign_update) ומספר ימים מאז (days_since_last_campaign_touch). השתמש בכלי הזה כדי לזהות התייקרויות, ירידות ביצועים, וקמפיינים שלא נגעו בהם.', parameters: { type: 'object', properties: { client_id: { type: 'string', description: 'מזהה לקוח ספציפי (אופציונלי — ללא = כל הלקוחות)' } } } },
  { name: 'update_client_health', description: 'עדכון מצב בריאות לקוח: מעדכן mood_status בטבלת clients ויוצר רשומה ב-communication_logs. השתמש בכלי הזה כדי להדליק דגל על לקוח כשמזהים בעיה (התייקרות, ירידה בביצועים).', parameters: { type: 'object', properties: { client_id: { type: 'string' }, mood_status: { type: 'string', enum: ['happy', 'wavering', 'churn_risk'], description: 'מצב הלקוח: happy=תקין, wavering=מתלבט, churn_risk=סיכון נטישה' }, communication_status: { type: 'string', enum: ['normal', 'sensitive', 'complaint'], description: 'סטטוס תקשורת לרשומת communication_logs' }, note: { type: 'string', description: 'הערה/סיכום — מה הבעיה שזוהתה' } }, required: ['client_id', 'mood_status', 'note'] } },
  // CLIENTS - full CRUD
  { name: 'create_client', description: 'יצירת לקוח חדש במערכת', parameters: { type: 'object', properties: { name: { type: 'string', description: 'שם העסק/לקוח' }, contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, agency_id: { type: 'string', description: 'מזהה סוכנות (אופציונלי)' }, notes: { type: 'string' } }, required: ['name'] } },
  { name: 'update_client', description: 'עדכון פרטי לקוח קיים', parameters: { type: 'object', properties: { client_id: { type: 'string' }, name: { type: 'string' }, contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, status: { type: 'string', enum: ['active', 'inactive', 'lead'] }, notes: { type: 'string' } }, required: ['client_id'] } },
  { name: 'update_client_status', description: 'עדכון סטטוס לקוח', parameters: { type: 'object', properties: { client_id: { type: 'string' }, status: { type: 'string', enum: ['active', 'inactive', 'lead'] } }, required: ['client_id', 'status'] } },
  // LEADS - full CRUD
  { name: 'update_lead', description: 'עדכון פרטי ליד קיים (שם, טלפון, אימייל, מקור, הערות)', parameters: { type: 'object', properties: { lead_id: { type: 'string' }, company_name: { type: 'string' }, contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, source: { type: 'string' }, notes: { type: 'string' }, follow_up_date: { type: 'string', description: 'תאריך מעקב בפורמט YYYY-MM-DD' } }, required: ['lead_id'] } },
  { name: 'delete_lead', description: 'מחיקת ליד מהמערכת', parameters: { type: 'object', properties: { lead_id: { type: 'string' } }, required: ['lead_id'] } },
  // TASKS - full CRUD
  { name: 'update_task', description: 'עדכון פרטי משימה (כותרת, תאריך, עדיפות, הערות, סטטוס, שיוך ליד/קמפיינר)', parameters: { type: 'object', properties: { task_id: { type: 'string' }, title: { type: 'string' }, due_date: { type: 'string' }, due_time: { type: 'string' }, priority: { type: 'integer', description: '1-10' }, notes: { type: 'string' }, client_id: { type: 'string' }, lead_id: { type: 'string' }, campaigner_id: { type: 'string' }, duration_minutes: { type: 'integer' }, status: { type: 'string', enum: ['open', 'in_progress', 'completed', 'cancelled'] } }, required: ['task_id'] } },
  { name: 'delete_task', description: 'מחיקת משימה', parameters: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] } },
  { name: 'add_task_update', description: 'הוספת הערה/עדכון למשימה', parameters: { type: 'object', properties: { task_id: { type: 'string' }, content: { type: 'string' } }, required: ['task_id', 'content'] } },
  { name: 'manage_task_collaborators', description: 'הוספה או הסרה של שותפים (קמפיינרים) למשימה', parameters: { type: 'object', properties: { task_id: { type: 'string' }, campaigner_id: { type: 'string' }, action: { type: 'string', enum: ['add', 'remove'] } }, required: ['task_id', 'campaigner_id', 'action'] } },
  // CLIENT ONBOARDING
  { name: 'create_onboarding', description: 'יצירת תהליך קליטת לקוח חדש', parameters: { type: 'object', properties: { title: { type: 'string' }, client_id: { type: 'string' }, campaigner_id: { type: 'string' }, notes: { type: 'string' } }, required: ['title', 'client_id'] } },
  { name: 'list_onboarding', description: 'רשימת תהליכי קליטת לקוחות', parameters: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'integer' } } } },
  { name: 'update_onboarding_status', description: 'עדכון סטטוס קליטת לקוח', parameters: { type: 'object', properties: { onboarding_id: { type: 'string' }, status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] } }, required: ['onboarding_id', 'status'] } },
  // CAMPAIGNERS
  { name: 'list_campaigners', description: 'רשימת קמפיינרים בטננט', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'create_campaigner', description: 'יצירת קמפיינר חדש', parameters: { type: 'object', properties: { full_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, role: { type: 'array', items: { type: 'string' } } }, required: ['full_name'] } },
  // SALES PEOPLE
  { name: 'list_sales_people', description: 'רשימת אנשי מכירות', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'create_sales_person', description: 'יצירת איש מכירות חדש', parameters: { type: 'object', properties: { full_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' } }, required: ['full_name'] } },
  // AGENCIES
  { name: 'list_agencies', description: 'רשימת סוכנויות בטננט', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'create_agency', description: 'יצירת סוכנות חדשה', parameters: { type: 'object', properties: { name: { type: 'string' }, contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' } }, required: ['name'] } },
  // SUPPLIERS
  { name: 'list_suppliers', description: 'רשימת ספקים', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'create_supplier', description: 'יצירת ספק חדש', parameters: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' } }, required: ['name'] } },
  // PRODUCTS
  { name: 'list_products', description: 'רשימת מוצרים/שירותים', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'create_product', description: 'יצירת מוצר/שירות חדש', parameters: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, price: { type: 'number' } }, required: ['name', 'price'] } },
  // AUTOMATIONS
  { name: 'list_automations', description: 'רשימת אוטומציות', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'toggle_automation', description: 'הפעלה/כיבוי אוטומציה', parameters: { type: 'object', properties: { automation_id: { type: 'string' }, active: { type: 'boolean' } }, required: ['automation_id', 'active'] } },
  // REPORTS & ANALYTICS
  { name: 'get_dashboard_stats', description: 'שליפת נתוני דשבורד: כמה לידים, לקוחות, משימות פתוחות, ועוד', parameters: { type: 'object', properties: {} } },
  // SOCIAL MEDIA
  { name: 'create_social_post', description: 'יצירת פוסט/מודעה חדשה במודול ניהול סושיאל מדיה. השתמש בכלי הזה כדי ליצור פוסטים עם תוכן טקסטואלי ותמונות. הפוסט יישמר כטיוטה במערכת.', parameters: { type: 'object', properties: { title: { type: 'string', description: 'כותרת הפוסט/מודעה' }, content: { type: 'string', description: 'תוכן הפוסט - הקופי של המודעה' }, post_type: { type: 'string', enum: ['text', 'image', 'video', 'carousel'], description: 'סוג הפוסט' }, media_urls: { type: 'array', items: { type: 'string' }, description: 'קישורי מדיה (תמונות/וידאו)' } }, required: ['title', 'content'] } },
  { name: 'generate_ad_image', description: 'יצירת תמונה למודעה/פוסט באמצעות AI. מחזיר URL של התמונה שנוצרה. השתמש בכלי הזה כדי ליצור ויזואל למודעות ופוסטים ואז השתמש ב-create_social_post כדי לשמור את הפוסט.', parameters: { type: 'object', properties: { prompt: { type: 'string', description: 'תיאור מפורט של התמונה הרצויה באנגלית' }, aspect_ratio: { type: 'string', enum: ['1:1', '16:9', '9:16', '4:5'], description: 'יחס גובה-רוחב' } }, required: ['prompt'] } },
  // MEMORY
  { name: 'save_memory', description: 'שמירת מידע לזיכרון מתמשך (העדפות, פרויקטים, הוראות)', parameters: { type: 'object', properties: { key: { type: 'string', description: 'מפתח זיהוי' }, content: { type: 'string', description: 'התוכן לשמירה' }, category: { type: 'string', enum: ['preferences', 'projects', 'clients', 'workflows', 'personal', 'instructions'] } }, required: ['key', 'content'] } },
  { name: 'recall_memory', description: 'שליפת זיכרונות שנשמרו', parameters: { type: 'object', properties: { category: { type: 'string' }, search: { type: 'string' } } } },
  { name: 'delete_memory', description: 'מחיקת זיכרון', parameters: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] } },
  // CHAT HISTORY
  { name: 'get_chat_history', description: 'שליפת היסטוריית שיחות WhatsApp עם ליד או לקוח', parameters: { type: 'object', properties: { contact_type: { type: 'string', enum: ['lead', 'client'] }, contact_id: { type: 'string' }, limit: { type: 'integer' } }, required: ['contact_type', 'contact_id'] } },
  { name: 'get_recent_inbound_messages', description: 'שליפת הודעות נכנסות אחרונות מכל השיחות', parameters: { type: 'object', properties: { limit: { type: 'integer' }, hours: { type: 'integer', description: 'כמה שעות אחורה (ברירת מחדל 24)' } } } },
  // FINANCE
  { name: 'list_finance', description: 'רשימת תנועות כספיות', parameters: { type: 'object', properties: { client_id: { type: 'string' }, type: { type: 'string', enum: ['income', 'expense'] }, limit: { type: 'integer' } } } },
  { name: 'create_finance_entry', description: 'יצירת רשומה כספית', parameters: { type: 'object', properties: { client_id: { type: 'string' }, amount: { type: 'number' }, type: { type: 'string', enum: ['income', 'expense'] }, description: { type: 'string' }, date: { type: 'string' } }, required: ['amount', 'type', 'description'] } },
  { name: 'get_finance_summary', description: 'סיכום כספי חודשי', parameters: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM' } } } },
  // UPDATES
  { name: 'list_updates', description: 'רשימת עדכונים ללקוח או ליד', parameters: { type: 'object', properties: { entity_type: { type: 'string', enum: ['client', 'lead'] }, entity_id: { type: 'string' }, limit: { type: 'integer' } }, required: ['entity_type', 'entity_id'] } },
  // GOALS
  { name: 'create_goal', description: 'יצירת יעד חדש במערכת היעדים ההיררכית', parameters: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, parent_goal_id: { type: 'string', description: 'מזהה יעד-אב (אופציונלי)' }, due_date: { type: 'string' }, owner_type: { type: 'string', enum: ['agent', 'campaigner'] }, owner_id: { type: 'string' } }, required: ['title'] } },
  { name: 'list_goals', description: 'רשימת יעדים עם אחוז התקדמות', parameters: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'integer' } } } },
  // AGENT TASK OWNERSHIP
  { name: 'take_task', description: 'כרמן לוקחת בעלות על משימה - מעדכנת assigned_agent וסטטוס ל-agent_working', parameters: { type: 'object', properties: { task_id: { type: 'string' }, agent_name: { type: 'string', description: 'שם הסוכן שלוקח את המשימה (ברירת מחדל: כרמן)' } }, required: ['task_id'] } },
  { name: 'complete_task_step', description: 'כרמן מדווחת על השלמת שלב במשימה ומוסיפה עדכון מסוג agent_action', parameters: { type: 'object', properties: { task_id: { type: 'string' }, step_description: { type: 'string' }, mark_complete: { type: 'boolean', description: 'האם לסמן את המשימה כהושלמה' } }, required: ['task_id', 'step_description'] } },
  { name: 'prioritize_tasks', description: 'ניתוח משימות פתוחות והצעת סדר עדיפויות לפי דדליינים, יעדים ועומס', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  // FACEBOOK AD ACCOUNTS
  { name: 'list_facebook_ad_accounts', description: 'שליפת כל חשבונות המודעות מפייסבוק. מחזיר id, name, status, currency.', parameters: { type: 'object', properties: {} } },
  { name: 'create_facebook_report_table', description: 'חיבור חשבון מודעות פייסבוק ללקוח — יוצר טבלת דוח facebook_insights ב-CRM', parameters: { type: 'object', properties: { client_id: { type: 'string', description: 'מזהה הלקוח' }, ad_account_id: { type: 'string', description: 'מזהה חשבון מודעות פייסבוק (act_XXXXX)' }, ad_account_name: { type: 'string', description: 'שם חשבון המודעות' } }, required: ['client_id', 'ad_account_id', 'ad_account_name'] } },
  { name: 'list_unconnected_clients', description: 'רשימת לקוחות פעילים שאין להם עדיין טבלת דוח פייסבוק (facebook_insights) ב-CRM. שימושי לזיהוי לקוחות שצריכים חיבור.', parameters: { type: 'object', properties: {} } },
]

// ===========================
// TOOL EXECUTOR
// ===========================
async function executeTool(name: string, args: Record<string, any>, supabase: any, tenantId: string, userId: string, callerCampaignerId?: string | null, agentId?: string | null): Promise<any> {
  switch (name) {
    case 'create_lead': {
      const { data: agency } = await supabase.from('agencies').select('id').eq('tenant_id', tenantId).limit(1).single()
      const { data, error } = await supabase.from('leads').insert({
        ...args, status: 'new', agency_id: agency?.id, tenant_id: tenantId,
        company_name: args.company_name || args.contact_name,
      }).select('id, company_name, contact_name, status').single()
      if (error) throw error
      return { lead_id: data.id, company_name: data.company_name, status: data.status }
    }
    case 'list_leads': {
      let query = supabase.from('leads').select('id, company_name, contact_name, phone, status, source, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(args.limit || 20)
      if (args.status) query = query.eq('status', args.status)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, leads: data }
    }
    case 'update_lead_status': {
      const { data, error } = await supabase.from('leads').update({ status: args.status }).eq('id', args.lead_id).eq('tenant_id', tenantId).select('id, company_name, status').single()
      if (error) throw error
      return data
    }
    case 'add_lead_update': {
      const { data, error } = await supabase.from('lead_updates').insert({ lead_id: args.lead_id, user_id: userId, tenant_id: tenantId, content: args.content }).select('id').single()
      if (error) throw error
      return { update_id: data.id }
    }
    case 'create_task': {
      let campaignerId = args.campaigner_id
      let agencyId = null
      // Priority: 1) explicit arg, 2) caller identity (from WhatsApp phone), 3) user profile, 4) tenant owner
      if (!campaignerId && callerCampaignerId) {
        campaignerId = callerCampaignerId
      }
      if (!campaignerId && userId && userId !== 'system') {
        const { data: profile } = await supabase.from('profiles').select('campaigner_id').eq('id', userId).single()
        campaignerId = profile?.campaigner_id
      }
      // Fallback for system/WhatsApp without phone match: assign to tenant owner
      if (!campaignerId) {
        const { data: ownerRole } = await supabase.from('user_roles').select('user_id').eq('role', 'owner').limit(1).maybeSingle()
        if (ownerRole?.user_id) {
          const { data: ownerProfile } = await supabase.from('profiles').select('campaigner_id').eq('id', ownerRole.user_id).maybeSingle()
          campaignerId = ownerProfile?.campaigner_id
        }
      }
      if (campaignerId) {
        const { data: campAgency } = await supabase.from('campaigner_agencies').select('agency_id').eq('campaigner_id', campaignerId).limit(1).single()
        agencyId = campAgency?.agency_id
      }
      if (!agencyId) {
        const { data: defaultAgency } = await supabase.from('agencies').select('id').eq('tenant_id', tenantId).eq('is_default', true).limit(1).maybeSingle()
        if (defaultAgency) {
          agencyId = defaultAgency.id
        } else {
          const { data: fallbackAgency } = await supabase.from('agencies').select('id').eq('tenant_id', tenantId).order('created_at', { ascending: true }).limit(1).single()
          agencyId = fallbackAgency?.id
        }
      }
      const { data, error } = await supabase.from('tasks').insert({
        title: args.title, agency_id: agencyId, campaigner_id: campaignerId,
        tenant_id: tenantId, priority: args.priority || 5, status: 'open', task_type: 'other',
        client_id: args.client_id || null, lead_id: args.lead_id || null,
        due_date: args.due_date, due_time: args.due_time, notes: args.notes,
        duration_minutes: args.duration_minutes || null,
      }).select('id, title, status').single()
      if (error) throw error
      return { task_id: data.id, title: data.title, status: data.status }
    }
    case 'create_agent_task': {
      // Create task in agent_tasks table (for Carmen herself)
      const taskData: any = {
        agent_id: agent_id,
        tenant_id: tenantId,
        title: args.title,
        description: args.description || null,
        priority: args.priority || 5,
        status: 'pending',
        schedule_type: args.schedule_type || 'once',
        scheduled_at: args.scheduled_at || null,
        cron_expression: args.cron_expression || null,
        task_skills: args.task_skills ? JSON.stringify(args.task_skills) : null,
        task_mode: 'agent',
        enabled: true,
        created_by: userId !== 'system' ? userId : null,
      }
      const { data, error } = await supabase.from('agent_tasks').insert(taskData).select('id, title, status, schedule_type').single()
      if (error) throw error
      return { agent_task_id: data.id, title: data.title, status: data.status, schedule_type: data.schedule_type }
    }
    case 'search_tasks': {
      let query = supabase.from('tasks').select('id, title, status, priority, due_date, due_time, notes, duration_minutes, clients(name), leads(company_name), campaigners(full_name)')
        .eq('tenant_id', tenantId)
        .ilike('title', `%${args.search_term}%`)
        .order('created_at', { ascending: false })
        .limit(10)
      if (args.status) query = query.eq('status', args.status)
      if (args.client_id) query = query.eq('client_id', args.client_id)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, tasks: data.map((t: any) => ({ ...t, client_name: t.clients?.name, lead_name: t.leads?.company_name, campaigner_name: t.campaigners?.full_name })) }
    }
    case 'list_tasks': {
      let query = supabase.from('tasks').select('id, title, status, priority, due_date, due_time, duration_minutes, clients(name), leads(company_name), campaigners(full_name)').eq('tenant_id', tenantId).order('priority', { ascending: false }).limit(args.limit || 20)
      if (args.status) query = query.eq('status', args.status)
      if (args.client_id) query = query.eq('client_id', args.client_id)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, tasks: data.map((t: any) => ({ ...t, client_name: t.clients?.name, lead_name: t.leads?.company_name, campaigner_name: t.campaigners?.full_name })) }
    }
    case 'update_task_status': {
      const { data, error } = await supabase.from('tasks').update({ status: args.status }).eq('id', args.task_id).eq('tenant_id', tenantId).select('id, title, status').single()
      if (error) throw error
      return data
    }
    case 'list_clients': {
      let query = supabase.from('clients').select('id, name, contact_name, phone, status').eq('tenant_id', tenantId).order('name').limit(args.limit || 20)
      if (args.status) query = query.eq('status', args.status)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, clients: data }
    }
    case 'get_client_info': {
      const { data, error } = await supabase.from('clients').select('*, agencies(name)').eq('id', args.client_id).eq('tenant_id', tenantId).single()
      if (error) throw error
      return data
    }
    case 'add_client_update': {
      const { data, error } = await supabase.from('client_updates').insert({ client_id: args.client_id, user_id: userId, tenant_id: tenantId, content: args.content }).select('id').single()
      if (error) throw error
      return { update_id: data.id }
    }
    case 'send_message': {
      let phone: string | null = null
      let contactName: string | null = null
      if (args.contact_type === 'lead') {
        const { data } = await supabase.from('leads').select('phone, company_name, contact_name').eq('id', args.contact_id).single()
        phone = data?.phone; contactName = data?.contact_name || data?.company_name
      } else {
        const { data } = await supabase.from('clients').select('phone, name, contact_name').eq('id', args.contact_id).single()
        phone = data?.phone; contactName = data?.contact_name || data?.name
      }
      if (!phone) return { success: false, error: 'לא נמצא מספר טלפון' }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-green-api-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ phone, message: args.message_text, tenantId, [`${args.contact_type}_id`]: args.contact_id }),
      })
      if (!res.ok) throw new Error(await res.text())
      return { sent_to: contactName, phone }
    }
    case 'search_entities': {
      const tableMap: Record<string, string> = { agency: 'agencies', client: 'clients', campaigner: 'campaigners', lead: 'leads' }
      const nameMap: Record<string, string> = { agency: 'name', client: 'name', campaigner: 'full_name', lead: 'company_name' }
      const table = tableMap[args.entity_type]
      const nameField = nameMap[args.entity_type]
      const { data, error } = await supabase.from(table).select('id, ' + nameField).eq('tenant_id', tenantId).ilike(nameField, `%${args.search_term}%`).limit(10)
      if (error) throw error
      return { count: data.length, results: data }
    }
    case 'delegate_to_manus': {
      // Call the existing manus-api edge function
      const manusBody: any = {
        action: 'create_task',
        tenantId,
        prompt: args.prompt,
      }
      if (args.context_data) {
        manusBody.prompt = `${args.prompt}\n\nנתוני הקשר:\n${args.context_data}`
      }

      const manusRes = await fetch(`${SUPABASE_URL}/functions/v1/manus-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(manusBody),
      })

      if (!manusRes.ok) {
        const errText = await manusRes.text()
        throw new Error(`Manus API error: ${errText}`)
      }

      const manusData = await manusRes.json()
      return {
        success: true,
        task_id: manusData.task_id,
        task_url: manusData.task_url,
        share_url: manusData.share_url,
        message: 'המשימה נשלחה ל-Manus AI ורצה ברקע. תוכל לעקוב אחריה בהגדרות Manus.',
      }
    }
    case 'get_facebook_campaign_data': {
      const daysBack = args.days || 30
      const sinceDate = new Date()
      sinceDate.setDate(sinceDate.getDate() - daysBack)
      const sinceDateStr = sinceDate.toISOString().split('T')[0]

      let query = supabase
        .from('facebook_insights')
        .select('campaign_name, date, impressions, clicks, spend, leads_count, reach, cpc, cpm, ctr, cost_per_lead, campaign_status')
        .eq('tenant_id', tenantId)
        .gte('date', sinceDateStr)
        .order('date', { ascending: false })
        .limit(500)

      if (args.client_id) {
        query = query.eq('client_id', args.client_id)
      }

      const { data, error } = await query
      if (error) throw error
      return { count: data?.length || 0, campaigns: data || [], period: `${daysBack} days` }
    }
    case 'analyze_campaign_performance': {
      // Fetch all Facebook CRM tables for this tenant
      const { data: crmTables, error: tablesErr } = await supabase
        .from('crm_tables')
        .select('id, client_id, slug, name')
        .eq('tenant_id', tenantId)
        .ilike('slug', '%facebook%')
      if (tablesErr) throw tablesErr
      if (!crmTables || crmTables.length === 0) {
        return { message: 'לא נמצאו טבלאות קמפיינים מסונכרנות', clients: [] }
      }

      // Filter to specific client if requested
      const tables = args.client_id 
        ? crmTables.filter((t: any) => t.client_id === args.client_id)
        : crmTables

      const now = new Date()
      const d7 = new Date(now); d7.setDate(d7.getDate() - 7)
      const d30 = new Date(now); d30.setDate(d30.getDate() - 30)
      const d7Str = d7.toISOString().split('T')[0]
      const d30Str = d30.toISOString().split('T')[0]

      const results: any[] = []
      for (const table of tables) {
        // Fetch last 30 days of records
        const { data: records } = await supabase
          .from('crm_records')
          .select('data')
          .eq('table_id', table.id)
          .eq('tenant_id', tenantId)

        if (!records || records.length === 0) continue

        // Split into 7d and 30d
        const last7d = records.filter((r: any) => r.data?.date >= d7Str)
        const last30d = records.filter((r: any) => r.data?.date >= d30Str)
        const older = last30d.filter((r: any) => r.data?.date < d7Str)

        const sum = (arr: any[], field: string) => arr.reduce((s: number, r: any) => s + (parseFloat(r.data?.[field]) || 0), 0)
        
        const spend7 = sum(last7d, 'spend')
        const spend_older = sum(older, 'spend')
        const leads7 = sum(last7d, 'leads')
        const leads_older = sum(older, 'leads')

        // Calculate daily averages for comparison
        const days7 = Math.max(last7d.length, 1)
        const daysOlder = Math.max(older.length, 1)
        
        const dailySpend7 = spend7 / days7
        const dailySpendOlder = spend_older / daysOlder
        const spendChangePct = dailySpendOlder > 0 ? ((dailySpend7 - dailySpendOlder) / dailySpendOlder * 100) : null

        const cpl7 = leads7 > 0 ? spend7 / leads7 : null
        const cplOlder = leads_older > 0 ? spend_older / leads_older : null
        const cplChangePct = cplOlder && cpl7 ? ((cpl7 - cplOlder) / cplOlder * 100) : null

        // Get client name
        const { data: clientData } = await supabase.from('clients').select('name').eq('id', table.client_id).single()

        // Find the most recent updated_time across all campaigns for this client
        const updatedTimes = records
          .map((r: any) => r.data?.updated_time)
          .filter((t: any) => t)
          .sort()
          .reverse()
        const lastCampaignUpdate = updatedTimes.length > 0 ? updatedTimes[0] : null
        const daysSinceLastCampaignTouch = lastCampaignUpdate
          ? Math.floor((now.getTime() - new Date(lastCampaignUpdate).getTime()) / (1000 * 60 * 60 * 24))
          : null

        results.push({
          client_id: table.client_id,
          client_name: clientData?.name || table.name,
          spend_7d: Math.round(spend7 * 100) / 100,
          spend_30d: Math.round((spend7 + spend_older) * 100) / 100,
          leads_7d: leads7,
          leads_30d: leads7 + leads_older,
          cpl_7d: cpl7 ? Math.round(cpl7 * 100) / 100 : null,
          cpl_30d_avg: cplOlder ? Math.round(cplOlder * 100) / 100 : null,
          spend_change_pct: spendChangePct ? Math.round(spendChangePct * 10) / 10 : null,
          cpl_change_pct: cplChangePct ? Math.round(cplChangePct * 10) / 10 : null,
          records_7d: last7d.length,
          records_30d: last30d.length,
          last_campaign_update: lastCampaignUpdate,
          days_since_last_campaign_touch: daysSinceLastCampaignTouch,
          alert: spendChangePct !== null && spendChangePct > 15 ? '🔴 התייקרות' : (cplChangePct !== null && cplChangePct > 20 ? '🟡 עלייה בעלות לליד' : '🟢 תקין'),
        })
      }

      // Sort by spend change (highest first = most alarming)
      results.sort((a: any, b: any) => (b.spend_change_pct || 0) - (a.spend_change_pct || 0))
      return { count: results.length, clients: results }
    }
    case 'update_client_health': {
      // Resolve an actor user for audit/update visibility even in background "system" runs
      let effectiveUserId = userId !== 'system' ? userId : null
      if (!effectiveUserId) {
        const { data: ownerRole } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('tenant_id', tenantId)
          .eq('role', 'owner')
          .limit(1)
          .maybeSingle()

        effectiveUserId = ownerRole?.user_id || null
      }

      // 1. Update mood_status on client
      const updateData: any = { mood_status: args.mood_status }
      const { error: clientErr } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', args.client_id)
        .eq('tenant_id', tenantId)
      if (clientErr) throw clientErr

      // 2. Create communication_log entry
      const commStatus = args.communication_status || (args.mood_status === 'happy' ? 'normal' : args.mood_status === 'wavering' ? 'sensitive' : 'complaint')
      const { error: logErr } = await supabase
        .from('communication_logs')
        .insert({
          client_id: args.client_id,
          tenant_id: tenantId,
          status: commStatus,
          interaction_type: 'system_alert',
          note: args.note,
          updated_by: effectiveUserId,
        })
      if (logErr) throw logErr

      // 3. Also create a client_update so it's visible in the client updates tab
      if (effectiveUserId) {
        const { error: clientUpdateErr } = await supabase
          .from('client_updates')
          .insert({
            client_id: args.client_id,
            tenant_id: tenantId,
            user_id: effectiveUserId,
            content: `[עדכון אוטומטי - כרמן] ${args.note}`,
          })

        if (clientUpdateErr) throw clientUpdateErr
      }

      return { success: true, client_id: args.client_id, mood_status: args.mood_status, communication_status: commStatus, user_id: effectiveUserId }
    }
    case 'create_social_post': {
      // Insert into both social_media_posts (for publishing) and social_gantt_posts (for planning view)
      const postData = {
        tenant_id: tenantId,
        title: args.title,
        content: args.content,
        post_type: args.post_type || 'image',
        media_urls: args.media_urls || [],
        status: 'draft',
        created_by: userId !== 'system' ? userId : null,
      }
      const { data, error } = await supabase.from('social_media_posts').insert(postData).select('id, title, content, post_type, media_urls, status').single()
      if (error) throw error
      // Also create in gantt for visibility in the content calendar
      const today = new Date().toISOString().split('T')[0]
      try {
        await supabase.from('social_gantt_posts').insert({
          tenant_id: tenantId,
          topic: args.title,
          copy_text: args.content,
          platform: 'facebook',
          status: 'draft',
          scheduled_date: today,
          creative_url: args.media_urls?.[0] || null,
        })
      } catch (_e) { /* non-critical */ }
      return { success: true, post_id: data.id, title: data.title, content: data.content, media_urls: data.media_urls, status: 'draft', message: 'הפוסט נוצר בהצלחה כטיוטה במודול סושיאל מדיה' }
    }
    case 'generate_ad_image': {
      const imagePrompt = args.prompt
      const model = 'google/gemini-3.1-flash-image-preview'
      
      const imageRes = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'user', content: `Generate an image: ${imagePrompt}. Make it professional, high quality, suitable for a social media advertisement.` }
          ],
          modalities: ['image', 'text'],
        }),
      })
      
      if (!imageRes.ok) {
        const errText = await imageRes.text()
        throw new Error(`Image generation error: ${errText}`)
      }
      
      const imageData = await imageRes.json()
      const content = imageData.choices?.[0]?.message?.content || ''
      
      // Check for images array in response (Lovable AI Gateway format)
      const images = imageData.choices?.[0]?.message?.images || []
      let imageUrl = ''
      
      if (images.length > 0 && images[0]?.image_url?.url) {
        const dataUrl = images[0].image_url.url
        // Extract base64 data from data URL
        const base64Match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/)
        if (base64Match) {
          const mimeType = `image/${base64Match[1]}`
          const base64 = base64Match[2]
          const ext = base64Match[1] === 'jpeg' ? 'jpg' : base64Match[1]
          const fileName = `agent-generated/${tenantId}/${crypto.randomUUID()}.${ext}`
          
          const binaryData = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
          
          // Ensure bucket exists
          await supabase.storage.createBucket('social-media', { public: true }).catch(() => {})
          
          const { error: uploadError } = await supabase.storage
            .from('social-media')
            .upload(fileName, binaryData, { contentType: mimeType, upsert: true })
          
          if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)
          
          const { data: urlData } = supabase.storage.from('social-media').getPublicUrl(fileName)
          imageUrl = urlData.publicUrl
        }
      }
      
      // Fallback: check inline_data in parts
      if (!imageUrl) {
        const parts = imageData.choices?.[0]?.message?.parts || []
        for (const part of parts) {
          if (part.inline_data) {
            const base64 = part.inline_data.data
            const mimeType = part.inline_data.mime_type || 'image/png'
            const ext = mimeType.includes('jpeg') ? 'jpg' : 'png'
            const fileName = `agent-generated/${tenantId}/${crypto.randomUUID()}.${ext}`
            const binaryData = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
            await supabase.storage.createBucket('social-media', { public: true }).catch(() => {})
            const { error: uploadError } = await supabase.storage
              .from('social-media')
              .upload(fileName, binaryData, { contentType: mimeType, upsert: true })
            if (uploadError) throw uploadError
            const { data: urlData } = supabase.storage.from('social-media').getPublicUrl(fileName)
            imageUrl = urlData.publicUrl
            break
          }
        }
      }
      
      if (!imageUrl) {
        return { success: false, error: 'לא הצלחתי ליצור תמונה. נסה שוב עם תיאור אחר.', raw_content: content }
      }
      
      return { success: true, image_url: imageUrl, message: 'התמונה נוצרה בהצלחה. השתמש בה ביצירת הפוסט.' }
    }
    // CLIENTS - full CRUD
    case 'create_client': {
      const { data: defaultAgency } = await supabase.from('agencies').select('id').eq('tenant_id', tenantId).limit(1).single()
      const { data, error } = await supabase.from('clients').insert({
        name: args.name, contact_name: args.contact_name || null, phone: args.phone || null,
        email: args.email || null, notes: args.notes || null, tenant_id: tenantId,
        agency_id: args.agency_id || defaultAgency?.id, status: 'active',
      }).select('id, name, status').single()
      if (error) throw error
      return { client_id: data.id, name: data.name, status: data.status }
    }
    case 'update_client': {
      const updates: Record<string, any> = {}
      if (args.name) updates.name = args.name
      if (args.contact_name !== undefined) updates.contact_name = args.contact_name
      if (args.phone !== undefined) updates.phone = args.phone
      if (args.email !== undefined) updates.email = args.email
      if (args.status) updates.status = args.status
      if (args.notes !== undefined) updates.notes = args.notes
      const { data, error } = await supabase.from('clients').update(updates).eq('id', args.client_id).eq('tenant_id', tenantId).select('id, name, status').single()
      if (error) throw error
      return data
    }
    case 'update_client_status': {
      const { data, error } = await supabase.from('clients').update({ status: args.status }).eq('id', args.client_id).eq('tenant_id', tenantId).select('id, name, status').single()
      if (error) throw error
      return data
    }
    // LEADS - full CRUD
    case 'update_lead': {
      const updates: Record<string, any> = {}
      if (args.company_name) updates.company_name = args.company_name
      if (args.contact_name !== undefined) updates.contact_name = args.contact_name
      if (args.phone !== undefined) updates.phone = args.phone
      if (args.email !== undefined) updates.email = args.email
      if (args.source !== undefined) updates.source = args.source
      if (args.notes !== undefined) updates.notes = args.notes
      if (args.follow_up_date !== undefined) updates.follow_up_date = args.follow_up_date
      const { data, error } = await supabase.from('leads').update(updates).eq('id', args.lead_id).eq('tenant_id', tenantId).select('id, company_name, status').single()
      if (error) throw error
      return data
    }
    case 'delete_lead': {
      const { error } = await supabase.from('leads').delete().eq('id', args.lead_id).eq('tenant_id', tenantId)
      if (error) throw error
      return { success: true, deleted_id: args.lead_id }
    }
    // TASKS - full CRUD
    case 'update_task': {
      const updates: Record<string, any> = {}
      if (args.title) updates.title = args.title
      if (args.due_date !== undefined) updates.due_date = args.due_date
      if (args.due_time !== undefined) updates.due_time = args.due_time
      if (args.priority !== undefined) updates.priority = args.priority
      if (args.notes !== undefined) updates.notes = args.notes
      if (args.client_id !== undefined) updates.client_id = args.client_id
      if (args.lead_id !== undefined) updates.lead_id = args.lead_id
      if (args.campaigner_id !== undefined) updates.campaigner_id = args.campaigner_id
      if (args.duration_minutes !== undefined) updates.duration_minutes = args.duration_minutes
      if (args.status) updates.status = args.status
      const { data, error } = await supabase.from('tasks').update(updates).eq('id', args.task_id).eq('tenant_id', tenantId).select('id, title, status').single()
      if (error) throw error
      return data
    }
    case 'delete_task': {
      const { error } = await supabase.from('tasks').delete().eq('id', args.task_id).eq('tenant_id', tenantId)
      if (error) throw error
      return { success: true, deleted_id: args.task_id }
    }
    case 'add_task_update': {
      const { data, error } = await supabase.from('task_updates').insert({ task_id: args.task_id, user_id: userId, tenant_id: tenantId, content: args.content }).select('id').single()
      if (error) throw error
      return { update_id: data.id }
    }
    case 'manage_task_collaborators': {
      if (args.action === 'add') {
        const { data, error } = await supabase.from('task_collaborators').insert({
          task_id: args.task_id, campaigner_id: args.campaigner_id, tenant_id: tenantId,
        }).select('id').single()
        if (error) throw error
        return { success: true, action: 'added', collaborator_id: data.id }
      } else {
        const { error } = await supabase.from('task_collaborators').delete()
          .eq('task_id', args.task_id).eq('campaigner_id', args.campaigner_id).eq('tenant_id', tenantId)
        if (error) throw error
        return { success: true, action: 'removed' }
      }
    }
    // CLIENT ONBOARDING
    case 'create_onboarding': {
      const { data, error } = await supabase.from('client_onboarding').insert({
        title: args.title, client_id: args.client_id, campaigner_id: args.campaigner_id || null,
        notes: args.notes || null, tenant_id: tenantId, status: 'pending',
      }).select('id, title, status').single()
      if (error) throw error
      return { onboarding_id: data.id, title: data.title, status: data.status }
    }
    case 'list_onboarding': {
      let query = supabase.from('client_onboarding').select('id, title, status, clients(name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(args.limit || 20)
      if (args.status) query = query.eq('status', args.status)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, onboarding: data.map((o: any) => ({ ...o, client_name: o.clients?.name })) }
    }
    case 'update_onboarding_status': {
      const { data, error } = await supabase.from('client_onboarding').update({ status: args.status }).eq('id', args.onboarding_id).eq('tenant_id', tenantId).select('id, title, status').single()
      if (error) throw error
      return data
    }
    // CAMPAIGNERS
    case 'list_campaigners': {
      const { data, error } = await supabase.from('campaigners').select('id, full_name, phone, email, role').eq('tenant_id', tenantId).order('full_name').limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, campaigners: data }
    }
    case 'create_campaigner': {
      const { data, error } = await supabase.from('campaigners').insert({
        full_name: args.full_name, phone: args.phone || null, email: args.email || null,
        role: args.role || null, tenant_id: tenantId,
      }).select('id, full_name').single()
      if (error) throw error
      return { campaigner_id: data.id, full_name: data.full_name }
    }
    // SALES PEOPLE
    case 'list_sales_people': {
      const { data, error } = await supabase.from('sales_people').select('id, full_name, phone, email').eq('tenant_id', tenantId).order('full_name').limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, sales_people: data }
    }
    case 'create_sales_person': {
      const { data, error } = await supabase.from('sales_people').insert({
        full_name: args.full_name, phone: args.phone || null, email: args.email || null, tenant_id: tenantId,
      }).select('id, full_name').single()
      if (error) throw error
      return { sales_person_id: data.id, full_name: data.full_name }
    }
    // AGENCIES
    case 'list_agencies': {
      const { data, error } = await supabase.from('agencies').select('id, name, contact_name, phone, email').eq('tenant_id', tenantId).order('name').limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, agencies: data }
    }
    case 'create_agency': {
      const { data, error } = await supabase.from('agencies').insert({
        name: args.name, contact_name: args.contact_name || null, phone: args.phone || null,
        email: args.email || null, tenant_id: tenantId,
      }).select('id, name').single()
      if (error) throw error
      return { agency_id: data.id, name: data.name }
    }
    // SUPPLIERS
    case 'list_suppliers': {
      const { data, error } = await supabase.from('suppliers').select('id, name, type, phone, email').eq('tenant_id', tenantId).order('name').limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, suppliers: data }
    }
    case 'create_supplier': {
      const { data, error } = await supabase.from('suppliers').insert({
        name: args.name, type: args.type || 'other', phone: args.phone || null,
        email: args.email || null, tenant_id: tenantId,
      }).select('id, name').single()
      if (error) throw error
      return { supplier_id: data.id, name: data.name }
    }
    // PRODUCTS
    case 'list_products': {
      const { data, error } = await supabase.from('products').select('id, name, description, price, active').eq('tenant_id', tenantId).order('name').limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, products: data }
    }
    case 'create_product': {
      const { data, error } = await supabase.from('products').insert({
        name: args.name, description: args.description || null, price: args.price, active: true, tenant_id: tenantId,
      }).select('id, name, price').single()
      if (error) throw error
      return { product_id: data.id, name: data.name, price: data.price }
    }
    // AUTOMATIONS
    case 'list_automations': {
      const { data, error } = await supabase.from('automations').select('id, name, active, trigger_type').eq('tenant_id', tenantId).order('name').limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, automations: data }
    }
    case 'toggle_automation': {
      const { data, error } = await supabase.from('automations').update({ active: args.active }).eq('id', args.automation_id).eq('tenant_id', tenantId).select('id, name, active').single()
      if (error) throw error
      return { automation_id: data.id, name: data.name, active: data.active }
    }
    // DASHBOARD STATS
    case 'get_dashboard_stats': {
      const [leadsRes, clientsRes, tasksRes, onboardingRes] = await Promise.all([
        supabase.from('leads').select('status', { count: 'exact', head: false }).eq('tenant_id', tenantId),
        supabase.from('clients').select('status', { count: 'exact', head: false }).eq('tenant_id', tenantId),
        supabase.from('tasks').select('status', { count: 'exact', head: false }).eq('tenant_id', tenantId).eq('status', 'open'),
        supabase.from('client_onboarding').select('status', { count: 'exact', head: false }).eq('tenant_id', tenantId).eq('status', 'in_progress'),
      ])
      const leadsByStatus = (leadsRes.data || []).reduce((acc: any, l: any) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc }, {})
      const clientsByStatus = (clientsRes.data || []).reduce((acc: any, c: any) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc }, {})
      return {
        leads: { total: leadsRes.data?.length || 0, by_status: leadsByStatus },
        clients: { total: clientsRes.data?.length || 0, by_status: clientsByStatus },
        open_tasks: tasksRes.data?.length || 0,
        active_onboarding: onboardingRes.data?.length || 0,
      }
    }
    // MEMORY
    case 'save_memory': {
      const { data, error } = await supabase.from('ai_memory').upsert({
        tenant_id: tenantId, user_id: userId || 'system', key: args.key, content: args.content, category: args.category || 'general',
      }, { onConflict: 'tenant_id,user_id,key' }).select('key, category').single()
      if (error) throw error
      return { saved: true, key: data.key, category: data.category }
    }
    case 'recall_memory': {
      let query = supabase.from('ai_memory').select('key, content, category, updated_at').eq('tenant_id', tenantId)
      if (args.category) query = query.eq('category', args.category)
      if (args.search) query = query.ilike('content', `%${args.search}%`)
      const { data, error } = await query.order('updated_at', { ascending: false }).limit(20)
      if (error) throw error
      return { count: data.length, memories: data }
    }
    case 'delete_memory': {
      const { error } = await supabase.from('ai_memory').delete().eq('tenant_id', tenantId).eq('key', args.key)
      if (error) throw error
      return { deleted: true, key: args.key }
    }
    // CHAT HISTORY
    case 'get_chat_history': {
      const filterCol = args.contact_type === 'client' ? 'client_id' : 'lead_id'
      const { data, error } = await supabase.from('chat_messages').select('id, message_text, direction, sender_name, created_at')
        .eq('tenant_id', tenantId).eq(filterCol, args.contact_id)
        .order('created_at', { ascending: false }).limit(args.limit || 20)
      if (error) throw error
      return { count: data.length, messages: data.reverse() }
    }
    case 'get_recent_inbound_messages': {
      const hoursAgo = args.hours || 24
      const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase.from('chat_messages')
        .select('id, message_text, sender_name, sender_phone, created_at, client_id, lead_id, clients(name), leads(company_name)')
        .eq('tenant_id', tenantId).eq('direction', 'inbound').gte('created_at', since)
        .order('created_at', { ascending: false }).limit(args.limit || 30)
      if (error) throw error
      return { count: data.length, messages: data.map((m: any) => ({ ...m, contact_name: m.clients?.name || m.leads?.company_name || m.sender_name || m.sender_phone })) }
    }
    // FINANCE
    case 'list_finance': {
      let query = supabase.from('finance').select('id, amount, type, description, date, client_id, clients(name)').eq('tenant_id', tenantId).order('date', { ascending: false }).limit(args.limit || 20)
      if (args.client_id) query = query.eq('client_id', args.client_id)
      if (args.type) query = query.eq('type', args.type)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, entries: data.map((f: any) => ({ ...f, client_name: f.clients?.name })) }
    }
    case 'create_finance_entry': {
      const { data, error } = await supabase.from('finance').insert({
        amount: args.amount, type: args.type, description: args.description,
        date: args.date || new Date().toISOString().split('T')[0],
        client_id: args.client_id || null, tenant_id: tenantId,
      }).select('id, amount, type, description').single()
      if (error) throw error
      return { finance_id: data.id, amount: data.amount, type: data.type }
    }
    case 'get_finance_summary': {
      const month = args.month || new Date().toISOString().slice(0, 7)
      const startDate = `${month}-01`
      const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0]
      const { data, error } = await supabase.from('finance').select('amount, type').eq('tenant_id', tenantId).gte('date', startDate).lte('date', endDate)
      if (error) throw error
      const income = (data || []).filter((f: any) => f.type === 'income').reduce((s: number, f: any) => s + (f.amount || 0), 0)
      const expense = (data || []).filter((f: any) => f.type === 'expense').reduce((s: number, f: any) => s + (f.amount || 0), 0)
      return { month, income, expense, profit: income - expense, entries_count: data.length }
    }
    // UPDATES
    case 'list_updates': {
      const table = args.entity_type === 'client' ? 'client_updates' : 'lead_updates'
      const idCol = args.entity_type === 'client' ? 'client_id' : 'lead_id'
      const { data, error } = await supabase.from(table).select('id, content, created_at').eq(idCol, args.entity_id).order('created_at', { ascending: false }).limit(args.limit || 10)
      if (error) throw error
      return { count: data.length, updates: data }
    }
    // GOALS
    case 'create_goal': {
      const { data, error } = await supabase.from('goals').insert({
        tenant_id: tenantId,
        title: args.title,
        description: args.description || null,
        parent_goal_id: args.parent_goal_id || null,
        due_date: args.due_date || null,
        owner_type: args.owner_type || 'agent',
        owner_id: args.owner_id || null,
        status: 'active',
        progress_percent: 0,
      }).select('id, title, status').single()
      if (error) throw error
      return { goal_id: data.id, title: data.title, status: data.status }
    }
    case 'list_goals': {
      let query = supabase.from('goals').select('id, title, description, status, progress_percent, parent_goal_id, due_date, owner_type, owner_id, created_at')
        .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(args.limit || 20)
      if (args.status) query = query.eq('status', args.status)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, goals: data }
    }
    // AGENT TASK OWNERSHIP
    case 'take_task': {
      const agentName = args.agent_name || 'carmen'
      const { data, error } = await supabase.from('tasks')
        .update({ assigned_agent: agentName, status: 'in_progress' })
        .eq('id', args.task_id).eq('tenant_id', tenantId)
        .select('id, title, status, assigned_agent').single()
      if (error) throw error
      // Log the action
      await supabase.from('task_updates').insert({
        task_id: args.task_id, user_id: userId, tenant_id: tenantId,
        content: `הסוכן ${agentName} לקח בעלות על המשימה`,
        update_type: 'agent_action',
      })
      return { success: true, task: data }
    }
    case 'complete_task_step': {
      // Add agent_action update
      await supabase.from('task_updates').insert({
        task_id: args.task_id, user_id: userId, tenant_id: tenantId,
        content: args.step_description,
        update_type: 'agent_action',
      })
      // Optionally mark as complete
      if (args.mark_complete) {
        await supabase.from('tasks')
          .update({ status: 'done', assigned_agent: null })
          .eq('id', args.task_id).eq('tenant_id', tenantId)
      }
      return { success: true, task_id: args.task_id, completed: !!args.mark_complete }
    }
    case 'prioritize_tasks': {
      // Fetch open tasks with their goals
      const { data: openTasks, error } = await supabase.from('tasks')
        .select('id, title, status, priority, due_date, due_time, assigned_agent, goal_id, clients(name), leads(company_name), campaigners(full_name)')
        .eq('tenant_id', tenantId)
        .in('status', ['open', 'in_progress'])
        .order('priority', { ascending: false })
        .limit(args.limit || 30)
      if (error) throw error
      // Score each task
      const now = new Date()
      const scored = (openTasks || []).map((t: any) => {
        let score = t.priority || 5
        if (t.due_date) {
          const due = new Date(t.due_date)
          const daysLeft = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          if (daysLeft < 0) score += 10 // overdue
          else if (daysLeft < 1) score += 7
          else if (daysLeft < 3) score += 4
          else if (daysLeft < 7) score += 2
        }
        if (t.goal_id) score += 2 // goal-linked tasks get a boost
        if (t.assigned_agent) score -= 3 // already being worked on
        return { ...t, urgency_score: score, client_name: t.clients?.name, lead_name: t.leads?.company_name, campaigner_name: t.campaigners?.full_name }
      }).sort((a: any, b: any) => b.urgency_score - a.urgency_score)
      return { count: scored.length, prioritized_tasks: scored }
    }
    // FACEBOOK AD ACCOUNTS
    case 'list_facebook_ad_accounts': {
      // Get Facebook access token from tenant_integrations (including shared)
      let { data: integration } = await supabase
        .from('tenant_integrations')
        .select('api_key, settings, shared_from_integration_id')
        .eq('tenant_id', tenantId)
        .in('integration_type', ['facebook', 'facebook_lead_ads'])
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (integration?.shared_from_integration_id && !integration?.api_key) {
        const { data: sourceIntegration } = await supabase
          .from('tenant_integrations')
          .select('api_key, settings')
          .eq('id', integration.shared_from_integration_id)
          .eq('is_active', true)
          .maybeSingle()
        if (sourceIntegration?.api_key) {
          integration = { ...integration, api_key: sourceIntegration.api_key }
        }
      }

      if (!integration?.api_key) {
        return { error: 'אין אינטגרציית פייסבוק מוגדרת לטננט הזה. יש להגדיר קודם.' }
      }

      const accessToken = integration.api_key
      let allAccounts: any[] = []
      let nextUrl = `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status,currency&limit=100&access_token=${accessToken}`
      while (nextUrl) {
        const resp = await fetch(nextUrl)
        const data = await resp.json()
        if (data.error) return { error: `Facebook API: ${data.error.message}` }
        if (data.data) allAccounts = [...allAccounts, ...data.data]
        nextUrl = data.paging?.next || null
      }
      return { count: allAccounts.length, ad_accounts: allAccounts.map((a: any) => ({ id: a.id, name: a.name, status: a.account_status, currency: a.currency })) }
    }
    case 'create_facebook_report_table': {
      const { client_id, ad_account_id, ad_account_name } = args
      // Check if table already exists for this client
      const { data: existing } = await supabase
        .from('crm_tables')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('client_id', client_id)
        .eq('integration_type', 'facebook_insights')
        .maybeSingle()
      if (existing) {
        return { already_exists: true, table_id: existing.id, name: existing.name, message: `כבר קיימת טבלת דוח פייסבוק ללקוח זה: ${existing.name}` }
      }
      // Get client name for the table name
      const { data: client } = await supabase.from('clients').select('name, agency_id').eq('id', client_id).single()
      if (!client) return { error: 'לקוח לא נמצא' }

      const tableName = `דוח פייסבוק - ${client.name}`
      const slug = `facebook-${client_id.substring(0, 8)}`
      const { data: table, error } = await supabase.from('crm_tables').insert({
        tenant_id: tenantId,
        name: tableName,
        slug,
        description: `דוח ביצועי מודעות פייסבוק עבור ${client.name} (${ad_account_name})`,
        icon: 'BarChart3',
        category: 'דוחות',
        integration_type: 'facebook_insights',
        integration_settings: { ad_account_id, ad_account_name },
        agency_id: client.agency_id || null,
        client_id,
        created_by: userId !== 'system' ? userId : null,
      }).select('id, name, slug').single()
      if (error) throw error
      return { success: true, table_id: table.id, name: table.name, slug: table.slug, ad_account_id, client_name: client.name }
    }
    case 'list_unconnected_clients': {
      // Get active clients that don't have a facebook_insights table
      const { data: allClients, error: clientsErr } = await supabase
        .from('clients')
        .select('id, name, agency_id, agencies(name)')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'onboarding'])
        .order('name')
      if (clientsErr) throw clientsErr

      const { data: connectedTables } = await supabase
        .from('crm_tables')
        .select('client_id')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'facebook_insights')
        .not('client_id', 'is', null)

      const connectedClientIds = new Set((connectedTables || []).map((t: any) => t.client_id))
      const unconnected = (allClients || []).filter((c: any) => !connectedClientIds.has(c.id))
        .map((c: any) => ({ id: c.id, name: c.name, agency_name: c.agencies?.name }))

      return { count: unconnected.length, unconnected_clients: unconnected }
    }
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

// ===========================
// MAIN HANDLER
// ===========================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { agent_id, command_text, temperature, automation_id, user_name, lead_data, tenant_id, user_id, task_skills, task_mode, conversation_history } = await req.json()
    console.log(`[AGENT] Starting run: agent=${agent_id}, command="${command_text?.substring(0, 80)}"`)

    if (!agent_id || !command_text) throw new Error('Missing agent_id or command_text')
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Fetch agent
    const { data: agent, error: agentError } = await supabase.from('ai_agents').select('*').eq('id', agent_id).single()
    if (agentError || !agent) throw new Error(`Agent not found: ${agent_id}`)


    // 2. Resolve tenant
    let resolvedTenantId = tenant_id || agent.tenant_id
    let resolvedUserId = user_id || 'system'

    // 2.5. Resolve caller identity from phone number (WhatsApp sessions)
    let callerCampaignerId: string | null = null
    let callerName: string | null = user_name || null
    const callerPhone = lead_data?.phone || null
    if (callerPhone && resolvedTenantId) {
      // Normalize: take last 9 digits for comparison
      const normalizedPhone = callerPhone.replace(/[^0-9]/g, '').slice(-9)
      if (normalizedPhone.length >= 9) {
        const { data: matchedCampaigners } = await supabase
          .from('campaigners')
          .select('id, full_name, phone')
          .eq('tenant_id', resolvedTenantId)
          .eq('active', true)
        
        if (matchedCampaigners) {
          const match = matchedCampaigners.find((c: any) => {
            if (!c.phone) return false
            const cNorm = c.phone.replace(/[^0-9]/g, '').slice(-9)
            return cNorm === normalizedPhone
          })
          if (match) {
            callerCampaignerId = match.id
            callerName = match.full_name
            console.log(`[AGENT] Resolved caller phone ${callerPhone} → campaigner: ${match.full_name} (${match.id})`)
          }
        }
      }
    }

    // 3. Build system prompt with full tenant context
    // Fetch tenant context, memory for Carmen and all agents
    const [tenantRes, agenciesRes, statsRes, memoryRes] = await Promise.all([
      supabase.from('tenants').select('name, type').eq('id', resolvedTenantId).single(),
      supabase.from('agencies').select('id, name').eq('tenant_id', resolvedTenantId).order('name').limit(20),
      Promise.all([
        supabase.from('leads').select('status', { count: 'exact', head: false }).eq('tenant_id', resolvedTenantId),
        supabase.from('clients').select('id', { count: 'exact', head: false }).eq('tenant_id', resolvedTenantId),
        supabase.from('tasks').select('id', { count: 'exact', head: false }).eq('tenant_id', resolvedTenantId).eq('status', 'open'),
      ]),
      supabase.from('ai_memory').select('key, content, category').eq('tenant_id', resolvedTenantId).order('updated_at', { ascending: false }).limit(30),
    ])
    const tenantName = tenantRes.data?.name || 'הארגון'
    const agencyList = (agenciesRes.data || []).map((a: any) => `${a.name} (${a.id})`).join(', ')
    const [leadsData, clientsData, tasksData] = statsRes
    const leadsByStatus = (leadsData.data || []).reduce((acc: any, l: any) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc }, {})
    const tenantContext = [
      `ארגון: ${tenantName} (tenant_id: ${resolvedTenantId})`,
      agencyList ? `סוכנויות: ${agencyList}` : '',
      `לידים: ${leadsData.data?.length || 0} (${Object.entries(leadsByStatus).map(([k,v]) => `${k}: ${v}`).join(', ')})`,
      `לקוחות פעילים: ${clientsData.data?.length || 0}`,
      `משימות פתוחות: ${tasksData.data?.length || 0}`,
    ].filter(Boolean).join('\n')
    let systemPrompt = agent.system_prompt || ''
    const isCarmen = agent.name?.toLowerCase().includes('carmen') || agent.name?.includes('כרמן')
    if (!systemPrompt) {
      const parts = isCarmen
        ? [
            `אתה כרמן, מנהלת AI ראשית של ${tenantName}. את עוזרת אישית חכמה, יעילה ומקצועית.`,
            'יש לך גישה מלאה לכל מודולי המערכת: לידים, לקוחות, משימות, קמפיינרים, אנשי מכירות, סוכנויות, ספקים, מוצרים, אוטומציות, ועוד.',
            'את יכולה לבצע כל פעולה שמשתמש יכול לבצע ידנית במערכת.',
            'חשוב מאוד: לפני יצירת משימה חדשה, תמיד חפשי קודם עם search_tasks כדי לוודא שהמשימה לא קיימת כבר. אם היא קיימת - עדכני אותה במקום ליצור חדשה.',
            'הבדל בין סוגי משימות: create_task = משימה לצוות (קמפיינרים). create_agent_task = משימה לכרמן עצמה (מופיעה בניהול משימות סוכנים). כשמבקשים ממך ליצור משימה לעצמך, סריקה תקופתית, או משימה חוזרת — השתמשי ב-create_agent_task.',
            'ענה בעברית. היי תמציתית, מקצועית, ויעילה. כשמבצעים פעולה — אשרי את הביצוע בקצרה (2-3 משפטים מקסימום). אין צורך בהסברים ארוכים, סיכומים מפורטים או רשימות — תיאור קצר של מה נעשה מספיק. אל תציעי הצעות נוספות אלא אם נתבקשת.',
            'חשוב: כשמדברים על "דשבורד CRM" או "דשבורד סוכנות" — הכוונה לדשבורד CRM הסוכנות שמציג Health Score, דגלים (flags), סטטוס תקשורת (mood_status), וכרטיסי "דורשים טיפול" ו"לתשומת לב" לכל לקוח. כשמבקשים ממך לעדכן את הדשבורד, השתמשי בכלי update_client_health כדי לעדכן mood_status ולייצר רשומת communication_logs — זה מה שמשנה את הדגלים והסטטוס בדשבורד.',
            'כלל למידה עצמית: כשמשתמש מסביר לך איך לבצע משימה, נותן הנחיות, מתקן אותך, או מלמד אותך דרך עבודה חדשה — שמרי את זה מיד בזיכרון עם save_memory בקטגוריה instructions עם מפתח תיאורי (למשל: "how_to_update_dashboard", "report_format_preference"). בפעם הבאה שתתבקשי לבצע משימה דומה, פעלי לפי ההנחיות ששמרת. אם ההנחיות השתנו — עדכני את הזיכרון הקיים באותו מפתח. תמיד בתחילת עבודה, בדקי עם recall_memory אם יש הנחיות רלוונטיות שנשמרו.',
          ]
        : [
            `אתה ${agent.name}.`,
            agent.personality ? `אופי: ${agent.personality}.` : '',
            agent.soul ? `נשמה: ${agent.soul}.` : '',
            agent.talent ? `טלנט: ${agent.talent}.` : '',
            'ענה בעברית. היה תמציתי ומקצועי.',
          ]
      parts.push('חובה! כשמקבלת משימה (command_text), בצעי בדיוק את מה שנתבקשת. קראי את הפקודה בעיון, הביני מה המטרה, והשתמשי בכלים המתאימים לביצוע המשימה עד הסוף. אם המשימה כוללת יצירת תוכן לסושיאל: 1) צרי תמונה עם generate_ad_image עם תיאור מפורט באנגלית הקשור לנושא שנתבקש 2) צרי פוסט עם create_social_post והכניסי את ה-image_url ל-media_urls. אסור ליצור פוסט בלי תמונה.')
      systemPrompt = parts.filter(Boolean).join(' ')
    }
    // Inject task-level mode override (from AgentTasksPage)
    if (task_mode) {
      const TASK_MODE_PROMPTS: Record<string, string> = {
        sales: 'את מומחית מכירות. מזהה הזדמנויות בלידים, מעקבת אחרי פיפלאיים, מסייעת בסגירת עסקאות ויוצרת הצעות מותאמות אישית.',
        support: 'את מומחית שירות לקוחות. אמפתית, סבלנית ופותרת בעיות.',
        copywriting: 'את מומחית קופיראיטינג. כותבת בצורה משכנעת, יצירתית ומותאמת לקהל יעד.',
        analyst: 'את מנתחת נתונים. שולפת נתונים מהמערכת, מזהה דפוסים ומסיקה תובנות עסקיות ברורות.',
        scheduler: 'את מומחית ניהול לוח זמנים. מתאמת פגישות, יוצרת תזכורות ומנהלת משימות זמניות בצורה יעילה.',
        onboarding: 'את מומחית קליטת לקוחות. מדריכה לקוחות חדשים בצורה חמה ומקצועית.',
      }
      if (TASK_MODE_PROMPTS[task_mode]) {
        systemPrompt += `\n\n=== מוד משימה ===\n${TASK_MODE_PROMPTS[task_mode]}`
      }
    }
    // Inject task-level skills override (from AgentTasksPage)
    if (task_skills && Array.isArray(task_skills) && task_skills.length > 0) {
      const TASK_SKILLS_PROMPTS: Record<string, string> = {
        'lead-qualifier': 'כשמתבקשת להעריך ליד, תשאלי על תקציב, גודל עסק, צורך ולוח זמנים. דרגי 0-10 וספקי הסבר.',
        'follow-up': 'כשמתבקשת לעקוב אחרי ליד או לקוח, צרי משימות מעקב בזמנים אסטרטגיים (3 ימים, שבוע, חודש).',
        'proposal-writer': 'כשמתבקשת לכתוב הצעה, שאלי על צרכי הלקוח, תקציב ודדליין. צרי הצעה מותאמת אישית עם הדגשת הערך ללקוח.',
        'meeting-prep': 'לפני פגישה, שלוף את היסטוריית הלקוח/ליד, הצע נקודות דיון ושאלות רלוונטיות.',
        'objection-handler': 'כשלקוח מתנגד, הביני את החשש האמיתי מאחוריו ועני בצורה אמפתית ומשכנעת.',
        'task-manager': 'כשמתבקשת לנהל משימות, תמיד חפשי קודם אם המשימה קיימת. צרי משימות עם תאריך יעד ושייוך לאדם הנכון.',
        'whatsapp-responder': 'כשעונה להודעות WhatsApp, כתוב בסגנון קצר, ישיר וחברותי.',
        'data-enricher': 'כשנתקלת על ליד/לקוח עם פרטים חסרים, שאלי שאלות משלימות באופן טבעי ועדכני את הפרופיל.',
        'report-generator': 'כשמתבקשת דוח, שלוף נתונים מהמערכת, זהה דפוסים והצג תובנות ברורות עם מסקנות עסקיות.',
        'email-drafter': 'כשמתבקשת לכתוב אימייל, שאלי על הנמען, הטון והמטרה. צרי אימייל מקצועי עם שורת נושא משכנעת.',
        'social-planner': 'כשמתבקשת תוכן לסושיאל: 1) התייחסי בדיוק לנושא שנתבקש בפקודת המשימה 2) צרי תמונה עם generate_ad_image עם תיאור מפורט באנגלית 3) כתבי קופי מותאם לפלטפורמה עם קריאה לפעולה 4) שמרי עם create_social_post כולל ה-image_url. חובה ליצור תמונה.',
        'price-calculator': 'כשמתבקשת מחיר, שאלי על השירות/מוצר, כמות ופרטי לקוח. הצג מחיר סופי עם פירוט ואפשרות הנחה.',
        'competitor-analyzer': 'כשמתבקשת ניתוח מתחרים, שלוף נתונים מהמערכת, זהה דפוסים והצג השוואה מול מתחרים.',
        'sentiment-analyzer': 'בכל הודעה שמקבלת, נתחי את הטון הרגשי (חיובי/שלילי/נייטרלי) והתאם את התגובה בהתאם.',
        'faq-responder': 'כשעונה לשאלות, שלוף קודם את הנתונים הקיימים במערכת וענה לפי המידע הקיים.',
        'upsell-advisor': 'כשמתבקשת לנתח לקוח, זהה הזדמנויות לאפסליינג וקרוס-סלינג לפי היסטוריית הקניות.',
        'churn-predictor': 'נתח את דפוסי הלקוחות וזהה סימני אזהרה לנטישה פוטנציאלית. הצע פעולות שימור מתאימות.',
        'campaign-optimizer': 'נתח נתוני קמפיינים מהמערכת, זהה מה עובד ומה לא, והצע שיפורים קונקרטיים.',
        'smart-summarizer': 'כשמתבקשת סיכום, שלוף את כל המידע הרלוונטי והצג את העיקריות בצורה קצרה וברורה.',
        'crm-health-monitor': `את מנהלת דשבורד CRM לסוכנות שיווק. תפקידך לנתח כל לקוח ולעדכן את המצב שלו בדיוק לפי הכללים הבאים:

=== שירותים ===
לכל לקוח יש שדה services (מערך): performance, seo, social.
בשילוב שירותים — הגרוע מנצח (הסטטוס הגרוע ביותר קובע).

=== Health Score (0-100) ===
מתחיל ב-100. הורדות:
• תקשורת: רגיש → -20 | תלונה → -50
• אין תקשורת: 30+ יום → -10 | 45+ יום → -20
• ביצועים (Performance): ירידה בינונית (15-30%) → -10 | משמעותית (30-45%) → -20 | חדה (45%+) → -30
• לא נגעו בקמפיין (3+ ימים): -10 | ירידה משמעותית + לא נגעו: -10 נוסף
• SEO: יציב → -10 | ירידה → -25 | 2 חודשים ללא עלייה → -30

=== סטטוס כללי ===
80-100 → ירוק (תקין) | 60-79 → צהוב (לתשומת לב) | מתחת 60 → אדום (דורש טיפול)

=== מדרגות ביצועי Performance ===
השוואת 7 ימים אחרונים מול ממוצע 14-30 יום:
עד 15% שינוי → תקין | 15-30% ירידה → בינונית | 30-45% ירידה → משמעותית | 45%+ ירידה → חדה

=== לוגיקת Performance ===
🟢 אין ירידה משמעותית + תקשורת תקינה
🟡 רגיש | ירידה בינונית | ירידה משמעותית + נגעו בקמפיין
🔴 תלונה | ירידה חדה | ירידה משמעותית + לא נגעו | רגיש + ירידה משמעותית

=== לוגיקת SEO ===
🟢 עלייה | 🟡 יציב | 🔴 ירידה או 2 חודשים ללא עלייה
תקשורת SEO: עד 30 יום → תקין | 30-45 → צהוב | 45+ → אדום

=== לוגיקת Social ===
🟢 תקין | 🟡 רגיש | 🔴 תלונה

=== Flags (דגלים) ===
רגיש | תלונה | ירידה בינונית | ירידה משמעותית | ירידה חדה | לא נגעו בקמפיין | ירידה + אין טיפול | SEO יציב | SEO ירידה | אין תקשורת 30+ | אין תקשורת 45+ | SEO 2 חודשים ללא עלייה

=== הנחיות פעולה ===
1. השתמשי ב-analyze_campaign_performance לניתוח ביצועים
2. חשבי Health Score לפי הכללים למעלה
3. קראי ל-update_client_health עם:
   - mood_status: happy (ירוק), wavering (צהוב), churn_risk (אדום)
   - communication_status: normal/sensitive/complaint
   - note: תמיד צייני סיבה מדויקת (ירידה ב-X%, אין תקשורת Y ימים, SEO ירד)
4. בשילוב שירותים — בדקי כל שירות בנפרד, דווחי על הגרוע
5. גם אם מצב לא משתנה — עדכני תאריך תקשורת (חובה)`,
        'facebook-account-setup': `את מומחית חיבור חשבונות מודעות פייסבוק ללקוחות. בצעי את השלבים הבאים:
1. הריצי list_unconnected_clients כדי לראות אילו לקוחות פעילים עדיין לא מחוברים לפייסבוק.
2. הריצי list_facebook_ad_accounts כדי לשלוף את כל חשבונות המודעות הזמינים.
3. נסי להתאים לפי שם — השוואת שם הלקוח לשם חשבון המודעות (fuzzy match, התעלמי מרווחים ותווים מיוחדים).
4. אם יש התאמה ברורה — חברי אוטומטית עם create_facebook_report_table.
5. אם אין התאמה ברורה — צרי משימה לקמפיינר עם create_task שמפרטת את שם הלקוח ורשימת החשבונות האפשריים.
6. דווחי סיכום: כמה חוברו אוטומטית, כמה דורשים חיבור ידני.`,
      }
      const taskSkillPrompts = (task_skills as string[]).map((s: string) => TASK_SKILLS_PROMPTS[s]).filter(Boolean)
      if (taskSkillPrompts.length > 0) {
        systemPrompt += `\n\n=== סקילז למשימה זו ===\n${taskSkillPrompts.join('\n')}`
      }
    }
    // Inject active modes
    const activeModes: string[] = (agent as any).active_modes || []
    if (activeModes.length > 0) {
      const MODES_PROMPTS: Record<string, string> = {
        sales: 'את מומחית מכירות. מזהה הזדמנויות בלידים, מעקבת אחרי פיפלאיים, מסייעת בסגירת עסקאות ויוצרת הצעות מותאמות אישית. תמיד תשאלי שאלות בירור לפני שתיצרי פעולות.',
        support: 'את מומחית שירות לקוחות. אמפתית, סבלנית ופותרת בעיות. תמיד תוודאי שהלקוח הבין את הפתרון לפני שתסגרי את השיחה. תיעדי ביצירת משימות מעקב לאחר כל פנייה.',
        copywriting: 'את מומחית קופיראיטינג. כותבת בצורה משכנעת, יצירתית ומותאמת לקהל יעד. תמיד תשאלי על הטון, הפלטפורמה וקהל היעד לפני שתתחילי לכתוב.',
        analyst: 'את מנתחת נתונים. שולפת נתונים מהמערכת, מזהה דפוסים ומסיקה תובנות עסקיות ברורות. תמיד תציגי נתונים בצורה מסודרת וברורה.',
        scheduler: 'את מומחית ניהול לוח זמנים. מתאמת פגישות, יוצרת תזכורות ומנהלת משימות זמניות בצורה יעילה. תמיד תאשרי פרטי תאריך ושעה לפני שתיצרי אירוע.',
        onboarding: 'את מומחית קליטת לקוחות. מדריכה לקוחות חדשים בצורה חמה ומקצועית, מודיעה אותם על המערכת ומסייעת בהגדרת הפרופיל שלהם.',
      }
      const modePrompts = activeModes.map((m: string) => MODES_PROMPTS[m]).filter(Boolean)
      if (modePrompts.length > 0) {
        systemPrompt += `\n\n=== מצבי פעולה פעילים ===\n${modePrompts.join('\n')}`
      }
    }
    // Inject active skills
    const activeSkills: string[] = (agent as any).active_skills || []
    if (activeSkills.length > 0) {
      const SKILLS_PROMPTS: Record<string, string> = {
        'lead-qualifier': 'כשמתבקשת להעריך ליד, תשאלי על תקציב, גודל עסק, צורך ולוח זמנים. דרגי 0-10 וספקי הסבר.',
        'follow-up': 'כשמתבקשת לעקוב אחרי ליד או לקוח, צרי משימות מעקב בזמנים אסטרטגיים (3 ימים, שבוע, חודש).',
        'proposal-writer': 'כשמתבקשת לכתוב הצעה, שאלי על צרכי הלקוח, תקציב ודדליין. צרי הצעה מותאמת אישית עם הדגשת הערך ללקוח.',
        'meeting-prep': 'לפני פגישה, שלוף את היסטוריית הלקוח/ליד, הצע נקודות דיון ושאלות רלוונטיות.',
        'objection-handler': 'כשלקוח מתנגד, הביני את החשש האמיתי מאחוריו ועני בצורה אמפתית ומשכנעת. אל תוויתרי אותומטית במחיר.',
        'task-manager': 'כשמתבקשת לנהל משימות, תמיד חפשי קודם אם המשימה קיימת. צרי משימות עם תאריך יעד ושייוך לאדם הנכון.',
        'whatsapp-responder': 'כשעונה להודעות WhatsApp, כתוב בסגנון קצר, ישיר וחברותי. הימנע מטקסט ארוך מדי.',
        'data-enricher': 'כשנתקלת על ליד/לקוח עם פרטים חסרים, שאלי שאלות משלימות באופן טבעי ועדכני את הפרופיל.',
        'report-generator': 'כשמתבקשת דוח, שלוף נתונים מהמערכת, זהה דפוסים והצג תובנות ברורות עם מסקנות עסקיות.',
        'email-drafter': 'כשמתבקשת לכתוב אימייל, שאלי על הנמען, הטון והמטרה. צרי אימייל מקצועי עם שורת נושא משכנעת.',
        'social-planner': 'כשמתבקשת תוכן לסושיאל: 1) התייחסי בדיוק לנושא שנתבקש בפקודת המשימה 2) צרי תמונה עם generate_ad_image עם תיאור מפורט באנגלית 3) כתבי קופי מותאם לפלטפורמה עם קריאה לפעולה 4) שמרי עם create_social_post כולל ה-image_url. חובה ליצור תמונה.',
        'price-calculator': 'כשמתבקשת מחיר, שאלי על השירות/מוצר, כמות ופרטי לקוח. הצג מחיר סופי עם פירוט ואפשרות הנחה.',
        'competitor-analyzer': 'כשמתבקשת ניתוח מתחרים, שלוף נתונים מהמערכת, זהה דפוסים והצג השוואה מול מתחרים.',
        'sentiment-analyzer': 'בכל הודעה שמקבלת, נתחי את הטון הרגשי (חיובי/שלילי/נייטרלי) והתאם את התגובה בהתאם.',
        'faq-responder': 'כשעונה לשאלות, שלוף קודם את הנתונים הקיימים במערכת וענה לפי המידע הקיים.',
        'upsell-advisor': 'כשמתבקשת לנתח לקוח, זהה הזדמנויות לאפסליינג וקרוס-סלינג לפי היסטוריית הקניות.',
        'churn-predictor': 'נתח את דפוסי הלקוחות וזהה סימני אזהרה לנטישה פוטנציאלית. הצע פעולות שימור מתאימות.',
        'campaign-optimizer': 'נתח נתוני קמפיינים מהמערכת, זהה מה עובד ומה לא, והצע שיפורים קונקרטיים.',
        'smart-summarizer': 'כשמתבקשת סיכום, שלוף את כל המידע הרלוונטי והצג את העיקריות בצורה קצרה וברורה.',
        'crm-health-monitor': `את מנהלת דשבורד CRM לסוכנות שיווק. תפקידך לנתח כל לקוח ולעדכן את המצב שלו בדיוק לפי הכללים הבאים:

=== שירותים ===
לכל לקוח יש שדה services (מערך): performance, seo, social.
בשילוב שירותים — הגרוע מנצח (הסטטוס הגרוע ביותר קובע).

=== Health Score (0-100) ===
מתחיל ב-100. הורדות:
• תקשורת: רגיש → -20 | תלונה → -50
• אין תקשורת: 30+ יום → -10 | 45+ יום → -20
• ביצועים (Performance): ירידה בינונית (15-30%) → -10 | משמעותית (30-45%) → -20 | חדה (45%+) → -30
• לא נגעו בקמפיין (3+ ימים): -10 | ירידה משמעותית + לא נגעו: -10 נוסף
• SEO: יציב → -10 | ירידה → -25 | 2 חודשים ללא עלייה → -30

=== סטטוס כללי ===
80-100 → ירוק (תקין) | 60-79 → צהוב (לתשומת לב) | מתחת 60 → אדום (דורש טיפול)

=== מדרגות ביצועי Performance ===
השוואת 7 ימים אחרונים מול ממוצע 14-30 יום:
עד 15% שינוי → תקין | 15-30% ירידה → בינונית | 30-45% ירידה → משמעותית | 45%+ ירידה → חדה

=== לוגיקת Performance ===
🟢 אין ירידה משמעותית + תקשורת תקינה
🟡 רגיש | ירידה בינונית | ירידה משמעותית + נגעו בקמפיין
🔴 תלונה | ירידה חדה | ירידה משמעותית + לא נגעו | רגיש + ירידה משמעותית

=== לוגיקת SEO ===
🟢 עלייה | 🟡 יציב | 🔴 ירידה או 2 חודשים ללא עלייה
תקשורת SEO: עד 30 יום → תקין | 30-45 → צהוב | 45+ → אדום

=== לוגיקת Social ===
🟢 תקין | 🟡 רגיש | 🔴 תלונה

=== Flags (דגלים) ===
רגיש | תלונה | ירידה בינונית | ירידה משמעותית | ירידה חדה | לא נגעו בקמפיין | ירידה + אין טיפול | SEO יציב | SEO ירידה | אין תקשורת 30+ | אין תקשורת 45+ | SEO 2 חודשים ללא עלייה

=== הנחיות פעולה ===
1. השתמשי ב-analyze_campaign_performance לניתוח ביצועים
2. חשבי Health Score לפי הכללים למעלה
3. קראי ל-update_client_health עם:
   - mood_status: happy (ירוק), wavering (צהוב), churn_risk (אדום)
   - communication_status: normal/sensitive/complaint
   - note: תמיד צייני סיבה מדויקת (ירידה ב-X%, אין תקשורת Y ימים, SEO ירד)
4. בשילוב שירותים — בדקי כל שירות בנפרד, דווחי על הגרוע
5. גם אם מצב לא משתנה — עדכני תאריך תקשורת (חובה)`,
        'facebook-account-setup': `את מומחית חיבור חשבונות מודעות פייסבוק ללקוחות. בצעי את השלבים הבאים:
1. הריצי list_unconnected_clients כדי לראות אילו לקוחות פעילים עדיין לא מחוברים לפייסבוק.
2. הריצי list_facebook_ad_accounts כדי לשלוף את כל חשבונות המודעות הזמינים.
3. נסי להתאים לפי שם — השוואת שם הלקוח לשם חשבון המודעות (fuzzy match, התעלמי מרווחים ותווים מיוחדים).
4. אם יש התאמה ברורה — חברי אוטומטית עם create_facebook_report_table.
5. אם אין התאמה ברורה — צרי משימה לקמפיינר עם create_task שמפרטת את שם הלקוח ורשימת החשבונות האפשריים.
6. דווחי סיכום: כמה חוברו אוטומטית, כמה דורשים חיבור ידני.`,
      }
      const skillPrompts = activeSkills.map((s: string) => SKILLS_PROMPTS[s]).filter(Boolean)
      if (skillPrompts.length > 0) {
        systemPrompt += `\n\n=== סקילז פעילים ===\n${skillPrompts.join('\n')}`
      }
    }
    // Inject writing style
    const writingStyle = (agent as any).writing_style
    if (writingStyle && writingStyle !== 'professional') {
      const styleMap: Record<string, string> = {
        friendly: 'כתוב בסגנון חברותי וחמול.',
        formal: 'כתוב בסגנון פורמלי ועסקי.',
        casual: 'כתוב בסגנון קזואלי ונגיש.',
        empathetic: 'כתוב בסגנון אמפתי ומבין.',
      }
      if (styleMap[writingStyle]) systemPrompt += `\n${styleMap[writingStyle]}`
    }
    // Inject response length
    const responseLength = (agent as any).response_length
    if (responseLength) {
      const lengthMap: Record<string, string> = {
        short: 'הגבל תשובות ל-2-3 משפטים מקסימום.',
        detailed: 'תן תשובות מפורטות ומקיפות.',
      }
      if (lengthMap[responseLength]) systemPrompt += `\n${lengthMap[responseLength]}`
    }
    // Always inject current date and tenant context
    const now = new Date()
    const currentDate = now.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jerusalem' })
    const currentTime = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })
    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const todayISO = now.toISOString().split('T')[0]
    systemPrompt += `\n\n=== תאריך ושעה נוכחיים ===\nהיום: ${currentDate}, שעה: ${currentTime}\nתאריך ISO של היום: ${todayISO}\nתאריך ISO של מחר: ${tomorrowDate}\nחשוב: כשמבקשים "למחר" השתמש ב-${tomorrowDate}, כש"היום" השתמש ב-${todayISO}.`
    systemPrompt += `\n\n=== הקשר ארגוני ===\n${tenantContext}`

    // Inject memory context
    const memoryItems = memoryRes.data || []
    if (memoryItems.length > 0) {
      const memoryContext = memoryItems.map((m: any) => `[${m.category}] ${m.key}: ${m.content}`).join('\n')
      systemPrompt += `\n\n🧠 === זיכרון מתמשך ===\n${memoryContext}`
    }

    // Inject lead context
    if (lead_data) {
      const leadParts = Object.entries(lead_data)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
      if (leadParts.length) systemPrompt += `\n\nפרטי ליד:\n${leadParts.join('\n')}`
    }

    // WhatsApp context
    if (isCarmen) {
      systemPrompt += `\n\n⚡ **כלל תמציתיות (חובה):** תמיד ענה ב-2-3 משפטים מקסימום. אל תפרטי מעבר לנדרש. אל תציעי פעולות נוספות אלא אם נתבקשת. אל תחזרי על מה שהמשתמש אמר. פשוט בצעי ואשרי בקצרה.`
      systemPrompt += `\n\n💬 **כשעונה להודעות WhatsApp:** כתוב בסגנון קצר, ישיר וחברותי. הימנע מטקסט ארוך מדי. אל תשתמש ב-markdown בהודעות וואטסאפ.`
      systemPrompt += `\n🧠 **זיכרון:** כשהמשתמש מספר לך העדפות, שמות פרויקטים, או מידע חשוב — שמור אותם אוטומטית באמצעות save_memory.`
      // Inject caller identity for task assignment
      if (callerCampaignerId && callerName) {
        systemPrompt += `\n\n👤 **זהות המשתמש הנוכחי:** ${callerName} (campaigner_id: ${callerCampaignerId}). כשיוצרים משימה, שייך אותה אוטומטית ל-${callerName} אלא אם המשתמש מבקש במפורש לשייך למישהו אחר.`
      }
    }

    // 4. Filter tools
    const allowedTools = (agent.allowed_tools || []) as string[]
    const filteredTools = allowedTools.length > 0
      ? ALL_TOOLS.filter(t => allowedTools.includes(t.name))
      : ALL_TOOLS

    const toolsForAPI = filteredTools.map(t => ({ type: 'function', function: t }))

    // 5. Run agent with tool loop
    const model = resolveModel(agent.engine || 'gemini-3-flash')
    const maxRounds = agent.max_tool_rounds || 25
    const safeTemp = typeof temperature === 'number' ? Math.min(2, Math.max(0, temperature)) : undefined

    // Build messages with conversation history
    let messages: any[] = [{ role: 'system', content: systemPrompt }]
    
    // Add conversation history from Carmen WhatsApp sessions
    const history = Array.isArray(conversation_history) ? conversation_history : []
    for (const h of history) {
      if (h.role === 'user' || h.role === 'assistant') {
        messages.push({ role: h.role, content: h.content })
      }
    }
    
    // Add current message
    messages.push({ role: 'user', content: command_text })

    let finalOutput = ''
    const toolLog: any[] = []
    const startTime = Date.now()

    for (let round = 0; round < maxRounds; round++) {
      const payload: any = { model, messages }
      if (safeTemp !== undefined) payload.temperature = safeTemp
      if (toolsForAPI.length > 0) payload.tools = toolsForAPI

      console.log(`[AGENT] Round ${round + 1}/${maxRounds}, model=${model}`)
      const res = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.text()
        console.error(`[AGENT] AI error: ${res.status}`, err.substring(0, 200))
        if (res.status === 429) throw new Error('מגבלת קצב. נסה שוב.')
        throw new Error(`AI error: ${res.status} ${err}`)
      }

      const data = await res.json()
      const choice = data.choices?.[0]
      const msg = choice?.message

      if (!msg) break

      messages.push(msg)

      // No tool calls → done
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        finalOutput = msg.content || ''
        console.log(`[AGENT] Done after ${round + 1} rounds, output length=${finalOutput.length}`)
        break
      }

      // Execute tool calls
      const toolResults: any[] = []
      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name
        let toolArgs: Record<string, any> = {}
        try { toolArgs = JSON.parse(tc.function.arguments || '{}') } catch { /* ignore */ }

        console.log(`[AGENT] Tool call: ${toolName}`)
        let result: any
        try {
          result = await executeTool(toolName, toolArgs, supabase, resolvedTenantId, resolvedUserId, callerCampaignerId)
          console.log(`[AGENT] Tool ${toolName} OK`)
        } catch (e: any) {
          result = { error: e.message }
          console.error(`[AGENT] Tool ${toolName} ERROR: ${e.message}`)
        }

        toolLog.push({ tool: toolName, args: toolArgs, result })
        toolResults.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
      }

      messages.push(...toolResults)
    }

    const executionTime = Date.now() - startTime

    // 6. Log to automation_logs
    if (automation_id) {
      await supabase.from('automation_logs').insert({
        automation_id,
        success: true,
        payload: { command_text, user_name, agent_id, agent_name: agent.name },
        response: { agent_output: finalOutput, model, execution_time_ms: executionTime, tools_used: toolLog.map(t => t.tool) },
        execution_time_ms: executionTime,
      })
    }

    return new Response(JSON.stringify({
      success: true,
      output: finalOutput,
      agent_name: agent.name,
      model,
      execution_time_ms: executionTime,
      tools_used: toolLog.map(t => t.tool),
      tool_log: toolLog,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('run-ai-agent error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
    })
  }
})

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const AI_MODEL_DEFAULT = 'google/gemini-3-flash-preview';

function buildSystemPrompt(
  userName: string,
  userEmail: string,
  currentDateContext: string,
  memoryContext: string,
  skillsContext: string,
  campaignerName?: string,
  campaignerId?: string,
  uiMode?: string,
  carmenAgent?: { talent?: string | null; personality?: string | null; system_prompt?: string | null } | null,
) {

  return `אתה **AIOS** - עוזר AI חכם ומרכזי של מערכת CRM לניהול סוכנויות שיווק.

🕒 **תאריך/שעה נוכחיים (להתייחסות חובה):**
${currentDateContext}

👤 **אתה מדבר עם:**
- **שם:** ${userName}
- **אימייל:** ${userEmail}
${campaignerName ? `- **תפקיד:** קמפיינר - ${campaignerName}` : ''}
${campaignerId ? `- **מזהה קמפיינר:** ${campaignerId}` : ''}

${memoryContext ? `🧠 **זיכרון מתמשך — מידע שנשמר משיחות קודמות:**
${memoryContext}

` : ''}📋 **מבנה המערכת:**
- **agencies** (סוכנויות) - חברות שמנהלות קמפיינים
- **clients** (לקוחות) - לקוחות של הסוכנויות
- **tasks** (משימות) - משימות שקשורות ללקוחות/סוכנויות
- **campaigners** (קמפיינרים) - עובדים שמבצעים את העבודה
- **leads** (לידים) - לקוחות פוטנציאליים
- **automations** (אוטומציות) - כללים אוטומטיים שמגיבים לאירועים
- **suppliers** (ספקים) - ספקי שירותים
- **sales_people** (אנשי מכירות) - אנשי מכירות
- **products** (מוצרים) - מוצרים ושירותים
- **finance** (כספים) - הכנסות והוצאות
- **client_onboarding** (קליטת לקוחות) - תהליכי קליטה
- **time_entries** (מעקב זמן) - שעון נוכחות
- **crm_tables** (טבלאות דינמיות) - טבלאות CRM מותאמות

🔧 **פעולות שאתה יכול לבצע:**
1. **משימות** - יצירה, עדכון, סטטוס, רשימות
2. **לידים** - יצירה, עדכון סטטוס, חיפוש, רשימות
3. **לקוחות** - יצירה, מידע, רשימות
4. **אוטומציות** - יצירה (trigger + action)
5. **הודעות WhatsApp** - שליחה, קריאת היסטוריה
6. **חיפוש** - סוכנויות, לקוחות, קמפיינרים, לידים
7. **אימיילים** - קריאה, שליחה, מחיקה מ-Gmail
8. **זיכרון** - שמירה, שליפה, מחיקה
9. **תצוגת נתונים** - טבלאות, כרטיסים, סטטיסטיקות
10. **סוכנויות** - רשימה, מידע, עדכון
11. **קמפיינרים** - רשימה, מידע
12. **ספקים** - רשימה, יצירה, מידע
13. **אנשי מכירות** - רשימה, מידע
14. **מוצרים** - רשימה, יצירה, עדכון
15. **כספים** - רשימת תנועות, יצירת רשומה, סיכום חודשי
16. **קליטת לקוחות** - רשימה, עדכון סטטוס
17. **מעקב זמן** - רשימה, כניסה, יציאה
18. **טבלאות דינמיות** - רשימה, נתונים
19. **עדכוני לקוחות/לידים** - הוספה, רשימה
20. **Manus AI** - יצירת משימות AI מורכבות (מחקר, מצגות, ניתוח), צפייה בתוצאות
21. **ניתוח קמפיינים** - ניתוח ביצועי קמפיינים (השוואת 7 ימים מול 30 יום), זיהוי התייקרויות וירידות ביצועים
22. **עדכון בריאות לקוח** - עדכון mood_status בדשבורד CRM, יצירת התראות ב-communication_logs
23. **סקילים (Skills)** - שמירת תהליכי עבודה כקיצורי דרך, הפעלת סקילים שמורים, ניהול ספריית מיומנויות
24. **סנכרון Meta Ads** - סנכרון נתוני פייסבוק/מטה מטבלאות CRM, רענון נתוני קמפיינים
25. **טבלאות דוח** - חיבור חשבונות מודעות (Meta/Google Ads) ללקוחות, יצירת טבלאות דוח, זיהוי לקוחות לא מחוברים, יצירת מרובה (batch)
26. **תיקון טבלאות יתומות** - זיהוי טבלאות דוח ללא שיוך ללקוח (list_orphan_tables), שיוך בודד (link_table_to_client), שיוך מרובה (batch_link_tables_to_clients)

⚠️ **חשוב לגבי טבלאות דוח:**
- אחרי batch_create_report_tables, תמיד בדוק עם list_orphan_tables שלא נשארו טבלאות ללא client_id
- אם נמצאו טבלאות יתומות, השתמש ב-batch_link_tables_to_clients לשייך אותן ללקוחות הנכונים

${skillsContext ? `🎯 **סקילים שמורים (Skills) — קיצורי דרך לתהליכים:**
${skillsContext}

כשהמשתמש מזכיר שם סקיל או ביטוי שמתאים ל-trigger_phrases — טען את הסקיל עם execute_skill ובצע את הצעדים שלו.
` : ''}

${uiMode === 'aios' ? `📊 **חשוב לגבי תצוגת נתונים (display_data):**
- כשהמשתמש מבקש לראות רשימות (לידים, משימות, לקוחות) - **תמיד** השתמש ב-display_data אחרי שליפת הנתונים
- בחר את view_type המתאים: "table" לרשימות, "stats" למספרים/סיכומים, "cards" לכרטיסי מידע
- ציין columns בסדר הנכון עבור טבלאות
- הנתונים יוצגו באזור הויזואלי ליד הצ'אט` : `📊 **חשוב — אתה לא במצב AIOS:**
- **אסור** להשתמש בכלי display_data — המשתמש לא רואה וידג'טים ויזואליים
- **אסור** לדבר על "תצוגה ויזואלית", "וידג'טים", "כרטיסים" או "טבלה שמוצגת"
- כשהמשתמש מבקש נתונים — תן את התשובה בטקסט ישיר בצ'אט עם המספרים והפרטים
- דוגמה: במקום "הנה תצוגה של הלידים", כתוב "יש 12 לידים חדשים: 5 בסוכנות X, 7 בסוכנות Y"`}

📅 **חשוב לגבי משימות ויומן:**
- כשאתה יוצר או מעדכן משימה עם תאריך, תמיד נסה לסנכרן אותה ליומן
- תמיד ציין due_date כשהמשתמש אומר "להיום", "למחר", "יום שלישי הקרוב" וכו'
- עבור ביטויים יחסיים ("הקרוב", "הבא"), חובה לבחור תאריך עתידי לפי התאריך הנוכחי למעלה
- אסור לבחור תאריך עבר אלא אם המשתמש ביקש מפורשות תאריך עבר ספציפי
- אם המשתמש מבקש לערוך משימה קיימת, חובה להשתמש ב-list_tasks + update_task ולא ליצור משימה חדשה
- אם המשתמש לא ציין שעה, ברירת מחדל: 09:00
- אחרי יצירה/עדכון, דווח לפי שדה calendar_synced (ולא לפי הנחה)

🧠 **חשוב לגבי זיכרון:**
- כשהמשתמש מספר לך העדפות, שמות פרויקטים, הוראות חוזרות, או מידע חשוב — **שמור אותם אוטומטית** באמצעות save_memory
- קטגוריות מומלצות: "preferences" (העדפות), "projects" (פרויקטים), "clients" (לקוחות), "workflows" (תהליכים), "personal" (אישי), "instructions" (הוראות קבועות)
- **טריגרים בעברית** "תזכרי / זכרי / שמרי / מעכשיו / תמיד / מהיום והלאה" — חובה לקרוא ל-`save_memory` עם `category='instructions'`, `key` תיאורי קצר באנגלית (לדוגמה: `pulse_check_format`), ו-`content` שמכיל את ההוראה המלאה כפי שנאמרה. אחרי שמירה, אמור: "שמרתי. מעכשיו אפעל ככה."
- אל תשמור מידע טריוויאלי — רק דברים שיעזרו לך בשיחות עתידיות
- כש-key כבר קיים, הוא יתעדכן אוטומטית (UPSERT)
- אסור לומר "ניסיתי לשמור ולא הצלחתי" אלא אם `save_memory` באמת החזיר שגיאה — במקרה כזה דווח את השגיאה המדויקת.

💬 **הנחיות תקשורת:**
- דבר בעברית, בצורה ישירה ומקצועית
- התייחס למשתמש בשמו (${userName})
- היה פרו-אקטיבי - הצע דברים שיכולים לעזור
- תמיד הסבר מה עשית אחרי ביצוע פעולה
- **כשמבקשים לקוחות/לידים של סוכנות ספציפית** — השתמש ישירות ב-list_clients או list_leads עם הפרמטר agency_name. **אין צורך** לחפש קודם ב-search_entities — הכלי מחפש את הסוכנות אוטומטית
- **חשוב מאוד:** כשמדברים על "דשבורד CRM", "דשבורד סוכנות", "דגלים", "flags", "בריאות לקוח" או "לעדכן את הדשבורד" — הכוונה לעדכון אמיתי של mood_status ותקשורת הלקוח. במקרה כזה חובה להשתמש ב-**batch_update_client_health** (עדיף) או **update_client_health** בפועל עבור כל לקוח רלוונטי.
- אם המשתמש מבקש לעדכן דשבורד/דגלים על בסיס ביצועי קמפיינים — קודם השתמש ב-**analyze_campaign_performance**, ואז קרא ל-**batch_update_client_health** עם **כל** הלקוחות — גם אלה שתקינים (mood_status: happy) וגם אלה עם בעיות.
- **אסור** לכתוב "עדכנתי", "בוצע עדכון", "הדלקתי דגל" או ניסוח דומה אם לא הייתה קריאת **update_client_health** או **batch_update_client_health** מוצלחת בפועל.
- **כשמבצעים בדיקת דופק, עדכון דשבורד, או כל משימה שעוברת על יותר מ-5 לקוחות:**
  **חובה** להשתמש ב-**delegate_to_background** כדי להעביר את המשימה לריצה ברקע. המשימה תרוץ גם אם המשתמש סוגר את הצ׳אט.
  תיאור המשימה ב-task_description צריך לכלול הוראות מדויקות: "1. קרא ל-analyze_campaign_performance (ללא client_id, כדי לקבל את כל הלקוחות עם נתוני קמפיינים). 2. קרא ל-list_clients. 3. השווה: לכל לקוח מ-list_clients מצא את הרשומה התואמת ב-analyze_campaign_performance. 4. קרא ל-batch_update_client_health עם כל הלקוחות."
  אחרי קריאת delegate_to_background, אמור למשתמש: "התחלתי לעבוד על זה ברקע. תוכל לראות את ההתקדמות בזמן אמת, גם אם תסגור את החלון."
- **בדיקת דופק — כללי דיווח קשיחים:**
- **בדיקת דופק / מעבר דוח-דוח — כללי דיווח קשיחים:**
  • **חובה** להריץ `analyze_campaign_performance` (ללא client_id) **לפני** הסיכום — היא מחזירה את כל הלקוחות חוצי-סוכנויות וחוצי-tenants על בסיס תפקיד המשתמש (super_admin/owner רואים הכל, team_manager רק סוכנויות מנוהלות, campaigner רק לקוחותיו).
  • **אסור** לכתוב "לא זוהה נתון קמפיינים" לפני שווידאת ש-`analyze_campaign_performance` רץ והחזיר רשומה ללקוח. אם records_30d > 0 — יש נתונים והשתמש בהם.
  • **כשהמשתמש מבקש "לעבור דוח-דוח" / "כל הדוחות" / "לקוח-לקוח"** — קרא ל-`analyze_campaign_performance` עם `breakdown_by_platform=true`. אז הפלט הוא `reports[]` — שורה לכל זוג לקוח+פלטפורמה. דווח שורה אחת לכל רשומה במבנה: `<שם לקוח> · <פלטפורמה>: ספנד 7י׳ ₪X | לידים Y | CPL ₪Z | טריות N ימים`. אם `freshness_days > 2` הוסף "⚠️ דוח לא מסונכרן".
  • הדיווח הרגיל (ללא breakdown): שורה אחת לכל לקוח במבנה **שם** — משפט סיכום אחד עם spend/leads/CPL ושינוי %. ללא חפירות, ללא חזרה על "אין נתונים" כשיש.
  • בסוף הסיכום ציין מספר מדויק של לקוחות/דוחות שנסרקו ולא ניסוח מעורפל כמו "כל הלקוחות".


📋 **מיפוי סטטוסי תקשורת (עברית ↔ API):**
- **תקין** / **רגוע** / **הכל בסדר** → mood_status: \`happy\`, communication_status: \`normal\`
- **רגיש** / **זהירות** / **צריך תשומת לב** → mood_status: \`wavering\`, communication_status: \`sensitive\`
- **תלונה** / **כועס** / **סיכון נטישה** / **בעיה** → mood_status: \`churn_risk\`, communication_status: \`complaint\`
כשהמשתמש אומר "תעדכני את [לקוח] ל-תלונה" או "הלקוח רגיש" — קרא ל-update_client_health עם הערכים המתאימים מהמיפוי הזה.
- אם משהו לא ברור, שאל במקום לנחש
- השתמש ב-markdown לעיצוב התשובות

⚠️ **קריטי - שימוש ב-IDs:**

🎓 **חשוב לגבי סקילים (Skills):**
- כשהמשתמש אומר "תשמרי סקיל", "שמרי את זה כ-skill", "תשמרי מיומנות" → סכם את התהליך שבוצע בשיחה ושמור עם save_skill
- כשהמשתמש מזכיר שם סקיל שמור או אומר "תפעילי סקיל X", "תריצי את X" → טען עם execute_skill ובצע את הצעדים
- אחרי טעינת סקיל עם execute_skill, **חובה לבצע** את כל הצעדים המפורטים ב-steps באמצעות הכלים הקיימים שלך
- כאשר אתה מחפש ישות ומקבל תוצאות, חובה להשתמש ב-UUID המדויק מהתוצאה!
- **אל תמציא** IDs - חפש קודם ואז השתמש ב-ID האמיתי.

📌 **חשוב מאוד - הבדל בין סוגי משימות:**
- **create_task** = משימה לצוות (קמפיינרים, אנשי מכירות). מופיעה ב"משימות" הרגילות. השתמשי בזה כשרוצים לתת משימה לאדם בצוות.
- **create_agent_task** = משימה לכרמן עצמה. מופיעה ב"ניהול משימות סוכנים". השתמשי בזה כשמבקשים ממך ליצור משימה לעצמך, סריקה תקופתית, תזכורת, או משימה חוזרת.
- כלל אצבע: אם המשתמש אומר "תקימי לעצמך", "תיצרי לך משימה", "תעקבי אחרי", "הקימי משימה חוזרת" → **create_agent_task**. אם המשתמש אומר "תיצרי משימה ל-X" (שם של קמפיינר) → **create_task**.

⚠️ **לפני יצירת אוטומציה:**
- וודא שהמשתמש ציין trigger_type ו-action_type ברורים
- שאל לפרטים חסרים אם צריך

⚠️ **לפני שליחת הודעה:**
- עדיפות: חפש קודם את איש הקשר כדי לקבל את ה-ID שלו
- אם המשתמש נותן מספר טלפון מפורש, אפשר לשלוח ישירות עם send_message באמצעות phone (גם בלי contact_id)
- וודא שיש מספר טלפון תקין
- **אסור לטעון "שלחתי" או "נשלח" בלי קריאת send_message מוצלחת בפועל**; אם הכלי נכשל חובה לדווח את השגיאה כפי שהיא.
- **חשוב מאוד:** כשאתה שולח הודעת WhatsApp, ההודעה תתחיל אוטומטית עם חתימה שמציגה אותך כעוזר AI שפועל בשם ${userName}. אל תוסיף הצגה עצמית בגוף ההודעה — זה כבר מובנה.

💬 **שיחות WhatsApp:**
- אתה יכול לשלוף היסטוריית שיחות עם לקוח/ליד כדי להבין הקשר לפני שאתה שולח הודעה
- השתמש ב-get_chat_history כדי לראות שיחות אחרונות עם איש קשר ספציפי
- **כששואלים "מי חיפש אותי?", "מה ההודעה האחרונה?", "מישהו כתב לי?", "תראה לי הודעות אחרונות"** — השתמש ב-**get_recent_inbound_messages** כדי לסרוק את כל ההודעות הנכנסות מכל השיחות (לקוחות, לידים, קבוצות, ואנשי קשר לא משויכים)
- אחרי שליפת הודעות אחרונות, הצג סיכום טקסטואלי קצר + השתמש ב-display_data עם view_type="table" כדי להציג את ההודעות בטבלה

🤖 **Manus AI — סוכן AI חיצוני:**
- Manus הוא סוכן AI עצמאי שיכול לבצע משימות מורכבות: מחקר שוק, ניתוח מתחרים, יצירת מצגות, כתיבת תוכן, ניתוח נתונים, בניית אתרים ועוד
- יש לך 3 כלים: create_manus_task (יצירת משימה חדשה), list_manus_tasks (רשימת כל המשימות), get_manus_task_result (שליפת תוצאות משימה שהסתיימה)
- משימות Manus רצות ברקע ולוקחות זמן (דקות עד שעות) — דווח למשתמש שהמשימה נשלחה בהצלחה ושיוכל לבדוק תוצאות אחר כך
- **מתי להציע Manus**: כשמשתמש מבקש מחקר לקוח/מתחרים, יצירת מצגת, ניתוח נתונים מורכב, כתיבת דוח מפורט, סיכום שוק, או כל משימה שדורשת עבודה ממושכת ומעמיקה
- מודלים זמינים: manus-1.6 (ברירת מחדל, מאוזן), manus-1.6-lite (מהיר וזול), manus-1.6-max (למשימות מורכבות במיוחד)
- מצבי עבודה (mode): agent (ביצוע עצמאי — ברירת מחדל), chat (שיחה אינטראקטיבית), adaptive (בחירה אוטומטית)
- כש-create_manus_task מצליח, הצג למשתמש את ה-task_id ואמור שהמשימה נשלחה לעיבוד
- כשמשתמש שואל על סטטוס משימת Manus, השתמש ב-list_manus_tasks ואם סיימה — get_manus_task_result

${carmenAgent ? `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎭 **הגדרות הסוכנת (מתוך AgentEditor — כרמן):**\n${carmenAgent.talent ? `- **טלנט/מומחיות:** ${carmenAgent.talent}` : ''}
${carmenAgent.personality ? `- **אישיות:** ${carmenAgent.personality}` : ''}
${carmenAgent.system_prompt ? `\n**הנחיות מותאמות:**\n${carmenAgent.system_prompt}` : ''}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : ''}`;
}


interface ToolCall {
  name: string;
  args: Record<string, any>;
}

function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function normalizeTimeString(timeValue: string | null | undefined, fallback = '09:00'): string {
  if (!timeValue) return fallback;
  const match = timeValue.match(/^(\d{2}):(\d{2})/);
  if (!match) return fallback;
  return `${match[1]}:${match[2]}`;
}

function buildLocalDateTimeRange(dateStr: string, timeStr: string, durationMinutes = 30) {
  const safeTime = normalizeTimeString(timeStr);
  const [hour, minute] = safeTime.split(':').map(Number);

  const start = parseDateString(dateStr);
  start.setHours(hour, minute, 0, 0);

  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const startLocalDateTime = `${formatDateString(start)}T${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}:00`;
  const endLocalDateTime = `${formatDateString(end)}T${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}:00`;

  return { startLocalDateTime, endLocalDateTime, safeTime };
}

// Track which entities were modified during tool execution
const modifiedEntities: Set<string> = new Set();

// ─────────────────────────────────────────────────────────────────────────────
// Carmen scope resolver
// Returns the tenants Carmen may pull data from and the per-role client filter.
//   • super_admin / owner / agency_owner / agency_manager → full tenant +
//     every agency shared in via agency_tenant_access.
//   • team_manager → only agencies in user_managed_agencies.
//   • campaigner   → only active/onboarding clients of campaigner_agencies.
// ─────────────────────────────────────────────────────────────────────────────
type CarmenScope = {
  role: string;
  accessibleTenantIds: string[];
  sharedAgencyIds: string[];
  managedAgencyIds: string[] | null;
  campaignerId: string | null;
  restrictStatuses: string[] | null;
};

async function resolveCarmenScope(
  supabaseClient: any,
  userId: string,
  tenantId: string,
): Promise<CarmenScope> {
  const { data: roleRows } = await supabaseClient
    .from('user_roles')
    .select('role, tenant_id')
    .eq('user_id', userId);
  const rolesInTenant = (roleRows || []).filter((r: any) => r.tenant_id === tenantId || r.role === 'super_admin');
  const roleSet = new Set<string>(rolesInTenant.map((r: any) => r.role));
  const role =
    roleSet.has('super_admin') ? 'super_admin'
    : roleSet.has('owner') ? 'owner'
    : roleSet.has('agency_owner') ? 'agency_owner'
    : roleSet.has('agency_manager') ? 'agency_manager'
    : roleSet.has('team_manager') ? 'team_manager'
    : roleSet.has('campaigner') ? 'campaigner'
    : 'viewer';

  const { data: ata } = await supabaseClient
    .from('agency_tenant_access')
    .select('agency_id, source_tenant_id, accessing_tenant_id')
    .or(`accessing_tenant_id.eq.${tenantId},source_tenant_id.eq.${tenantId}`);

  const sharedAgencyIds: string[] = Array.from(new Set((ata || []).map((r: any) => r.agency_id).filter(Boolean) as string[]));
  const tenantSet = new Set<string>([tenantId]);
  for (const r of ata || []) {
    if (r.source_tenant_id) tenantSet.add(r.source_tenant_id);
    if (r.accessing_tenant_id) tenantSet.add(r.accessing_tenant_id);
  }

  let managedAgencyIds: string[] | null = null;
  let campaignerId: string | null = null;
  let restrictStatuses: string[] | null = null;

  if (role === 'team_manager') {
    const { data: managed } = await supabaseClient
      .from('user_managed_agencies')
      .select('agency_id')
      .eq('user_id', userId);
    managedAgencyIds = (managed || []).map((m: any) => m.agency_id).filter(Boolean);
  } else if (role === 'campaigner') {
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('campaigner_id')
      .eq('id', userId)
      .maybeSingle();
    campaignerId = profile?.campaigner_id || null;
    restrictStatuses = ['active', 'onboarding'];
  }

  return {
    role,
    accessibleTenantIds: Array.from(tenantSet),
    sharedAgencyIds,
    managedAgencyIds,
    campaignerId,
    restrictStatuses,
  };
}

async function executeTool(
  toolCall: ToolCall, 
  supabaseClient: any, 
  userId: string, 
  tenantId: string,
  userToken?: string
): Promise<{ success: boolean; result?: any; error?: string }> {

  try {
    switch (toolCall.name) {
      case 'create_task': {
        const { title, client_id, priority, due_date, due_time, notes, campaigner_id: targetCampaignerId } = toolCall.args;
        
        // Determine which campaigner to assign to
        let assignCampaignerId: string;
        let assignAgencyId: string;

        if (targetCampaignerId) {
          // Assign to specific campaigner
          assignCampaignerId = targetCampaignerId;
          const { data: targetAgency } = await supabaseClient
            .from('campaigner_agencies')
            .select('agency_id')
            .eq('campaigner_id', targetCampaignerId)
            .limit(1)
            .maybeSingle();
          if (!targetAgency?.agency_id) {
            return { success: false, error: 'לא נמצאה סוכנות מקושרת לקמפיינר המבוקש.' };
          }
          assignAgencyId = targetAgency.agency_id;
        } else {
          // Default: assign to current user
          const { data: profileData } = await supabaseClient
            .from('profiles')
            .select('campaigner_id')
            .eq('id', userId)
            .maybeSingle();
          
          if (!profileData?.campaigner_id) {
            return { success: false, error: 'לא נמצא קמפיינר מקושר למשתמש שלך.' };
          }
          assignCampaignerId = profileData.campaigner_id;

          const { data: campaignerAgency } = await supabaseClient
            .from('campaigner_agencies')
            .select('agency_id')
            .eq('campaigner_id', assignCampaignerId)
            .limit(1)
            .maybeSingle();
          if (!campaignerAgency?.agency_id) {
            return { success: false, error: 'לא נמצאה סוכנות מקושרת לקמפיינר שלך.' };
          }
          assignAgencyId = campaignerAgency.agency_id;
        }

        const taskData: any = {
          title,
          agency_id: assignAgencyId,
          campaigner_id: assignCampaignerId,
          tenant_id: tenantId,
          priority: priority || 5,
          status: 'open',
          task_type: 'other',
        };
        if (client_id) taskData.client_id = client_id;
        if (due_date) taskData.due_date = due_date;
        if (due_time) taskData.due_time = due_time;
        if (notes) taskData.notes = notes;

        const { data, error } = await supabaseClient
          .from('tasks').insert(taskData)
          .select('*, clients(name), agencies(name), campaigners(full_name)')
          .maybeSingle();
        if (error) throw error;

        // Mark tasks as modified for UI invalidation
        modifiedEntities.add('tasks');

        // Auto-sync to Google Calendar if due_date is set
        let calendarSynced = false;
        let calendarSyncError: string | null = null;
        let calendarEventId: string | null = null;
        let calendarHtmlLink: string | null = null;
        let calendarGoogleEmail: string | null = null;
        let scheduledStartIso: string | null = null;

        if (due_date) {
          try {
            const { data: calendarToken } = await supabaseClient
              .from('calendar_tokens')
              .select('id, google_email')
              .eq('user_id', userId)
              .maybeSingle();

            if (!calendarToken) {
              calendarSyncError = 'calendar_not_connected';
            } else {
              calendarGoogleEmail = calendarToken.google_email || null;

              const todayInIsrael = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Jerusalem',
              }).format(new Date());

              if (due_date < todayInIsrael) {
                calendarSyncError = 'due_date_in_past';
              } else {
                const { startLocalDateTime, endLocalDateTime, safeTime } = buildLocalDateTimeRange(
                  due_date,
                  due_time || '09:00',
                  30,
                );

                scheduledStartIso = `${due_date}T${safeTime}:00`;

                const calResponse = await fetch(`${SUPABASE_URL}/functions/v1/add-calendar-event`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`,
                  },
                  body: JSON.stringify({
                    summary: title,
                    description: notes || 'משימה ממערכת Marketing Captain',
                    start: startLocalDateTime,
                    end: endLocalDateTime,
                  }),
                });

                if (calResponse.ok) {
                  const calData = await calResponse.json();
                  if (calData.eventId) {
                    calendarEventId = calData.eventId;
                    calendarHtmlLink = calData.htmlLink || null;
                    await supabaseClient
                      .from('tasks')
                      .update({ google_calendar_event_id: calData.eventId })
                      .eq('id', data.id);
                    calendarSynced = true;
                  } else {
                    calendarSyncError = 'calendar_event_id_missing';
                  }
                } else {
                  calendarSyncError = 'calendar_api_error';
                  console.error('Failed to create calendar event:', await calResponse.text());
                }
              }
            }
          } catch (calErr) {
            calendarSyncError = 'calendar_sync_exception';
            console.error('Calendar sync error:', calErr);
          }
        }

        return {
          success: true,
          result: {
            task_id: data.id,
            title: data.title,
            client_name: data.clients?.name,
            agency_name: data.agencies?.name,
            campaigner_name: data.campaigners?.full_name,
            priority: data.priority,
            due_date: data.due_date,
            due_time: data.due_time,
            calendar_synced: calendarSynced,
            calendar_sync_error: calendarSyncError,
            calendar_event_id: calendarEventId,
            calendar_html_link: calendarHtmlLink,
            calendar_google_email: calendarGoogleEmail,
            calendar_start_iso: scheduledStartIso,
          },
        };
      }

      case 'create_agent_task': {
        const { title, description, priority, schedule_type, scheduled_at, cron_expression, task_skills } = toolCall.args;

        // Find Carmen agent for this tenant
        const { data: agentData } = await supabaseClient
          .from('ai_agents')
          .select('id')
          .eq('tenant_id', tenantId)
          .ilike('name', '%carmen%')
          .limit(1)
          .maybeSingle();

        let agentId = agentData?.id;
        if (!agentId) {
          // Fallback: get any active agent
          const { data: fallbackAgent } = await supabaseClient
            .from('ai_agents')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('active', true)
            .limit(1)
            .maybeSingle();
          if (!fallbackAgent?.id) {
            return { success: false, error: 'לא נמצא סוכן AI בארגון.' };
          }
          agentId = fallbackAgent.id;
        }

        const agentTaskData: any = {
          agent_id: agentId,
          tenant_id: tenantId,
          title,
          description: description || null,
          priority: priority || 5,
          status: 'pending',
          schedule_type: schedule_type || 'once',
          scheduled_at: scheduled_at || null,
          cron_expression: cron_expression || null,
          task_skills: task_skills ? JSON.stringify(task_skills) : null,
          task_mode: 'agent',
          enabled: true,
          created_by: userId,
        };

        const { data: agentTask, error: agentTaskError } = await supabaseClient
          .from('agent_tasks')
          .insert(agentTaskData)
          .select('id, title, status, schedule_type')
          .maybeSingle();
        if (agentTaskError) throw agentTaskError;

        modifiedEntities.add('agent_tasks');

        return {
          success: true,
          result: {
            agent_task_id: agentTask.id,
            title: agentTask.title,
            status: agentTask.status,
            schedule_type: agentTask.schedule_type,
            message: 'המשימה נוצרה בהצלחה בניהול משימות סוכנים',
          },
        };
      }

      case 'update_task': {
        const { task_id, title, priority, due_date, due_time, notes, status } = toolCall.args;

        const { data: existingTask, error: existingError } = await supabaseClient
          .from('tasks')
          .select('id, title, notes, due_date, due_time, priority, status, google_calendar_event_id')
          .eq('id', task_id)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (existingError || !existingTask) {
          return { success: false, error: 'לא נמצאה משימה לעדכון' };
        }

        const updateData: Record<string, any> = {};
        if (title !== undefined) updateData.title = title;
        if (priority !== undefined) updateData.priority = priority;
        if (due_date !== undefined) updateData.due_date = due_date;
        if (due_time !== undefined) updateData.due_time = due_time;
        if (notes !== undefined) updateData.notes = notes;
        if (status !== undefined) updateData.status = status;

        if (Object.keys(updateData).length === 0) {
          return { success: false, error: 'לא נשלחו שדות לעדכון' };
        }

        const { data: updatedTask, error: updateError } = await supabaseClient
          .from('tasks')
          .update(updateData)
          .eq('id', task_id)
          .eq('tenant_id', tenantId)
          .select('id, title, notes, due_date, due_time, priority, status, google_calendar_event_id')
          .maybeSingle();

        if (updateError || !updatedTask) throw updateError || new Error('שגיאה בעדכון המשימה');

        // Mark tasks as modified for UI invalidation
        modifiedEntities.add('tasks');

        let calendarSynced = false;
        let calendarSyncError: string | null = null;
        let calendarEventId: string | null = updatedTask.google_calendar_event_id || null;
        let calendarHtmlLink: string | null = null;

        const finalDueDate = updatedTask.due_date;
        const finalDueTime = normalizeTimeString(updatedTask.due_time, '09:00');

        const shouldSyncCalendar = !!finalDueDate && (
          due_date !== undefined ||
          due_time !== undefined ||
          title !== undefined ||
          notes !== undefined ||
          !!updatedTask.google_calendar_event_id
        );

        if (shouldSyncCalendar) {
          try {
            const { data: calendarToken } = await supabaseClient
              .from('calendar_tokens')
              .select('id')
              .eq('user_id', userId)
              .maybeSingle();

            if (!calendarToken) {
              calendarSyncError = 'calendar_not_connected';
            } else {
              const todayInIsrael = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Jerusalem',
              }).format(new Date());

              if (finalDueDate < todayInIsrael) {
                calendarSyncError = 'due_date_in_past';
              } else {
                const { startLocalDateTime, endLocalDateTime } = buildLocalDateTimeRange(
                  finalDueDate,
                  finalDueTime,
                  30,
                );

                if (updatedTask.google_calendar_event_id) {
                  const updateResponse = await fetch(`${SUPABASE_URL}/functions/v1/update-calendar-event`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${userToken}`,
                    },
                    body: JSON.stringify({
                      eventId: updatedTask.google_calendar_event_id,
                      summary: updatedTask.title,
                      description: updatedTask.notes || 'משימה ממערכת Marketing Captain',
                      start: startLocalDateTime,
                      end: endLocalDateTime,
                    }),
                  });

                  if (updateResponse.ok) {
                    const updateCalData = await updateResponse.json();
                    calendarSynced = true;
                    calendarEventId = updateCalData.eventId || updatedTask.google_calendar_event_id;
                    calendarHtmlLink = updateCalData.htmlLink || null;
                  } else {
                    calendarSyncError = 'calendar_update_error';
                    console.error('Failed to update calendar event:', await updateResponse.text());
                  }
                } else {
                  const addResponse = await fetch(`${SUPABASE_URL}/functions/v1/add-calendar-event`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${userToken}`,
                    },
                    body: JSON.stringify({
                      summary: updatedTask.title,
                      description: updatedTask.notes || 'משימה ממערכת Marketing Captain',
                      start: startLocalDateTime,
                      end: endLocalDateTime,
                    }),
                  });

                  if (addResponse.ok) {
                    const addCalData = await addResponse.json();
                    if (addCalData.eventId) {
                      calendarSynced = true;
                      calendarEventId = addCalData.eventId;
                      calendarHtmlLink = addCalData.htmlLink || null;
                      await supabaseClient
                        .from('tasks')
                        .update({ google_calendar_event_id: addCalData.eventId })
                        .eq('id', updatedTask.id)
                        .eq('tenant_id', tenantId);
                    } else {
                      calendarSyncError = 'calendar_event_id_missing';
                    }
                  } else {
                    calendarSyncError = 'calendar_create_error';
                    console.error('Failed to create calendar event on update:', await addResponse.text());
                  }
                }
              }
            }
          } catch (calendarErr) {
            calendarSyncError = 'calendar_sync_exception';
            console.error('Calendar sync error on update_task:', calendarErr);
          }
        }

        return {
          success: true,
          result: {
            task_id: updatedTask.id,
            title: updatedTask.title,
            priority: updatedTask.priority,
            due_date: updatedTask.due_date,
            due_time: updatedTask.due_time,
            status: updatedTask.status,
            calendar_synced: calendarSynced,
            calendar_sync_error: calendarSyncError,
            calendar_event_id: calendarEventId,
            calendar_html_link: calendarHtmlLink,
          },
        };
      }

      case 'update_task_status': {
        const { task_id, status } = toolCall.args;
        const { data, error } = await supabaseClient
          .from('tasks').update({ status }).eq('id', task_id).eq('tenant_id', tenantId)
          .select('*, clients(name), agencies(name)').maybeSingle();
        if (error) throw error;
        modifiedEntities.add('tasks');
        return { success: true, result: { task_id: data.id, title: data.title, status: data.status, client_name: data.clients?.name } };
      }

      case 'list_tasks': {
        const { agency_id, client_id, status, limit = 20, my_tasks = false } = toolCall.args;
        const { data: profileData } = await supabaseClient.from('profiles').select('campaigner_id').eq('id', userId).maybeSingle();
        const userCampaignerId = profileData?.campaigner_id;

        let query = supabaseClient.from('tasks')
          .select('*, clients(name), agencies(name), campaigners(full_name)')
          .eq('tenant_id', tenantId)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(limit);

        if (my_tasks && userCampaignerId) query = query.eq('campaigner_id', userCampaignerId);
        if (agency_id) query = query.eq('agency_id', agency_id);
        if (client_id) query = query.eq('client_id', client_id);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (error) throw error;

        return { success: true, result: {
          count: data.length,
          is_filtered_by_user: my_tasks && !!userCampaignerId,
          tasks: data.map((t: any) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, due_date: t.due_date, client_name: t.clients?.name, agency_name: t.agencies?.name, campaigner_name: t.campaigners?.full_name }))
        }};
      }

      case 'get_client_info': {
        const { client_id } = toolCall.args;
        const { data, error } = await supabaseClient.from('clients').select('*, agencies(name)').eq('id', client_id).eq('tenant_id', tenantId).maybeSingle();
        if (error) throw error;
        return { success: true, result: { id: data.id, name: data.name, status: data.status, email: data.email, phone: data.phone, industry: data.industry, agency_name: data.agencies?.name, monthly_budget: data.monthly_budget, retainer: data.retainer, start_date: data.start_date } };
      }

      case 'search_entities': {
        const { entity_type, search_term, agency_id: searchAgencyId } = toolCall.args;
        let tableName = '', selectFields = '*', nameField = 'name';
        if (entity_type === 'agency') { tableName = 'agencies'; selectFields = 'id, name, status'; }
        else if (entity_type === 'client') { tableName = 'clients'; selectFields = 'id, name, status, email, phone, agency_id, agencies(name)'; }
        else if (entity_type === 'campaigner') { tableName = 'campaigners'; selectFields = 'id, full_name, email, phone, role, active'; nameField = 'full_name'; }
        else if (entity_type === 'lead') { tableName = 'leads'; selectFields = 'id, company_name, contact_name, email, phone, status, source, agency_id, agencies(name)'; nameField = 'company_name'; }
        else throw new Error(`Unknown entity type: ${entity_type}`);

        let query = supabaseClient.from(tableName).select(selectFields).eq('tenant_id', tenantId).ilike(nameField, `%${search_term}%`).limit(10);
        if (searchAgencyId && (entity_type === 'client' || entity_type === 'lead')) {
          query = query.eq('agency_id', searchAgencyId);
        }
        const { data, error } = await query;
        if (error) throw error;
        return { success: true, result: { entity_type, count: data.length, results: data } };
      }

      case 'create_lead': {
        const { company_name, contact_name, phone, email, source, notes } = toolCall.args;
        
        const { data: defaultAgency } = await supabaseClient.from('agencies').select('id').eq('tenant_id', tenantId).eq('is_default', true).limit(1).maybeSingle();
        const agencyId = defaultAgency?.id;
        if (!agencyId) {
          const { data: firstAgency } = await supabaseClient.from('agencies').select('id').eq('tenant_id', tenantId).limit(1).maybeSingle();
          if (!firstAgency?.id) return { success: false, error: 'לא נמצאה סוכנות' };
        }

        const leadData: any = {
          company_name: company_name || contact_name || 'ליד חדש',
          contact_name,
          phone,
          email,
          source: source || 'aios',
          notes,
          status: 'new',
          agency_id: agencyId || (await supabaseClient.from('agencies').select('id').eq('tenant_id', tenantId).limit(1).single()).data?.id,
          tenant_id: tenantId,
        };

        const { data, error } = await supabaseClient.from('leads').insert(leadData).select('id, company_name, contact_name, status').maybeSingle();
        if (error) throw error;
        modifiedEntities.add('leads');
        return { success: true, result: { lead_id: data.id, company_name: data.company_name, contact_name: data.contact_name, status: data.status } };
      }

      case 'update_lead_status': {
        const { lead_id, status } = toolCall.args;
        const { data, error } = await supabaseClient.from('leads').update({ status }).eq('id', lead_id).eq('tenant_id', tenantId).select('id, company_name, status').maybeSingle();
        if (error) throw error;
        modifiedEntities.add('leads');
        return { success: true, result: { lead_id: data.id, company_name: data.company_name, status: data.status } };
      }

      case 'list_leads': {
        const { status, limit = 100, source, agency_id: leadsAgencyId, agency_name: leadsAgencyName } = toolCall.args;
        
        let resolvedAgencyId = leadsAgencyId;
        if (!resolvedAgencyId && leadsAgencyName) {
          const { data: agencyMatch } = await supabaseClient.from('agencies').select('id').eq('tenant_id', tenantId).ilike('name', `%${leadsAgencyName}%`).limit(1).maybeSingle();
          if (agencyMatch) resolvedAgencyId = agencyMatch.id;
        }
        
        let query = supabaseClient.from('leads').select('id, company_name, contact_name, phone, email, status, source, created_at, agency_id, agencies(name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(limit);
        if (status) query = query.eq('status', status);
        if (source) query = query.eq('source', source);
        if (resolvedAgencyId) query = query.eq('agency_id', resolvedAgencyId);
        const { data, error } = await query;
        if (error) throw error;
        return { success: true, result: { count: data.length, leads: data.map((l: any) => ({ id: l.id, company_name: l.company_name, contact_name: l.contact_name, phone: l.phone, email: l.email, status: l.status, source: l.source, agency_name: l.agencies?.name, created_at: l.created_at })) } };
      }

      case 'list_clients': {
        const { status, limit = 200, agency_id: clientsAgencyId, agency_name: clientsAgencyName } = toolCall.args;
        const scope = await resolveCarmenScope(supabaseClient, userId, tenantId);

        // Resolve agency by name across accessible tenants (so "DMM" matches even
        // when the agency lives in another tenant but is shared into this one).
        let resolvedClientAgencyId = clientsAgencyId;
        if (!resolvedClientAgencyId && clientsAgencyName) {
          const { data: agencyMatch } = await supabaseClient
            .from('agencies')
            .select('id, tenant_id')
            .in('tenant_id', scope.accessibleTenantIds)
            .ilike('name', `%${clientsAgencyName}%`)
            .limit(1)
            .maybeSingle();
          if (agencyMatch) resolvedClientAgencyId = agencyMatch.id;
        }

        let query = supabaseClient
          .from('clients')
          .select('id, name, contact_name, phone, email, status, agency_id, tenant_id, agencies(name)')
          .order('created_at', { ascending: false })
          .limit(limit);

        // Cross-tenant visibility: clients of this tenant OR clients whose agency
        // is shared in via agency_tenant_access.
        if (scope.sharedAgencyIds.length > 0) {
          query = query.or(`tenant_id.eq.${tenantId},agency_id.in.(${scope.sharedAgencyIds.join(',')})`);
        } else {
          query = query.eq('tenant_id', tenantId);
        }

        // Role-based scoping.
        if (scope.role === 'team_manager') {
          const ids = scope.managedAgencyIds || [];
          if (ids.length === 0) return { success: true, result: { count: 0, clients: [], scope: scope.role } };
          query = query.in('agency_id', ids);
        }

        if (status) query = query.eq('status', status);
        else if (scope.restrictStatuses) query = query.in('status', scope.restrictStatuses);
        if (resolvedClientAgencyId) query = query.eq('agency_id', resolvedClientAgencyId);

        const { data, error } = await query;
        if (error) throw error;

        let clients = data || [];

        // Campaigner: only their assigned clients (via client_team).
        if (scope.role === 'campaigner' && scope.campaignerId) {
          const ids = clients.map((c: any) => c.id);
          if (ids.length === 0) {
            return { success: true, result: { count: 0, clients: [], scope: 'campaigner' } };
          }
          const { data: teamRows } = await supabaseClient
            .from('client_team')
            .select('client_id')
            .eq('campaigner_id', scope.campaignerId)
            .in('client_id', ids);
          const allowed = new Set((teamRows || []).map((t: any) => t.client_id));
          clients = clients.filter((c: any) => allowed.has(c.id));
        }

        return {
          success: true,
          result: {
            count: clients.length,
            scope: scope.role,
            clients: clients.map((c: any) => ({
              id: c.id,
              name: c.name,
              contact_name: c.contact_name,
              phone: c.phone,
              email: c.email,
              status: c.status,
              agency_id: c.agency_id,
              tenant_id: c.tenant_id,
              agency_name: c.agencies?.name,
            })),
          },
        };
      }

      case 'create_client': {
        const { name, contact_name, phone, email, industry, notes } = toolCall.args;
        const { data: defaultAgency } = await supabaseClient.from('agencies').select('id').eq('tenant_id', tenantId).eq('is_default', true).limit(1).maybeSingle();
        let agencyId = defaultAgency?.id;
        if (!agencyId) {
          const { data: firstAgency } = await supabaseClient.from('agencies').select('id').eq('tenant_id', tenantId).limit(1).maybeSingle();
          agencyId = firstAgency?.id;
        }
        if (!agencyId) return { success: false, error: 'לא נמצאה סוכנות' };

        const { data, error } = await supabaseClient.from('clients').insert({
          name, contact_name, phone, email, industry, notes, status: 'active', agency_id: agencyId, tenant_id: tenantId,
        }).select('id, name, status').maybeSingle();
        if (error) throw error;
        modifiedEntities.add('clients');
        return { success: true, result: { client_id: data.id, name: data.name, status: data.status } };
      }

      case 'create_automation': {
        const { name, description, trigger_type, action_type, configuration } = toolCall.args;
        const { data, error } = await supabaseClient.from('automations').insert({
          name, description, trigger_type, action_type, configuration: configuration || {}, tenant_id: tenantId, active: true,
        }).select('id, name, trigger_type, action_type, active').maybeSingle();
        if (error) throw error;
        return { success: true, result: { automation_id: data.id, name: data.name, trigger_type: data.trigger_type, action_type: data.action_type, active: data.active } };
      }

      case 'list_emails': {
        const { query, maxResults = 10, date } = toolCall.args;
        let q = query || '';
        if (date) {
          const nextDay = new Date(date);
          nextDay.setDate(nextDay.getDate() + 1);
          const fmt = (d: Date) => `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
          q = `after:${fmt(new Date(date))} before:${fmt(nextDay)} ${q}`.trim();
        }
        const authHeader2 = `Bearer ${userToken}`;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/gmail-api`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader2 },
          body: JSON.stringify({ action: 'list', query: q, maxResults }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error || 'Gmail API error' };
        return { success: true, result: { count: data.messages?.length || 0, emails: (data.messages || []).map((m: any) => ({ id: m.id, from: m.from, subject: m.subject, snippet: m.snippet, date: m.date, isUnread: m.isUnread })) } };
      }

      case 'get_email': {
        const { message_id } = toolCall.args;
        const authHeader2 = `Bearer ${userToken}`;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/gmail-api`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader2 },
          body: JSON.stringify({ action: 'get', messageId: message_id }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error || 'Gmail API error' };
        return { success: true, result: { id: data.id, from: data.from, to: data.to, subject: data.subject, date: data.date, body: data.body?.slice(0, 2000) } };
      }

      case 'send_email': {
        const { to, subject, body: emailBody } = toolCall.args;
        const authHeader2 = `Bearer ${userToken}`;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/gmail-api`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader2 },
          body: JSON.stringify({ action: 'send', to, subject, body: emailBody }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error || 'Send failed' };
        return { success: true, result: { sent: true, to, subject } };
      }

      case 'delete_email': {
        const { message_id } = toolCall.args;
        const authHeader2 = `Bearer ${userToken}`;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/gmail-api`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader2 },
          body: JSON.stringify({ action: 'trash', messageId: message_id }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error || 'Delete failed' };
        return { success: true, result: { deleted: true, message_id } };
      }

      case 'send_message': {
        const { contact_type, contact_id, message_text, phone: directPhone, phoneNumber: directPhoneNumber } = toolCall.args;

        if (!message_text || typeof message_text !== 'string') {
          return { success: false, error: 'חסר message_text תקין לשליחה' };
        }
        
        // Get the sender's name for the AI signature
        const { data: senderProfile } = await supabaseClient.from('profiles').select('full_name').eq('id', userId).maybeSingle();
        const senderName = senderProfile?.full_name || 'המנהל';
        
        let phone: string | null = directPhoneNumber || directPhone || null;
        let contactName: string | null = null;
        let resolvedContactType: 'lead' | 'client' | null = null;
        let resolvedContactId: string | null = null;
        
        if (contact_type && contact_id) {
          if (contact_type === 'lead') {
            const { data } = await supabaseClient
              .from('leads')
              .select('phone, company_name, contact_name, active_chat_provider')
              .eq('id', contact_id)
              .maybeSingle();

            if (data) {
              phone = phone || data.phone;
              contactName = data?.contact_name || data?.company_name;
              resolvedContactType = 'lead';
              resolvedContactId = contact_id;
            }
          } else if (contact_type === 'client') {
            const { data } = await supabaseClient
              .from('clients')
              .select('phone, name, contact_name, active_chat_provider')
              .eq('id', contact_id)
              .maybeSingle();

            if (data) {
              phone = phone || data.phone;
              contactName = data?.contact_name || data?.name;
              resolvedContactType = 'client';
              resolvedContactId = contact_id;
            }
          } else {
            return { success: false, error: 'contact_type לא תקין. השתמש ב-lead או client' };
          }
        }

        if (!phone) return { success: false, error: 'לא נמצא מספר טלפון עבור איש הקשר' };

        // Prepend AI self-introduction
        const aiSignature = `🤖 *הודעה מהעוזר הדיגיטלי של ${senderName}*\n\n`;
        const fullMessage = aiSignature + message_text;

        try {
          const payload: Record<string, any> = {
            phoneNumber: phone,
            message: fullMessage,
            tenantId,
            senderUserId: userId,
          };

          if (resolvedContactType && resolvedContactId) {
            payload[`${resolvedContactType}Id`] = resolvedContactId;
          }

          const sendResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-green-api-message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify(payload),
          });

          const sendResult = await sendResponse.json().catch(() => null);

          if (!sendResponse.ok) {
            const errText = sendResult?.error || JSON.stringify(sendResult) || 'Send failed';
            throw new Error(errText);
          }

          return {
            success: true,
            result: {
              sent_to: contactName || phone,
              phone,
              message_preview: message_text.slice(0, 50),
              ai_signature_added: true,
              message_id: sendResult?.messageId || null,
              send_mode: resolvedContactId ? 'crm_contact' : 'direct_phone',
            },
          };
        } catch (e: any) {
          return { success: false, error: `שגיאה בשליחת ההודעה: ${e.message}` };
        }
      }

      case 'get_chat_history': {
        const { contact_type, contact_id, limit = 20 } = toolCall.args;
        
        let query = supabaseClient
          .from('chat_messages')
          .select('id, direction, message_text, sender_name, sender_phone, created_at, provider')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (contact_type === 'lead') {
          query = query.eq('lead_id', contact_id);
        } else if (contact_type === 'client') {
          query = query.eq('client_id', contact_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Also get contact info
        let contactName = '';
        if (contact_type === 'lead') {
          const { data: lead } = await supabaseClient.from('leads').select('company_name, contact_name, phone').eq('id', contact_id).maybeSingle();
          contactName = lead?.contact_name || lead?.company_name || '';
        } else {
          const { data: client } = await supabaseClient.from('clients').select('name, contact_name, phone').eq('id', contact_id).maybeSingle();
          contactName = client?.contact_name || client?.name || '';
        }

        return {
          success: true,
          result: {
            contact_name: contactName,
            contact_type,
            message_count: data?.length || 0,
            messages: (data || []).reverse().map((m: any) => ({
              direction: m.direction === 'inbound' ? 'נכנסת' : 'יוצאת',
              text: m.message_text?.slice(0, 500),
              sender: m.sender_name || (m.direction === 'inbound' ? contactName : 'אני'),
              date: m.created_at,
            })),
          },
        };
      }

      case 'get_recent_inbound_messages': {
        const { hours = 2, limit: msgLimit = 30 } = toolCall.args;
        
        // Query all recent inbound messages across all contacts
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
        
        const { data: messages, error: msgError } = await supabaseClient
          .from('chat_messages')
          .select('id, message_text, sender_name, sender_phone, created_at, lead_id, client_id, group_id, direction')
          .eq('tenant_id', tenantId)
          .eq('connection_user_id', userId)
          .eq('direction', 'inbound')
          .eq('is_blocked', false)
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(msgLimit);

        if (msgError) throw msgError;

        if (!messages || messages.length === 0) {
          return { success: true, result: { count: 0, messages: [], summary: `לא נמצאו הודעות נכנסות ב-${hours} השעות האחרונות.` } };
        }

        // Collect unique IDs for enrichment
        const leadIds = [...new Set(messages.filter((m: any) => m.lead_id).map((m: any) => m.lead_id))];
        const clientIds = [...new Set(messages.filter((m: any) => m.client_id).map((m: any) => m.client_id))];
        const groupIds = [...new Set(messages.filter((m: any) => m.group_id).map((m: any) => m.group_id))];

        // Batch fetch names
        const nameMap: Record<string, { name: string; type: string }> = {};

        if (leadIds.length > 0) {
          const { data: leads } = await supabaseClient.from('leads').select('id, company_name, contact_name').in('id', leadIds);
          for (const l of leads || []) {
            nameMap[l.id] = { name: l.contact_name || l.company_name || 'ליד', type: 'ליד' };
          }
        }
        if (clientIds.length > 0) {
          const { data: clients } = await supabaseClient.from('clients').select('id, name, contact_name').in('id', clientIds);
          for (const c of clients || []) {
            nameMap[c.id] = { name: c.contact_name || c.name || 'לקוח', type: 'לקוח' };
          }
        }
        if (groupIds.length > 0) {
          const { data: groups } = await supabaseClient.from('whatsapp_groups').select('id, group_name').in('id', groupIds);
          for (const g of groups || []) {
            nameMap[g.id] = { name: g.group_name || 'קבוצה', type: 'קבוצה' };
          }
        }

        // Enrich messages
        const enriched = messages.map((m: any) => {
          let senderName = '';
          let contactType = 'לא משויך';
          
          if (m.lead_id && nameMap[m.lead_id]) {
            senderName = nameMap[m.lead_id].name;
            contactType = nameMap[m.lead_id].type;
          } else if (m.client_id && nameMap[m.client_id]) {
            senderName = nameMap[m.client_id].name;
            contactType = nameMap[m.client_id].type;
          } else if (m.group_id && nameMap[m.group_id]) {
            senderName = nameMap[m.group_id].name;
            contactType = nameMap[m.group_id].type;
          } else {
            senderName = m.sender_name || m.sender_phone || 'לא ידוע';
            contactType = 'לא משויך';
          }

          return {
            sender: senderName,
            type: contactType,
            message: m.message_text?.slice(0, 200),
            time: m.created_at,
          };
        });

        return {
          success: true,
          result: {
            count: enriched.length,
            hours_scanned: hours,
            messages: enriched,
            summary: `נמצאו ${enriched.length} הודעות נכנסות ב-${hours} השעות האחרונות.`,
          },
        };
      }

      // === DISPLAY DATA TOOL ===
      case 'display_data': {
        const { view_type, title, columns, data } = toolCall.args;
        // This tool doesn't execute anything - it signals the frontend to display data
        // The result will be sent as a special SSE event
        return {
          success: true,
          result: {
            __display_data__: true,
            view_type: view_type || 'table',
            title: title || 'נתונים',
            columns: columns || [],
            data: data || [],
          },
        };
      }

      // === MEMORY TOOLS ===

      case 'save_memory': {
        const { category, key, content } = toolCall.args;
        const { data, error } = await supabaseClient
          .from('ai_memory')
          .upsert(
            { user_id: userId, tenant_id: tenantId, category, key, content, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,tenant_id,category,key' }
          )
          .select('id, category, key')
          .maybeSingle();
        if (error) throw error;
        return { success: true, result: { saved: true, category, key } };
      }

      case 'recall_memory': {
        const { category } = toolCall.args;
        let query = supabaseClient
          .from('ai_memory')
          .select('category, key, content, updated_at')
          .eq('user_id', userId)
          .eq('tenant_id', tenantId)
          .order('updated_at', { ascending: false });
        if (category) query = query.eq('category', category);
        const { data, error } = await query.limit(50);
        if (error) throw error;
        return { success: true, result: { count: data.length, memories: data } };
      }

      case 'delete_memory': {
        const { category, key } = toolCall.args;
        const { error } = await supabaseClient
          .from('ai_memory')
          .delete()
          .eq('user_id', userId)
          .eq('tenant_id', tenantId)
          .eq('category', category)
          .eq('key', key);
        if (error) throw error;
        return { success: true, result: { deleted: true, category, key } };
      }

      // === GROUP 1: CRM BASIC ===

      case 'list_agencies': {
        const { limit = 20 } = toolCall.args;
        const { data, error } = await supabaseClient.from('agencies').select('id, name, status, contact_name, email, phone, is_default').eq('tenant_id', tenantId).order('name').limit(limit);
        if (error) throw error;
        return { success: true, result: { count: data.length, agencies: data } };
      }

      case 'get_agency_info': {
        const { agency_id } = toolCall.args;
        const { data, error } = await supabaseClient.from('agencies').select('*').eq('id', agency_id).eq('tenant_id', tenantId).maybeSingle();
        if (error) throw error;
        return { success: true, result: data };
      }

      case 'update_agency': {
        const { agency_id, ...updates } = toolCall.args;
        const allowed = ['name', 'contact_name', 'email', 'phone', 'status', 'notes'];
        const updateData: Record<string, any> = {};
        for (const k of allowed) if (updates[k] !== undefined) updateData[k] = updates[k];
        if (!Object.keys(updateData).length) return { success: false, error: 'לא נשלחו שדות לעדכון' };
        const { data, error } = await supabaseClient.from('agencies').update(updateData).eq('id', agency_id).eq('tenant_id', tenantId).select('id, name, status').maybeSingle();
        if (error) throw error;
        modifiedEntities.add('agencies');
        return { success: true, result: data };
      }

      case 'list_campaigners': {
        const { active, limit = 30 } = toolCall.args;
        let query = supabaseClient.from('campaigners').select('id, full_name, email, phone, role, active').eq('tenant_id', tenantId).order('full_name').limit(limit);
        if (active !== undefined) query = query.eq('active', active);
        const { data, error } = await query;
        if (error) throw error;
        return { success: true, result: { count: data.length, campaigners: data } };
      }

      case 'get_campaigner_info': {
        const { campaigner_id } = toolCall.args;
        const { data, error } = await supabaseClient.from('campaigners').select('*, campaigner_agencies(agency_id, agencies(name))').eq('id', campaigner_id).eq('tenant_id', tenantId).maybeSingle();
        if (error) throw error;
        return { success: true, result: data };
      }

      case 'list_suppliers': {
        const { limit = 20 } = toolCall.args;
        const { data, error } = await supabaseClient.from('suppliers').select('id, name, contact_name, email, phone, category, status').eq('tenant_id', tenantId).order('name').limit(limit);
        if (error) throw error;
        return { success: true, result: { count: data.length, suppliers: data } };
      }

      case 'create_supplier': {
        const { name, contact_name, email, phone, category, notes } = toolCall.args;
        const { data, error } = await supabaseClient.from('suppliers').insert({ name, contact_name, email, phone, category, notes, tenant_id: tenantId }).select('id, name').maybeSingle();
        if (error) throw error;
        modifiedEntities.add('suppliers');
        return { success: true, result: data };
      }

      case 'get_supplier_info': {
        const { supplier_id } = toolCall.args;
        const { data, error } = await supabaseClient.from('suppliers').select('*').eq('id', supplier_id).eq('tenant_id', tenantId).maybeSingle();
        if (error) throw error;
        return { success: true, result: data };
      }

      case 'list_sales_people': {
        const { limit = 20 } = toolCall.args;
        const { data, error } = await supabaseClient.from('sales_people').select('id, full_name, email, phone, active').eq('tenant_id', tenantId).order('full_name').limit(limit);
        if (error) throw error;
        return { success: true, result: { count: data.length, sales_people: data } };
      }

      case 'get_sales_person_info': {
        const { sales_person_id } = toolCall.args;
        const { data, error } = await supabaseClient.from('sales_people').select('*').eq('id', sales_person_id).eq('tenant_id', tenantId).maybeSingle();
        if (error) throw error;
        return { success: true, result: data };
      }

      case 'list_products': {
        const { limit = 30 } = toolCall.args;
        const { data, error } = await supabaseClient.from('products').select('id, name, description, price, is_active, category').eq('tenant_id', tenantId).order('name').limit(limit);
        if (error) throw error;
        return { success: true, result: { count: data.length, products: data } };
      }

      case 'create_product': {
        const { name, description, price, category } = toolCall.args;
        const { data, error } = await supabaseClient.from('products').insert({ name, description, price, category, tenant_id: tenantId, is_active: true }).select('id, name, price').maybeSingle();
        if (error) throw error;
        modifiedEntities.add('products');
        return { success: true, result: data };
      }

      case 'update_product': {
        const { product_id, ...updates } = toolCall.args;
        const allowed = ['name', 'description', 'price', 'is_active', 'category'];
        const updateData: Record<string, any> = {};
        for (const k of allowed) if (updates[k] !== undefined) updateData[k] = updates[k];
        const { data, error } = await supabaseClient.from('products').update(updateData).eq('id', product_id).eq('tenant_id', tenantId).select('id, name, price').maybeSingle();
        if (error) throw error;
        modifiedEntities.add('products');
        return { success: true, result: data };
      }

      // === GROUP 2: FINANCE ===

      case 'list_finance': {
        const { type, limit = 30, month } = toolCall.args;
        let query = supabaseClient.from('finance').select('id, type, amount, date, category, notes, clients(name), agencies(name), suppliers(name)').eq('tenant_id', tenantId).order('date', { ascending: false }).limit(limit);
        if (type) query = query.eq('type', type);
        if (month) {
          const start = `${month}-01`;
          const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0);
          const end = `${month}-${String(endDate.getDate()).padStart(2, '0')}`;
          query = query.gte('date', start).lte('date', end);
        }
        const { data, error } = await query;
        if (error) throw error;
        return { success: true, result: { count: data.length, entries: data.map((f: any) => ({ id: f.id, type: f.type, amount: f.amount, date: f.date, category: f.category, notes: f.notes, client_name: f.clients?.name, agency_name: f.agencies?.name, supplier_name: f.suppliers?.name })) } };
      }

      case 'create_finance_entry': {
        const { type, amount, date, category, notes, client_id, agency_id, supplier_id } = toolCall.args;
        // Get default agency/client if not provided
        let finalAgencyId = agency_id;
        let finalClientId = client_id;
        if (!finalAgencyId) {
          const { data: ag } = await supabaseClient.from('agencies').select('id').eq('tenant_id', tenantId).eq('is_default', true).limit(1).maybeSingle();
          finalAgencyId = ag?.id;
          if (!finalAgencyId) {
            const { data: ag2 } = await supabaseClient.from('agencies').select('id').eq('tenant_id', tenantId).limit(1).maybeSingle();
            finalAgencyId = ag2?.id;
          }
        }
        if (!finalClientId) {
          const { data: cl } = await supabaseClient.from('clients').select('id').eq('tenant_id', tenantId).limit(1).maybeSingle();
          finalClientId = cl?.id;
        }
        if (!finalAgencyId || !finalClientId) return { success: false, error: 'חסר סוכנות או לקוח' };
        const { data, error } = await supabaseClient.from('finance').insert({ type, amount, date, category, notes, client_id: finalClientId, agency_id: finalAgencyId, supplier_id, tenant_id: tenantId }).select('id, type, amount, date').maybeSingle();
        if (error) throw error;
        modifiedEntities.add('finance');
        return { success: true, result: data };
      }

      case 'get_finance_summary': {
        const { month } = toolCall.args;
        const start = `${month}-01`;
        const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0);
        const end = `${month}-${String(endDate.getDate()).padStart(2, '0')}`;
        const { data, error } = await supabaseClient.from('finance').select('type, amount').eq('tenant_id', tenantId).gte('date', start).lte('date', end);
        if (error) throw error;
        let totalIncome = 0, totalExpense = 0;
        for (const f of data || []) {
          if (f.type === 'income') totalIncome += f.amount;
          else totalExpense += f.amount;
        }
        return { success: true, result: { month, total_income: totalIncome, total_expense: totalExpense, profit: totalIncome - totalExpense, entries_count: data?.length || 0 } };
      }

      case 'list_supplier_invoices': {
        const { limit = 20 } = toolCall.args;
        const { data, error } = await supabaseClient.from('supplier_invoices').select('id, invoice_name, amount, supplier_name, supplier_id, file_url, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(limit);
        if (error) throw error;
        return { success: true, result: { count: data.length, invoices: data } };
      }

      // === GROUP 3: OPERATIONS ===

      case 'list_onboarding': {
        const { status, limit = 20 } = toolCall.args;
        let query = supabaseClient.from('client_onboarding').select('id, title, status, due_date, notes, clients(name), agencies(name), campaigners(full_name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(limit);
        if (status) query = query.eq('status', status);
        const { data, error } = await query;
        if (error) throw error;
        return { success: true, result: { count: data.length, onboarding: data.map((o: any) => ({ id: o.id, title: o.title, status: o.status, due_date: o.due_date, client_name: o.clients?.name, agency_name: o.agencies?.name, campaigner_name: o.campaigners?.full_name })) } };
      }

      case 'update_onboarding_status': {
        const { onboarding_id, status } = toolCall.args;
        const { data, error } = await supabaseClient.from('client_onboarding').update({ status }).eq('id', onboarding_id).eq('tenant_id', tenantId).select('id, title, status').maybeSingle();
        if (error) throw error;
        modifiedEntities.add('client_onboarding');
        return { success: true, result: data };
      }

      case 'list_time_entries': {
        const { date, limit = 30 } = toolCall.args;
        let query = supabaseClient.from('time_entries').select('id, user_id, clock_in, clock_out, notes, profiles(full_name)').eq('tenant_id', tenantId).order('clock_in', { ascending: false }).limit(limit);
        if (date) {
          query = query.gte('clock_in', `${date}T00:00:00`).lte('clock_in', `${date}T23:59:59`);
        }
        const { data, error } = await query;
        if (error) throw error;
        return { success: true, result: { count: data.length, entries: data.map((e: any) => ({ id: e.id, user_name: e.profiles?.full_name, clock_in: e.clock_in, clock_out: e.clock_out, notes: e.notes })) } };
      }

      case 'clock_in': {
        const { notes } = toolCall.args;
        const { data, error } = await supabaseClient.from('time_entries').insert({ user_id: userId, tenant_id: tenantId, clock_in: new Date().toISOString(), notes }).select('id, clock_in').maybeSingle();
        if (error) throw error;
        modifiedEntities.add('time_entries');
        return { success: true, result: { entry_id: data.id, clock_in: data.clock_in } };
      }

      case 'clock_out': {
        const { data: openEntry, error: findErr } = await supabaseClient.from('time_entries').select('id').eq('user_id', userId).eq('tenant_id', tenantId).is('clock_out', null).order('clock_in', { ascending: false }).limit(1).maybeSingle();
        if (findErr || !openEntry) return { success: false, error: 'לא נמצאה כניסה פתוחה' };
        const { data, error } = await supabaseClient.from('time_entries').update({ clock_out: new Date().toISOString() }).eq('id', openEntry.id).select('id, clock_in, clock_out').maybeSingle();
        if (error) throw error;
        modifiedEntities.add('time_entries');
        return { success: true, result: data };
      }

      case 'add_client_update': {
        const { client_id, content } = toolCall.args;
        const { data, error } = await supabaseClient.from('client_updates').insert({ client_id, user_id: userId, tenant_id: tenantId, content }).select('id').maybeSingle();
        if (error) throw error;
        modifiedEntities.add('client_updates');
        return { success: true, result: { update_id: data.id } };
      }

      case 'add_lead_update': {
        const { lead_id, content } = toolCall.args;
        const { data, error } = await supabaseClient.from('lead_updates').insert({ lead_id, user_id: userId, tenant_id: tenantId, content }).select('id').maybeSingle();
        if (error) throw error;
        modifiedEntities.add('lead_updates');
        return { success: true, result: { update_id: data.id } };
      }

      case 'list_updates': {
        const { entity_type, entity_id, limit = 20 } = toolCall.args;
        const table = entity_type === 'client' ? 'client_updates' : 'lead_updates';
        const fk = entity_type === 'client' ? 'client_id' : 'lead_id';
        const { data, error } = await supabaseClient.from(table).select('id, content, created_at, profiles(full_name)').eq(fk, entity_id).eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(limit);
        if (error) throw error;
        return { success: true, result: { count: data.length, updates: data.map((u: any) => ({ id: u.id, content: u.content, created_at: u.created_at, user_name: u.profiles?.full_name })) } };
      }

      // === GROUP 4: DATA & REPORTS ===

      case 'list_dynamic_tables': {
        const { data, error } = await supabaseClient.from('crm_tables').select('id, name, slug, description, icon, category, integration_type, last_sync_at').eq('tenant_id', tenantId).order('name');
        if (error) throw error;
        return { success: true, result: { count: data.length, tables: data } };
      }

      case 'get_table_data': {
        const { table_id, limit = 50 } = toolCall.args;
        const { data: fields } = await supabaseClient.from('crm_fields').select('key, name, type, position').eq('table_id', table_id).order('position');
        const { data: records, error } = await supabaseClient.from('crm_records').select('id, data, created_at').eq('table_id', table_id).eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(limit);
        if (error) throw error;
        return { success: true, result: { fields: fields || [], record_count: records?.length || 0, records: (records || []).map((r: any) => ({ id: r.id, ...r.data, created_at: r.created_at })) } };
      }

      case 'list_recordings': {
        const { limit = 20 } = toolCall.args;
        const { data, error } = await supabaseClient.from('zoom_recordings').select('id, topic, start_time, duration, recording_url, transcription_status').eq('tenant_id', tenantId).order('start_time', { ascending: false }).limit(limit);
        if (error) throw error;
        return { success: true, result: { count: data.length, recordings: data } };
      }

      case 'create_manus_task': {
        const { prompt, agentProfile, taskMode } = toolCall.args;
        if (!prompt) return { success: false, error: 'prompt is required' };
        const { data: manusResult, error: manusErr } = await supabaseClient.functions.invoke('manus-api', {
          body: { action: 'create_task', tenantId, prompt, agentProfile: agentProfile || 'manus-1.6', taskMode: taskMode || 'agent' },
        });
        if (manusErr) throw manusErr;
        if (manusResult?.error) throw new Error(manusResult.error);
        modifiedEntities.add('manus_tasks');
        return { success: true, result: manusResult };
      }

      case 'list_manus_tasks': {
        const { limit = 10, status: mStatus } = toolCall.args;
        let query = supabaseClient.from('manus_tasks').select('id, task_id, title, prompt, status, task_url, credit_usage, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(limit);
        if (mStatus) query = query.eq('status', mStatus);
        const { data, error } = await query;
        if (error) throw error;
        return { success: true, result: { count: data.length, tasks: data } };
      }

      case 'get_manus_task_result': {
        const { taskId } = toolCall.args;
        if (!taskId) return { success: false, error: 'taskId is required' };
        const { data: manusResult, error: manusErr } = await supabaseClient.functions.invoke('manus-api', {
          body: { action: 'get_task', tenantId, taskId },
        });
        if (manusErr) throw manusErr;
        if (manusResult?.error) throw new Error(manusResult.error);
        modifiedEntities.add('manus_tasks');
        return { success: true, result: manusResult };
      }

      case 'analyze_campaign_performance': {
        const scope = await resolveCarmenScope(supabaseClient, userId, tenantId);

        // Pull campaign tables across every accessible tenant (so DMM clients
        // whose ad tables live in another tenant are not silently skipped),
        // and across every ad-platform integration_type (not just facebook).
        const AD_INTEGRATION_TYPES = [
          'facebook_insights',
          'facebook_ecommerce',
          'meta_ads',
          'google_ads',
          'tiktok_ads',
        ];
        const { data: crmTables, error: tablesErr } = await supabaseClient
          .from('crm_tables')
          .select('id, client_id, slug, name, integration_type, tenant_id, agency_id')
          .in('tenant_id', scope.accessibleTenantIds)
          .in('integration_type', AD_INTEGRATION_TYPES);
        if (tablesErr) throw tablesErr;
        if (!crmTables || crmTables.length === 0) {
          return { success: true, result: { message: 'לא נמצאו טבלאות קמפיינים מסונכרנות', clients: [], scope: scope.role } };
        }

        // Restrict to tables tied to clients the caller is allowed to see.
        const candidateTables = toolCall.args.client_id
          ? crmTables.filter((t: any) => t.client_id === toolCall.args.client_id)
          : crmTables;

        const tableClientIds = Array.from(new Set(candidateTables.map((t: any) => t.client_id).filter(Boolean)));
        let allowedClientIds: Set<string> | null = null;
        if (tableClientIds.length > 0) {
          let cq = supabaseClient
            .from('clients')
            .select('id, name, agency_id, tenant_id, status')
            .in('id', tableClientIds);
          if (scope.sharedAgencyIds.length > 0) {
            cq = cq.or(`tenant_id.eq.${tenantId},agency_id.in.(${scope.sharedAgencyIds.join(',')})`);
          } else {
            cq = cq.eq('tenant_id', tenantId);
          }
          if (scope.role === 'team_manager') {
            const ids = scope.managedAgencyIds || [];
            if (ids.length === 0) return { success: true, result: { count: 0, clients: [], scope: scope.role } };
            cq = cq.in('agency_id', ids);
          }
          if (scope.restrictStatuses) cq = cq.in('status', scope.restrictStatuses);
          const { data: allowedClients } = await cq;
          let arr = allowedClients || [];

          if (scope.role === 'campaigner' && scope.campaignerId && arr.length > 0) {
            const { data: teamRows } = await supabaseClient
              .from('client_team')
              .select('client_id')
              .eq('campaigner_id', scope.campaignerId)
              .in('client_id', arr.map((c: any) => c.id));
            const ok = new Set((teamRows || []).map((t: any) => t.client_id));
            arr = arr.filter((c: any) => ok.has(c.id));
          }
          allowedClientIds = new Set(arr.map((c: any) => c.id));
        }

        const tables = allowedClientIds
          ? candidateTables.filter((t: any) => t.client_id && allowedClientIds!.has(t.client_id))
          : candidateTables;

        const now = new Date();
        const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
        const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
        const d7Str = d7.toISOString().split('T')[0];
        const d30Str = d30.toISOString().split('T')[0];

        // Normalize the various platforms onto a common (spend, leads) shape.
        const normalize = (row: any, integration_type: string) => {
          const d = row?.data || {};
          let spend = parseFloat(d.spend ?? d.cost ?? 0) || 0;
          if (integration_type === 'google_ads') {
            // Google Ads stores cost in micros.
            const micros = parseFloat(d.cost_micros ?? d.metrics_cost_micros ?? 0) || 0;
            if (micros > 0) spend = micros / 1_000_000;
          }
          const leads =
            parseFloat(
              d.leads ?? d.conversions ?? d.results ?? d.actions_lead ?? 0,
            ) || 0;
          const date = d.date || d.day || d.report_date || null;
          const updated_time = d.updated_time || d.updated_at || null;
          return { spend, leads, date, updated_time };
        };

        // Aggregate per client across all of their ad tables.
        const perClient: Record<string, {
          client_id: string;
          tables: number;
          platforms: Set<string>;
          rows7: any[]; rowsOlder: any[]; allRows: any[];
        }> = {};

        for (const table of tables) {
          if (!table.client_id) continue;
          // No tenant_id filter — we already constrained by table.id, which is
          // unique. RLS still enforces what the caller can read.
          const { data: records } = await supabaseClient
            .from('crm_records')
            .select('data')
            .eq('table_id', table.id);
          if (!records || records.length === 0) continue;

          const norm = records.map((r: any) => normalize(r, table.integration_type));
          const bucket = perClient[table.client_id] ||= {
            client_id: table.client_id,
            tables: 0,
            platforms: new Set<string>(),
            rows7: [], rowsOlder: [], allRows: [],
          };
          bucket.tables += 1;
          bucket.platforms.add(table.integration_type);
          for (const n of norm) {
            bucket.allRows.push(n);
            if (n.date && n.date >= d7Str) bucket.rows7.push(n);
            else if (n.date && n.date >= d30Str) bucket.rowsOlder.push(n);
          }
        }

        // Resolve client names in one shot.
        const clientIds = Object.keys(perClient);
        const nameById: Record<string, string> = {};
        if (clientIds.length > 0) {
          const { data: clientsRows } = await supabaseClient
            .from('clients')
            .select('id, name')
            .in('id', clientIds);
          for (const c of clientsRows || []) nameById[c.id] = c.name;
        }

        const sumField = (arr: any[], field: 'spend' | 'leads') =>
          arr.reduce((s, r) => s + (Number(r[field]) || 0), 0);

        const campResults: any[] = [];
        for (const cid of clientIds) {
          const b = perClient[cid];
          const spend7 = sumField(b.rows7, 'spend');
          const spendOlder = sumField(b.rowsOlder, 'spend');
          const leads7 = sumField(b.rows7, 'leads');
          const leadsOlder = sumField(b.rowsOlder, 'leads');

          const days7 = Math.max(b.rows7.length, 1);
          const daysOlder = Math.max(b.rowsOlder.length, 1);
          const dailySpend7 = spend7 / days7;
          const dailySpendOlder = spendOlder / daysOlder;
          const spendChangePct = dailySpendOlder > 0 ? ((dailySpend7 - dailySpendOlder) / dailySpendOlder * 100) : null;

          const cpl7 = leads7 > 0 ? spend7 / leads7 : null;
          const cplOlder = leadsOlder > 0 ? spendOlder / leadsOlder : null;
          const cplChangePct = cplOlder && cpl7 ? ((cpl7 - cplOlder) / cplOlder * 100) : null;

          const updatedTimes = b.allRows
            .map((r) => r.updated_time)
            .filter((t) => t)
            .sort()
            .reverse();
          const lastCampaignUpdate = updatedTimes.length > 0 ? updatedTimes[0] : null;
          const daysSinceLastCampaignTouch = lastCampaignUpdate
            ? Math.floor((now.getTime() - new Date(lastCampaignUpdate).getTime()) / (1000 * 60 * 60 * 24))
            : null;

          campResults.push({
            client_id: cid,
            client_name: nameById[cid] || '(לקוח ללא שם)',
            platforms: Array.from(b.platforms),
            tables: b.tables,
            spend_7d: Math.round(spend7 * 100) / 100,
            spend_30d: Math.round((spend7 + spendOlder) * 100) / 100,
            leads_7d: leads7,
            leads_30d: leads7 + leadsOlder,
            cpl_7d: cpl7 ? Math.round(cpl7 * 100) / 100 : null,
            cpl_30d_avg: cplOlder ? Math.round(cplOlder * 100) / 100 : null,
            spend_change_pct: spendChangePct ? Math.round(spendChangePct * 10) / 10 : null,
            cpl_change_pct: cplChangePct ? Math.round(cplChangePct * 10) / 10 : null,
            records_7d: b.rows7.length,
            records_30d: b.rows7.length + b.rowsOlder.length,
            last_campaign_update: lastCampaignUpdate,
            days_since_last_campaign_touch: daysSinceLastCampaignTouch,
            alert: spendChangePct !== null && spendChangePct > 15
              ? '🔴 התייקרות'
              : (cplChangePct !== null && cplChangePct > 20 ? '🟡 עלייה בעלות לליד' : '🟢 תקין'),
          });
        }

        campResults.sort((a: any, b: any) => (b.spend_change_pct || 0) - (a.spend_change_pct || 0));
        modifiedEntities.add('clients');
        return {
          success: true,
          result: {
            count: campResults.length,
            scope: scope.role,
            accessible_tenants: scope.accessibleTenantIds.length,
            tables_scanned: tables.length,
            clients: campResults,
          },
        };
      }

      case 'update_client_health': {
        let effectiveUserId = userId;
        if (!effectiveUserId) {
          const { data: ownerRole } = await supabaseClient
            .from('user_roles')
            .select('user_id')
            .eq('tenant_id', tenantId)
            .eq('role', 'owner')
            .limit(1)
            .maybeSingle();
          effectiveUserId = ownerRole?.user_id || null;
        }

        const updateData: any = { mood_status: toolCall.args.mood_status };
        const { error: clientErr } = await supabaseClient
          .from('clients')
          .update(updateData)
          .eq('id', toolCall.args.client_id)
          .eq('tenant_id', tenantId);
        if (clientErr) throw clientErr;

        const commStatus = toolCall.args.communication_status || (toolCall.args.mood_status === 'happy' ? 'normal' : toolCall.args.mood_status === 'wavering' ? 'sensitive' : 'complaint');
        const { error: logErr } = await supabaseClient
          .from('communication_logs')
          .insert({
            client_id: toolCall.args.client_id,
            tenant_id: tenantId,
            status: commStatus,
            interaction_type: 'system_alert',
            note: toolCall.args.note,
            updated_by: effectiveUserId,
          });
        if (logErr) throw logErr;

        if (effectiveUserId) {
          await supabaseClient
            .from('client_updates')
            .insert({
              client_id: toolCall.args.client_id,
              tenant_id: tenantId,
              user_id: effectiveUserId,
              content: `[עדכון אוטומטי - כרמן] ${toolCall.args.note}`,
            });
        }

        modifiedEntities.add('clients');
        modifiedEntities.add('communication_logs');
        return { success: true, result: { client_id: toolCall.args.client_id, mood_status: toolCall.args.mood_status, communication_status: commStatus } };
      }

      case 'batch_update_client_health': {
        const updates = toolCall.args.updates || [];
        if (!Array.isArray(updates) || updates.length === 0) {
          return { success: false, error: 'updates array is required and must not be empty' };
        }

        let effectiveUserId = userId;
        if (!effectiveUserId) {
          const { data: ownerRole } = await supabaseClient
            .from('user_roles')
            .select('user_id')
            .eq('tenant_id', tenantId)
            .eq('role', 'owner')
            .limit(1)
            .maybeSingle();
          effectiveUserId = ownerRole?.user_id || null;
        }

        let successCount = 0;
        let failCount = 0;
        const results: any[] = [];

        for (const update of updates) {
          try {
            const updateData: any = { mood_status: update.mood_status };
            const { error: clientErr } = await supabaseClient
              .from('clients')
              .update(updateData)
              .eq('id', update.client_id)
              .eq('tenant_id', tenantId);
            if (clientErr) throw clientErr;

            const commStatus = update.communication_status || (update.mood_status === 'happy' ? 'normal' : update.mood_status === 'wavering' ? 'sensitive' : 'complaint');
            await supabaseClient
              .from('communication_logs')
              .insert({
                client_id: update.client_id,
                tenant_id: tenantId,
                status: commStatus,
                interaction_type: 'system_alert',
                note: update.note,
                updated_by: effectiveUserId,
              });

            if (effectiveUserId) {
              await supabaseClient
                .from('client_updates')
                .insert({
                  client_id: update.client_id,
                  tenant_id: tenantId,
                  user_id: effectiveUserId,
                  content: `[עדכון אוטומטי - כרמן] ${update.note}`,
                });
            }

            successCount++;
            results.push({ client_id: update.client_id, status: 'success', mood_status: update.mood_status });
          } catch (err) {
            failCount++;
            results.push({ client_id: update.client_id, status: 'failed', error: String(err) });
          }
        }

        modifiedEntities.add('clients');
        modifiedEntities.add('communication_logs');
        return { 
          success: true, 
          result: {
            success_count: successCount, 
            fail_count: failCount,
            results,
          },
        };
      }

      case 'sync_meta_ads': {
        // Find meta_ads CRM tables
        let query = supabaseClient
          .from('crm_tables')
          .select('id, name, client_id, integration_type, integration_settings')
          .eq('tenant_id', tenantId)
          .in('integration_type', ['meta_ads', 'facebook_insights', 'facebook_ecommerce']);

        if (toolCall.args.client_id) {
          query = query.eq('client_id', toolCall.args.client_id);
        }

        const { data: metaTables, error: mtErr } = await query;
        if (mtErr) throw mtErr;

        // If client_name provided, find matching client first
        let filteredTables = metaTables || [];
        if (toolCall.args.client_name && !toolCall.args.client_id) {
          const { data: matchingClients } = await supabaseClient
            .from('clients')
            .select('id')
            .eq('tenant_id', tenantId)
            .ilike('name', `%${toolCall.args.client_name}%`);
          const clientIds = (matchingClients || []).map((c: any) => c.id);
          filteredTables = filteredTables.filter((t: any) => clientIds.includes(t.client_id));
        }

        if (filteredTables.length === 0) {
          return { success: true, result: { message: 'לא נמצאו טבלאות Meta Ads לסנכרון', synced: 0 } };
        }

        // Dispatch all sync requests in parallel and await results
        const authHeader2 = `Bearer ${userToken}`;
        const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
        const syncPromises = filteredTables.map(async (table: any) => {
          let syncFunctionName = 'sync-meta-ads-data';
          if (table.integration_type === 'facebook_insights') {
            syncFunctionName = 'sync-facebook-insights';
          } else if (table.integration_type === 'facebook_ecommerce') {
            syncFunctionName = 'sync-facebook-ecommerce';
          }
          try {
            const resp = await fetch(`${SUPABASE_URL}/functions/v1/${syncFunctionName}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': authHeader2, 'apikey': ANON_KEY },
              body: JSON.stringify({ table_id: table.id }),
            });
            const result = await resp.json();
            return { table_name: table.name, client_id: table.client_id, status: resp.ok ? 'success' : 'error', records_synced: result.records_synced || 0, error: result.error || null };
          } catch (e: any) {
            console.error(`Sync failed for table ${table.name}:`, e.message);
            return { table_name: table.name, client_id: table.client_id, status: 'error', error: e.message };
          }
        });

        const syncResults = await Promise.all(syncPromises);
        const successCount = syncResults.filter((r: any) => r.status === 'success').length;
        const failCount = syncResults.filter((r: any) => r.status === 'error').length;
        const totalRecords = syncResults.reduce((sum: number, r: any) => sum + (r.records_synced || 0), 0);

        modifiedEntities.add('crm_records');
        return { success: true, result: { message: `סנכרון הושלם: ${successCount} טבלאות הצליחו, ${failCount} נכשלו. סה"כ ${totalRecords} רשומות סונכרנו.`, total_tables: filteredTables.length, success_count: successCount, fail_count: failCount, total_records: totalRecords, details: syncResults } };
      }

      // === SKILLS TOOLS ===
      case 'save_skill': {
        const { name, description, steps, trigger_phrases } = toolCall.args;
        const { data, error } = await supabaseClient
          .from('ai_skills')
          .upsert({
            user_id: userId,
            tenant_id: tenantId,
            name,
            description,
            steps,
            trigger_phrases: trigger_phrases || [],
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,tenant_id,name' })
          .select()
          .maybeSingle();
        if (error) throw error;
        return { success: true, result: { id: data.id, name: data.name, message: `הסקיל "${name}" נשמר בהצלחה` } };
      }

      case 'list_skills': {
        const { data, error } = await supabaseClient
          .from('ai_skills')
          .select('id, name, description, trigger_phrases, updated_at')
          .eq('user_id', userId)
          .eq('tenant_id', tenantId)
          .order('updated_at', { ascending: false });
        if (error) throw error;
        return { success: true, result: { skills: data || [], count: data?.length || 0 } };
      }

      case 'execute_skill': {
        const { name: skillName } = toolCall.args;
        const { data, error } = await supabaseClient
          .from('ai_skills')
          .select('*')
          .eq('user_id', userId)
          .eq('tenant_id', tenantId)
          .ilike('name', skillName)
          .maybeSingle();
        if (error || !data) return { success: false, error: `לא נמצא סקיל בשם "${skillName}"` };
        return { success: true, result: { skill_name: data.name, description: data.description, steps: data.steps, instruction: 'בצע את הצעדים המפורטים ב-steps באמצעות הכלים שלך. כל שורה היא צעד שצריך לבצע.' } };
      }

      case 'update_skill': {
        const { skill_id, name, description, steps, trigger_phrases } = toolCall.args;
        const updateData: any = { updated_at: new Date().toISOString() };
        if (name) updateData.name = name;
        if (description) updateData.description = description;
        if (steps) updateData.steps = steps;
        if (trigger_phrases) updateData.trigger_phrases = trigger_phrases;
        const { error } = await supabaseClient
          .from('ai_skills')
          .update(updateData)
          .eq('id', skill_id)
          .eq('user_id', userId);
        if (error) throw error;
        return { success: true, result: { message: 'הסקיל עודכן בהצלחה' } };
      }

      case 'delete_skill': {
        const { skill_id } = toolCall.args;
        const { error } = await supabaseClient
          .from('ai_skills')
          .delete()
          .eq('id', skill_id)
          .eq('user_id', userId);
        if (error) throw error;
        return { success: true, result: { message: 'הסקיל נמחק בהצלחה' } };
      }

      case 'list_unconnected_clients': {
        const tableType = toolCall.args.table_type || 'facebook_insights';
        const { data: allClients, error: clientsErr } = await supabaseClient
          .from('clients')
          .select('id, name, agency_id, agencies(name)')
          .eq('tenant_id', tenantId)
          .in('status', ['active', 'onboarding'])
          .order('name');
        if (clientsErr) throw clientsErr;

        const { data: connectedTables } = await supabaseClient
          .from('crm_tables')
          .select('client_id')
          .eq('tenant_id', tenantId)
          .eq('integration_type', tableType)
          .not('client_id', 'is', null);

        const connectedClientIds = new Set((connectedTables || []).map((t: any) => t.client_id));
        const unconnected = (allClients || []).filter((c: any) => !connectedClientIds.has(c.id))
          .map((c: any) => ({ id: c.id, name: c.name, agency_name: c.agencies?.name }));

        return { success: true, result: { count: unconnected.length, unconnected_clients: unconnected } };
      }

      case 'create_facebook_report_table': {
        const { client_id, ad_account_id, ad_account_name } = toolCall.args;
        const { data: existing } = await supabaseClient
          .from('crm_tables')
          .select('id, name')
          .eq('tenant_id', tenantId)
          .eq('client_id', client_id)
          .eq('integration_type', 'facebook_insights')
          .maybeSingle();
        if (existing) {
          return { success: true, result: { already_exists: true, table_id: existing.id, name: existing.name } };
        }
        const { data: client } = await supabaseClient.from('clients').select('name, agency_id').eq('id', client_id).maybeSingle();
        if (!client) return { success: false, error: 'לקוח לא נמצא' };

        const tableName = client.name;
        const slug = `facebook-${client_id.substring(0, 8)}`;
        const { data: table, error } = await supabaseClient.from('crm_tables').insert({
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
          created_by: userId,
        }).select('id, name, slug').maybeSingle();
        if (error) throw error;
        modifiedEntities.add('crm_tables');
        return { success: true, result: { table_id: table.id, name: table.name, slug: table.slug, ad_account_id, client_name: client.name } };
      }

      case 'create_google_ads_table': {
        const { client_id, ad_account_id, ad_account_name } = toolCall.args;
        const { data: existing } = await supabaseClient
          .from('crm_tables')
          .select('id, name')
          .eq('tenant_id', tenantId)
          .eq('client_id', client_id)
          .eq('integration_type', 'google_ads')
          .maybeSingle();
        if (existing) {
          return { success: true, result: { already_exists: true, table_id: existing.id, name: existing.name } };
        }
        const { data: client } = await supabaseClient.from('clients').select('name, agency_id').eq('id', client_id).maybeSingle();
        if (!client) return { success: false, error: 'לקוח לא נמצא' };

        const tableName = client.name;
        const slug = `google-ads-${client_id.substring(0, 8)}`;
        const { data: table, error } = await supabaseClient.from('crm_tables').insert({
          tenant_id: tenantId,
          name: tableName,
          slug,
          description: `דוח ביצועי Google Ads עבור ${client.name} (${ad_account_name})`,
          icon: 'BarChart3',
          category: 'דוחות',
          integration_type: 'google_ads',
          integration_settings: { ad_account_id, ad_account_name },
          agency_id: client.agency_id || null,
          client_id,
          created_by: userId,
        }).select('id, name, slug').maybeSingle();
        if (error) throw error;
        modifiedEntities.add('crm_tables');
        return { success: true, result: { table_id: table.id, name: table.name, slug: table.slug, ad_account_id, client_name: client.name } };
      }

      case 'batch_create_report_tables': {
        const { items } = toolCall.args;
        if (!Array.isArray(items) || items.length === 0) {
          return { success: false, error: 'items array is required' };
        }
        const results: any[] = [];
        for (const item of items) {
          const { client_id, ad_account_id, ad_account_name, type } = item;
          const integType = type === 'google_ads' ? 'google_ads' : 'facebook_insights';
          try {
            const { data: existing } = await supabaseClient
              .from('crm_tables')
              .select('id, name')
              .eq('tenant_id', tenantId)
              .eq('client_id', client_id)
              .eq('integration_type', integType)
              .maybeSingle();
            if (existing) {
              results.push({ client_id, status: 'already_exists', table_id: existing.id });
              continue;
            }
            const { data: client } = await supabaseClient.from('clients').select('name, agency_id').eq('id', client_id).maybeSingle();
            if (!client) { results.push({ client_id, status: 'error', error: 'לקוח לא נמצא' }); continue; }

            const prefix = type === 'google_ads' ? 'דוח גוגל אדס' : 'דוח פייסבוק';
            const slugPrefix = type === 'google_ads' ? 'google-ads' : 'facebook';
            const { data: table, error } = await supabaseClient.from('crm_tables').insert({
              tenant_id: tenantId,
              name: client.name,
              slug: `${slugPrefix}-${client_id.substring(0, 8)}`,
              description: `${prefix} עבור ${client.name} (${ad_account_name})`,
              icon: 'BarChart3',
              category: 'דוחות',
              integration_type: integType,
              integration_settings: { ad_account_id, ad_account_name },
              agency_id: client.agency_id || null,
              client_id,
              created_by: userId,
            }).select('id, name').maybeSingle();
            if (error) { results.push({ client_id, status: 'error', error: error.message }); continue; }
            results.push({ client_id, client_name: client.name, status: 'created', table_id: table.id });
          } catch (e: any) {
            results.push({ client_id, status: 'error', error: e.message });
          }
        }
        modifiedEntities.add('crm_tables');
        const created = results.filter(r => r.status === 'created').length;
        const skipped = results.filter(r => r.status === 'already_exists').length;
        const errors = results.filter(r => r.status === 'error').length;
        return { success: true, result: { total: items.length, created, skipped, errors, details: results } };
      }

      case 'list_orphan_tables': {
        const { data: orphans, error } = await supabaseClient
          .from('crm_tables')
          .select('id, name, slug, integration_type, integration_settings, created_at')
          .eq('tenant_id', tenantId)
          .is('client_id', null)
          .in('integration_type', ['facebook_insights', 'google_ads', 'facebook_ecommerce'])
          .order('name');
        if (error) throw error;
        return { success: true, result: { count: orphans?.length || 0, tables: orphans || [] } };
      }

      case 'link_table_to_client': {
        const { table_id, client_id } = toolCall.args;
        const { data: client } = await supabaseClient.from('clients').select('name').eq('id', client_id).maybeSingle();
        if (!client) return { success: false, error: 'לקוח לא נמצא' };
        const { error } = await supabaseClient.from('crm_tables').update({ client_id }).eq('id', table_id).eq('tenant_id', tenantId);
        if (error) throw error;
        modifiedEntities.add('crm_tables');
        return { success: true, result: { table_id, client_id, client_name: client.name } };
      }

      case 'batch_link_tables_to_clients': {
        const { links } = toolCall.args;
        if (!Array.isArray(links) || links.length === 0) return { success: false, error: 'links array is required' };
        const results: any[] = [];
        for (const link of links) {
          try {
            const { data: client } = await supabaseClient.from('clients').select('name').eq('id', link.client_id).maybeSingle();
            if (!client) { results.push({ table_id: link.table_id, status: 'error', error: 'לקוח לא נמצא' }); continue; }
            const { error } = await supabaseClient.from('crm_tables').update({ client_id: link.client_id }).eq('id', link.table_id).eq('tenant_id', tenantId);
            if (error) { results.push({ table_id: link.table_id, status: 'error', error: error.message }); continue; }
            results.push({ table_id: link.table_id, client_name: client.name, status: 'linked' });
          } catch (e: any) {
            results.push({ table_id: link.table_id, status: 'error', error: e.message });
          }
        }
        modifiedEntities.add('crm_tables');
        const linked = results.filter(r => r.status === 'linked').length;
        const errs = results.filter(r => r.status === 'error').length;
        return { success: true, result: { total: links.length, linked, errors: errs, details: results } };
      }

      case 'delegate_to_background': {
        const { task_description, task_title } = toolCall.args;
        
        // Find the agent for this tenant, fallback to any active agent
        let { data: agentData } = await supabaseClient
          .from('ai_agents')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('active', true)
          .limit(1)
          .maybeSingle();
        
        if (!agentData) {
          // Fallback: use any active agent (Carmen is shared)
          const { data: fallbackAgent } = await supabaseClient
            .from('ai_agents')
            .select('id')
            .eq('active', true)
            .limit(1)
            .maybeSingle();
          agentData = fallbackAgent;
        }
        
        if (!agentData) {
          return { success: false, error: 'לא נמצא סוכן AI פעיל' };
        }
        
        // Create agent_task
        const { data: newTask, error: taskErr } = await supabaseClient
          .from('agent_tasks')
          .insert({
            agent_id: agentData.id,
            tenant_id: tenantId,
            title: task_title || 'משימת רקע',
            description: task_description,
            priority: 8,
            status: 'pending',
            schedule_type: 'once',
            task_mode: 'background',
            enabled: true,
            created_by: userId,
          })
          .select('id, title, status')
          .single();
        
        if (taskErr) throw taskErr;
        
        // Fire run-agent-task in background
        const SUPABASE_URL_ENV = Deno.env.get('SUPABASE_URL')!;
        const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        // Must use service-role key — run-agent-task's requireAuth rejects the anon key.
        fetch(`${SUPABASE_URL_ENV}/functions/v1/run-agent-task`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'apikey': SERVICE_KEY,
          },
          body: JSON.stringify({ task_id: newTask.id }),
        }).catch(e => console.error('Background task trigger failed:', e));
        
        modifiedEntities.add('agent_tasks');
        
        return {
          success: true,
          result: {
            agent_task_id: newTask.id,
            title: newTask.title,
            status: 'pending',
            message: `המשימה "${task_title}" נוצרה ומתחילה לרוץ ברקע. המשתמש יכול לעקוב אחרי ההתקדמות בזמן אמת.`,
          },
        };
      }

      default:
        return { success: false, error: `Unknown tool: ${toolCall.name}` };
    }
  } catch (error: any) {
    console.error('Tool execution error:', error);
    return { success: false, error: error.message };
  }
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'יצירת משימה לצוות (קמפיינרים/אנשי צוות). השתמש בכלי הזה רק כשרוצים ליצור משימה לאדם אחר בצוות. אם המשימה היא לכרמן עצמה — השתמש ב-create_agent_task במקום! כשמגדירים תאריך, המשימה מסונכרנת אוטומטית ליומן Google.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'כותרת המשימה' },
          client_id: { type: 'string', description: 'מזהה הלקוח (UUID, אופציונלי)' },
          campaigner_id: { type: 'string', description: 'מזהה הקמפיינר לשיוך המשימה (UUID). אם לא צוין, המשימה תשויך למשתמש הנוכחי. **חשוב**: כשמבקשים לשייך משימה לאדם ספציפי (לדוגמה "שימי משימה לדוד"), חפשי את ה-campaigner_id שלו ברשימת הקמפיינרים.' },
          priority: { type: 'integer', description: 'עדיפות 1-10', minimum: 1, maximum: 10 },
          due_date: { type: 'string', format: 'date', description: 'תאריך יעד עתידי בפורמט YYYY-MM-DD (אלא אם המשתמש ביקש מפורשות תאריך עבר)' },
          due_time: { type: 'string', description: 'שעת יעד בפורמט HH:MM (לדוגמה: 09:00, 14:30). אם לא צוין, ברירת מחדל 09:00' },
          notes: { type: 'string', description: 'הערות' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_agent_task',
      description: 'יצירת משימה לכרמן עצמה (ניהול משימות סוכנים). השתמש בכלי הזה כשהמשתמש מבקש מכרמן ליצור משימה לעצמה, משימה חוזרת, תזכורת, או סריקה תקופתית. המשימה תופיע בלוח "ניהול משימות סוכנים" ולא במשימות הצוות.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'כותרת המשימה' },
          description: { type: 'string', description: 'תיאור מפורט של המשימה' },
          priority: { type: 'integer', description: 'עדיפות 1-10 (ברירת מחדל 5)', minimum: 1, maximum: 10 },
          schedule_type: { type: 'string', enum: ['once', 'daily', 'weekly'], description: 'סוג תזמון: once=פעם אחת, daily=יומי, weekly=שבועי' },
          scheduled_at: { type: 'string', description: 'תאריך ושעה לביצוע (ISO format)' },
          cron_expression: { type: 'string', description: 'ביטוי CRON למשימות חוזרות (לדוגמה: 0 9 * * * = כל יום ב-9:00)' },
          task_skills: { type: 'array', items: { type: 'string' }, description: 'רשימת שמות סקילים להפעלה בעת ביצוע המשימה' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'עדכון משימה קיימת לפי מזהה. כולל עדכון כותרת/תאריך/שעה/עדיפות/הערות/סטטוס וסנכרון ליומן כשצריך.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'מזהה המשימה (UUID)' },
          title: { type: 'string', description: 'כותרת חדשה למשימה' },
          priority: { type: 'integer', description: 'עדיפות 1-10', minimum: 1, maximum: 10 },
          due_date: { type: 'string', format: 'date', description: 'תאריך יעד בפורמט YYYY-MM-DD' },
          due_time: { type: 'string', description: 'שעת יעד בפורמט HH:MM' },
          notes: { type: 'string', description: 'הערות למשימה' },
          status: { type: 'string', enum: ['open', 'in_progress', 'completed', 'cancelled'], description: 'סטטוס חדש (אופציונלי)' },
        },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task_status',
      description: 'עדכון סטטוס משימה קיימת',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'מזהה המשימה (UUID)' },
          status: { type: 'string', enum: ['open', 'in_progress', 'done'], description: 'סטטוס חדש. השתמשי ב-done במקום completed.' },
        },
        required: ['task_id', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: 'קבלת רשימת משימות. אם "מה יש לי?" - השתמש ב-my_tasks=true',
      parameters: {
        type: 'object',
        properties: {
          my_tasks: { type: 'boolean', description: 'רק משימות של המשתמש הנוכחי' },
          agency_id: { type: 'string', description: 'סינון לפי סוכנות (UUID)' },
          client_id: { type: 'string', description: 'סינון לפי לקוח (UUID)' },
          status: { type: 'string', enum: ['open', 'in_progress', 'completed', 'cancelled'], description: 'סינון לפי סטטוס' },
          limit: { type: 'integer', description: 'מספר מקסימלי (ברירת מחדל: 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_client_info',
      description: 'קבלת מידע מפורט על לקוח',
      parameters: {
        type: 'object',
        properties: { client_id: { type: 'string', description: 'מזהה הלקוח (UUID)' } },
        required: ['client_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_entities',
      description: 'חיפוש סוכנויות, לקוחות, קמפיינרים או לידים לפי שם. אפשר לסנן לקוחות/לידים גם לפי agency_id.',
      parameters: {
        type: 'object',
        properties: {
          entity_type: { type: 'string', enum: ['agency', 'client', 'campaigner', 'lead'], description: 'סוג הישות' },
          search_term: { type: 'string', description: 'מונח החיפוש' },
          agency_id: { type: 'string', description: 'סינון לפי סוכנות (UUID) - רלוונטי רק ל-client ו-lead' },
        },
        required: ['entity_type', 'search_term'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_lead',
      description: 'יצירת ליד חדש במערכת',
      parameters: {
        type: 'object',
        properties: {
          company_name: { type: 'string', description: 'שם החברה' },
          contact_name: { type: 'string', description: 'שם איש הקשר' },
          phone: { type: 'string', description: 'מספר טלפון' },
          email: { type: 'string', description: 'אימייל' },
          source: { type: 'string', description: 'מקור הליד' },
          notes: { type: 'string', description: 'הערות' },
        },
        required: ['contact_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_lead_status',
      description: 'עדכון סטטוס ליד',
      parameters: {
        type: 'object',
        properties: {
          lead_id: { type: 'string', description: 'מזהה הליד (UUID)' },
          status: { type: 'string', description: 'סטטוס חדש (לפי pipeline stages של הארגון)' },
        },
        required: ['lead_id', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_leads',
      description: 'הצגת רשימת לידים. אפשר לסנן לפי סוכנות עם agency_id או agency_name.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'סינון לפי סטטוס' },
          source: { type: 'string', description: 'סינון לפי מקור' },
          agency_id: { type: 'string', description: 'סינון לפי סוכנות (UUID)' },
          agency_name: { type: 'string', description: 'סינון לפי שם סוכנות (חיפוש חלקי)' },
          limit: { type: 'integer', description: 'מספר מקסימלי (ברירת מחדל: 100)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_clients',
      description: 'הצגת רשימת לקוחות. אפשר לסנן לפי סוכנות עם agency_id או agency_name.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'סינון לפי סטטוס' },
          agency_id: { type: 'string', description: 'סינון לפי סוכנות (UUID)' },
          agency_name: { type: 'string', description: 'סינון לפי שם סוכנות (חיפוש חלקי)' },
          limit: { type: 'integer', description: 'מספר מקסימלי (ברירת מחדל: 100)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_client',
      description: 'יצירת לקוח חדש',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'שם הלקוח/חברה' },
          contact_name: { type: 'string', description: 'שם איש הקשר' },
          phone: { type: 'string', description: 'טלפון' },
          email: { type: 'string', description: 'אימייל' },
          industry: { type: 'string', description: 'תעשייה' },
          notes: { type: 'string', description: 'הערות' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_automation',
      description: 'יצירת אוטומציה חדשה במערכת. trigger_type: lead_status_changed, task_status_changed, manual_command, meeting_created, inbound_webhook_task. action_type: send_whatsapp, create_task, add_lead_update, add_client_update, create_manychat_subscriber, add_manychat_tag.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'שם האוטומציה' },
          description: { type: 'string', description: 'תיאור' },
          trigger_type: { type: 'string', description: 'סוג הטריגר' },
          action_type: { type: 'string', description: 'סוג הפעולה' },
          configuration: { type: 'object', description: 'הגדרות הפעולה (template, tag_id, etc.)' },
        },
        required: ['name', 'trigger_type', 'action_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_message',
      description: 'שליחת הודעת WhatsApp ללקוח/ליד לפי contact_id, או ישירות לפי phone/phoneNumber. ההודעה תכלול חתימה אוטומטית.',
      parameters: {
        type: 'object',
        properties: {
          contact_type: { type: 'string', enum: ['lead', 'client'], description: 'סוג איש הקשר (אופציונלי אם שולחים לפי טלפון ישיר)' },
          contact_id: { type: 'string', description: 'מזהה איש הקשר (UUID) - אופציונלי אם שולחים לפי טלפון ישיר' },
          phone: { type: 'string', description: 'מספר טלפון ישיר לשליחה (ללא צורך ב-contact_id)' },
          phoneNumber: { type: 'string', description: 'כמו phone - נתמך לתאימות' },
          message_text: { type: 'string', description: 'תוכן ההודעה (ללא הצגה עצמית - היא תתווסף אוטומטית)' },
        },
        required: ['message_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_chat_history',
      description: 'שליפת היסטוריית שיחות WhatsApp עם לקוח או ליד. שימושי כדי להבין הקשר לפני שליחת הודעה.',
      parameters: {
        type: 'object',
        properties: {
          contact_type: { type: 'string', enum: ['lead', 'client'], description: 'סוג איש הקשר' },
          contact_id: { type: 'string', description: 'מזהה איש הקשר (UUID)' },
          limit: { type: 'integer', description: 'מספר הודעות מקסימלי (ברירת מחדל: 20)' },
        },
        required: ['contact_type', 'contact_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_inbound_messages',
      description: 'סריקת כל ההודעות הנכנסות האחרונות מכל השיחות (לקוחות, לידים, קבוצות, לא משויכים). השתמש כששואלים "מי חיפש אותי?", "מה ההודעה האחרונה?", "מישהו כתב לי?" וכו\'.',
      parameters: {
        type: 'object',
        properties: {
          hours: { type: 'number', description: 'חלון זמן בשעות לסריקה (ברירת מחדל: 2)' },
          limit: { type: 'integer', description: 'מספר הודעות מקסימלי (ברירת מחדל: 30)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_emails',
      description: 'שליפת רשימת אימיילים מ-Gmail. אפשר לסנן לפי query או תאריך.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'חיפוש חופשי (כמו בחיפוש Gmail)' },
          maxResults: { type: 'integer', description: 'מספר מקסימלי (ברירת מחדל: 10)' },
          date: { type: 'string', format: 'date', description: 'תאריך ספציפי (YYYY-MM-DD)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_email',
      description: 'קריאת תוכן אימייל ספציפי לפי מזהה',
      parameters: {
        type: 'object',
        properties: {
          message_id: { type: 'string', description: 'מזהה ההודעה' },
        },
        required: ['message_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'שליחת אימייל חדש דרך Gmail',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'כתובת אימייל של הנמען' },
          subject: { type: 'string', description: 'נושא ההודעה' },
          body: { type: 'string', description: 'תוכן ההודעה (HTML או טקסט)' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_email',
      description: 'מחיקת אימייל (העברה לאשפה)',
      parameters: {
        type: 'object',
        properties: {
          message_id: { type: 'string', description: 'מזהה ההודעה למחיקה' },
        },
        required: ['message_id'],
      },
    },
  },
  // === DISPLAY DATA TOOL ===
  {
    type: 'function',
    function: {
      name: 'display_data',
      description: 'הצגת נתונים בממשק הויזואלי של המשתמש. השתמש אחרי שליפת נתונים כדי להציג אותם בצורה ויזואלית. view_type: "table" לטבלה, "stats" לסטטיסטיקות/מספרים, "cards" לכרטיסי מידע, "list" לרשימה.',
      parameters: {
        type: 'object',
        properties: {
          view_type: { type: 'string', enum: ['table', 'cards', 'stats', 'list'], description: 'סוג התצוגה' },
          title: { type: 'string', description: 'כותרת הפאנל (לדוגמה: "לידים חדשים", "משימות פתוחות")' },
          columns: {
            type: 'array',
            items: { type: 'string' },
            description: 'שמות העמודות בעברית (רק עבור table/list). לדוגמה: ["שם", "טלפון", "סטטוס"]',
          },
          data: {
            type: 'array',
            items: { type: 'object' },
            description: 'מערך אובייקטים עם הנתונים. המפתחות חייבים להתאים ל-columns. עבור stats: כל אובייקט עם label ו-value.',
          },
        },
        required: ['view_type', 'title', 'data'],
      },
    },
  },
  // === MEMORY TOOLS ===
  {
    type: 'function',
    function: {
      name: 'save_memory',
      description: 'שמירת פריט זיכרון לשימוש בשיחות עתידיות. השתמש כדי לזכור העדפות, פרויקטים, תהליכים ומידע חשוב שהמשתמש מספר.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'קטגוריה: preferences, projects, clients, workflows, personal', enum: ['preferences', 'projects', 'clients', 'workflows', 'personal'] },
          key: { type: 'string', description: 'מזהה ייחודי לפריט (לדוגמה: "default_priority", "project_x_details")' },
          content: { type: 'string', description: 'תוכן הזיכרון' },
        },
        required: ['category', 'key', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recall_memory',
      description: 'שליפת זיכרונות שנשמרו. אפשר לסנן לפי קטגוריה.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'סינון לפי קטגוריה (אופציונלי)', enum: ['preferences', 'projects', 'clients', 'workflows', 'personal'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_memory',
      description: 'מחיקת פריט זיכרון ספציפי',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'קטגוריה' },
          key: { type: 'string', description: 'מזהה הפריט למחיקה' },
        },
        required: ['category', 'key'],
      },
    },
  },
  // === GROUP 1: CRM BASIC TOOLS ===
  { type: 'function', function: { name: 'list_agencies', description: 'הצגת רשימת סוכנויות', parameters: { type: 'object', properties: { limit: { type: 'integer', description: 'מקסימום (ברירת מחדל: 20)' } } } } },
  { type: 'function', function: { name: 'get_agency_info', description: 'מידע מפורט על סוכנות', parameters: { type: 'object', properties: { agency_id: { type: 'string', description: 'UUID' } }, required: ['agency_id'] } } },
  { type: 'function', function: { name: 'update_agency', description: 'עדכון סוכנות', parameters: { type: 'object', properties: { agency_id: { type: 'string' }, name: { type: 'string' }, contact_name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, status: { type: 'string' }, notes: { type: 'string' } }, required: ['agency_id'] } } },
  { type: 'function', function: { name: 'list_campaigners', description: 'הצגת רשימת קמפיינרים', parameters: { type: 'object', properties: { active: { type: 'boolean' }, limit: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'get_campaigner_info', description: 'מידע מפורט על קמפיינר', parameters: { type: 'object', properties: { campaigner_id: { type: 'string' } }, required: ['campaigner_id'] } } },
  { type: 'function', function: { name: 'list_suppliers', description: 'הצגת רשימת ספקים', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'create_supplier', description: 'יצירת ספק חדש', parameters: { type: 'object', properties: { name: { type: 'string' }, contact_name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, category: { type: 'string' }, notes: { type: 'string' } }, required: ['name'] } } },
  { type: 'function', function: { name: 'get_supplier_info', description: 'מידע על ספק', parameters: { type: 'object', properties: { supplier_id: { type: 'string' } }, required: ['supplier_id'] } } },
  { type: 'function', function: { name: 'list_sales_people', description: 'הצגת רשימת אנשי מכירות', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'get_sales_person_info', description: 'מידע על איש מכירות', parameters: { type: 'object', properties: { sales_person_id: { type: 'string' } }, required: ['sales_person_id'] } } },
  { type: 'function', function: { name: 'list_products', description: 'הצגת רשימת מוצרים', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'create_product', description: 'יצירת מוצר חדש', parameters: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, price: { type: 'number' }, category: { type: 'string' } }, required: ['name'] } } },
  { type: 'function', function: { name: 'update_product', description: 'עדכון מוצר', parameters: { type: 'object', properties: { product_id: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, price: { type: 'number' }, is_active: { type: 'boolean' }, category: { type: 'string' } }, required: ['product_id'] } } },
  // === GROUP 2: FINANCE TOOLS ===
  { type: 'function', function: { name: 'list_finance', description: 'הצגת תנועות כספיות (הכנסות/הוצאות)', parameters: { type: 'object', properties: { type: { type: 'string', enum: ['income', 'expense'] }, month: { type: 'string', description: 'YYYY-MM' }, limit: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'create_finance_entry', description: 'יצירת רשומה כספית', parameters: { type: 'object', properties: { type: { type: 'string', enum: ['income', 'expense'] }, amount: { type: 'number' }, date: { type: 'string', format: 'date' }, category: { type: 'string' }, notes: { type: 'string' }, client_id: { type: 'string' }, agency_id: { type: 'string' }, supplier_id: { type: 'string' } }, required: ['type', 'amount', 'date'] } } },
  { type: 'function', function: { name: 'get_finance_summary', description: 'סיכום כספי לחודש (הכנסות, הוצאות, רווח)', parameters: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM' } }, required: ['month'] } } },
  { type: 'function', function: { name: 'list_supplier_invoices', description: 'הצגת חשבוניות ספקים', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } } },
  // === GROUP 3: OPERATIONS TOOLS ===
  { type: 'function', function: { name: 'list_onboarding', description: 'הצגת תהליכי קליטת לקוחות', parameters: { type: 'object', properties: { status: { type: 'string', description: 'סטטוס: research_meeting, kickoff_meeting, setup, campaign_live' }, limit: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'update_onboarding_status', description: 'עדכון סטטוס קליטה', parameters: { type: 'object', properties: { onboarding_id: { type: 'string' }, status: { type: 'string' } }, required: ['onboarding_id', 'status'] } } },
  { type: 'function', function: { name: 'list_time_entries', description: 'הצגת רשומות נוכחות', parameters: { type: 'object', properties: { date: { type: 'string', format: 'date' }, limit: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'clock_in', description: 'רישום כניסה (שעון נוכחות)', parameters: { type: 'object', properties: { notes: { type: 'string' } } } } },
  { type: 'function', function: { name: 'clock_out', description: 'רישום יציאה (שעון נוכחות)', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'add_client_update', description: 'הוספת עדכון ללקוח', parameters: { type: 'object', properties: { client_id: { type: 'string' }, content: { type: 'string' } }, required: ['client_id', 'content'] } } },
  { type: 'function', function: { name: 'add_lead_update', description: 'הוספת עדכון לליד', parameters: { type: 'object', properties: { lead_id: { type: 'string' }, content: { type: 'string' } }, required: ['lead_id', 'content'] } } },
  { type: 'function', function: { name: 'list_updates', description: 'הצגת עדכונים של לקוח/ליד', parameters: { type: 'object', properties: { entity_type: { type: 'string', enum: ['client', 'lead'] }, entity_id: { type: 'string' }, limit: { type: 'integer' } }, required: ['entity_type', 'entity_id'] } } },
  // === GROUP 4: DATA & REPORTS TOOLS ===
  { type: 'function', function: { name: 'list_dynamic_tables', description: 'הצגת רשימת טבלאות דינמיות (CRM)', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_table_data', description: 'שליפת נתונים מטבלה דינמית', parameters: { type: 'object', properties: { table_id: { type: 'string' }, limit: { type: 'integer' } }, required: ['table_id'] } } },
  { type: 'function', function: { name: 'list_recordings', description: 'הצגת הקלטות Zoom', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'create_manus_task', description: 'יצירת משימה חדשה ב-Manus AI - סוכן שיכול לבצע מחקר, ליצור מצגות, לנתח נתונים ועוד', parameters: { type: 'object', properties: { prompt: { type: 'string', description: 'תיאור המשימה ל-Manus' }, agentProfile: { type: 'string', enum: ['manus-1.6', 'manus-1.6-lite', 'manus-1.6-max'], description: 'מודל (ברירת מחדל: manus-1.6)' }, taskMode: { type: 'string', enum: ['agent', 'chat', 'adaptive'], description: 'מצב עבודה (ברירת מחדל: agent)' } }, required: ['prompt'] } } },
  { type: 'function', function: { name: 'list_manus_tasks', description: 'הצגת רשימת משימות Manus AI', parameters: { type: 'object', properties: { limit: { type: 'integer' }, status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed'] } } } } },
  { type: 'function', function: { name: 'get_manus_task_result', description: 'שליפת תוצאות של משימת Manus לפי מזהה', parameters: { type: 'object', properties: { taskId: { type: 'string', description: 'מזהה המשימה ב-Manus' } }, required: ['taskId'] } } },
  // === GROUP 5: CAMPAIGN ANALYSIS & HEALTH TOOLS ===
  { type: 'function', function: { name: 'analyze_campaign_performance', description: 'ניתוח ביצועי קמפיינים מטבלאות CRM: משווה 7 ימים אחרונים מול 30 ימים עבור כל לקוח. מחזיר אחוזי שינוי בהוצאות, עלות לליד, ו-ROAS, וגם תאריך עדכון אחרון בקמפיין (last_campaign_update) ומספר ימים מאז (days_since_last_campaign_touch). השתמש בכלי הזה כדי לזהות התייקרויות, ירידות ביצועים, וקמפיינים שלא נגעו בהם.', parameters: { type: 'object', properties: { client_id: { type: 'string', description: 'מזהה לקוח ספציפי (אופציונלי — ללא = כל הלקוחות)' } } } } },
  { type: 'function', function: { name: 'update_client_health', description: 'עדכון מצב בריאות לקוח בודד: מעדכן mood_status בטבלת clients ויוצר רשומה ב-communication_logs. לעדכון מרובה של לקוחות — השתמשי ב-batch_update_client_health במקום!', parameters: { type: 'object', properties: { client_id: { type: 'string' }, mood_status: { type: 'string', enum: ['happy', 'wavering', 'churn_risk'], description: 'מצב הלקוח: happy=תקין (הכל בסדר), wavering=רגיש (צריך תשומת לב), churn_risk=תלונה (סיכון נטישה)' }, communication_status: { type: 'string', enum: ['normal', 'sensitive', 'complaint'], description: 'סטטוס תקשורת: normal=תקין, sensitive=רגיש, complaint=תלונה' }, note: { type: 'string', description: 'הערה/סיכום — מה הבעיה שזוהתה' } }, required: ['client_id', 'mood_status', 'note'] } } },
  { type: 'function', function: { name: 'batch_update_client_health', description: 'עדכון מצב בריאות של מספר לקוחות בבת אחת. **השתמשי בכלי הזה תמיד כשצריך לעדכן יותר מלקוח אחד** (למשל בדיקת דופק, עדכון דשבורד). מקבל מערך של עדכונים ומבצע את כולם בקריאה אחת.', parameters: { type: 'object', properties: { updates: { type: 'array', items: { type: 'object', properties: { client_id: { type: 'string' }, mood_status: { type: 'string', enum: ['happy', 'wavering', 'churn_risk'] }, communication_status: { type: 'string', enum: ['normal', 'sensitive', 'complaint'] }, note: { type: 'string' } }, required: ['client_id', 'mood_status', 'note'] }, description: 'מערך של עדכוני לקוחות' } }, required: ['updates'] } } },
  { type: 'function', function: { name: 'sync_meta_ads', description: 'סנכרון נתוני Meta Ads (פייסבוק) מטבלאות CRM. מפעיל סנכרון מול Meta Ads API עבור לקוח ספציפי או כל הלקוחות שיש להם טבלת meta_ads. השתמש בכלי הזה כשהמשתמש מבקש לסנכרן/לרענן נתוני פייסבוק.', parameters: { type: 'object', properties: { client_id: { type: 'string', description: 'מזהה לקוח ספציפי (אופציונלי — ללא = כל הטבלאות)' }, client_name: { type: 'string', description: 'שם לקוח לחיפוש (אופציונלי)' } } } } },
  // === GROUP 6: SKILLS TOOLS ===
  { type: 'function', function: { name: 'save_skill', description: 'שמירת סקיל (מיומנות) חדש — תהליך עבודה שלם שכרמן למדה. כשהמשתמש אומר "תשמרי סקיל" / "שמרי את זה כ-skill", סכם את התהליך שבוצע ושמור אותו.', parameters: { type: 'object', properties: { name: { type: 'string', description: 'שם קצר לסקיל (למשל "דוחות", "עדכון דגלים")' }, description: { type: 'string', description: 'תיאור קצר מה הסקיל עושה' }, steps: { type: 'string', description: 'הוראות מפורטות צעד-אחר-צעד שכרמן תבצע כשמפעילים את הסקיל. כל שורה = צעד אחד.' }, trigger_phrases: { type: 'array', items: { type: 'string' }, description: 'מילות מפתח שיפעילו את הסקיל (למשל ["דוחות", "ביצועים"])' } }, required: ['name', 'description', 'steps'] } } },
  { type: 'function', function: { name: 'list_skills', description: 'הצגת רשימת כל הסקילים (מיומנויות) השמורים של המשתמש', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'execute_skill', description: 'טעינת סקיל לפי שם והפעלת הצעדים שלו. כשמשתמש מזכיר שם סקיל או אומר "תפעילי סקיל X", טען את הסקיל ובצע את הצעדים.', parameters: { type: 'object', properties: { name: { type: 'string', description: 'שם הסקיל להפעלה' } }, required: ['name'] } } },
  { type: 'function', function: { name: 'update_skill', description: 'עדכון סקיל קיים', parameters: { type: 'object', properties: { skill_id: { type: 'string', description: 'מזהה הסקיל (UUID)' }, name: { type: 'string' }, description: { type: 'string' }, steps: { type: 'string' }, trigger_phrases: { type: 'array', items: { type: 'string' } } }, required: ['skill_id'] } } },
  { type: 'function', function: { name: 'delete_skill', description: 'מחיקת סקיל', parameters: { type: 'object', properties: { skill_id: { type: 'string', description: 'מזהה הסקיל (UUID)' } }, required: ['skill_id'] } } },
  // === GROUP 7: REPORT TABLE TOOLS ===
  { type: 'function', function: { name: 'list_unconnected_clients', description: 'רשימת לקוחות פעילים שאין להם עדיין טבלת דוח מסוג מסוים (facebook_insights או google_ads) ב-CRM. שימושי לזיהוי לקוחות שצריכים חיבור.', parameters: { type: 'object', properties: { table_type: { type: 'string', enum: ['facebook_insights', 'google_ads'], description: 'סוג הטבלה לבדיקה (ברירת מחדל: facebook_insights)' } } } } },
  { type: 'function', function: { name: 'create_facebook_report_table', description: 'חיבור חשבון מודעות פייסבוק ללקוח — יוצר טבלת דוח facebook_insights ב-CRM', parameters: { type: 'object', properties: { client_id: { type: 'string', description: 'מזהה הלקוח' }, ad_account_id: { type: 'string', description: 'מזהה חשבון מודעות פייסבוק (act_XXXXX)' }, ad_account_name: { type: 'string', description: 'שם חשבון המודעות' } }, required: ['client_id', 'ad_account_id', 'ad_account_name'] } } },
  { type: 'function', function: { name: 'create_google_ads_table', description: 'חיבור חשבון Google Ads ללקוח — יוצר טבלת דוח google_ads ב-CRM', parameters: { type: 'object', properties: { client_id: { type: 'string', description: 'מזהה הלקוח' }, ad_account_id: { type: 'string', description: 'מזהה חשבון Google Ads' }, ad_account_name: { type: 'string', description: 'שם חשבון המודעות' } }, required: ['client_id', 'ad_account_id', 'ad_account_name'] } } },
  { type: 'function', function: { name: 'batch_create_report_tables', description: 'יצירת מספר טבלאות דוח בבת אחת (Google Ads / Meta). **השתמש בכלי הזה תמיד כשצריך לחבר מספר לקוחות** — חוסך עשרות סבבים.', parameters: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { client_id: { type: 'string' }, ad_account_id: { type: 'string' }, ad_account_name: { type: 'string' }, type: { type: 'string', enum: ['meta', 'google_ads'] } }, required: ['client_id', 'ad_account_id', 'ad_account_name', 'type'] }, description: 'מערך של חיבורים ליצירה' } }, required: ['items'] } } },
  // === ORPHAN TABLE TOOLS ===
  { type: 'function', function: { name: 'list_orphan_tables', description: 'רשימת טבלאות דוח (facebook_insights / google_ads) ללא חיבור ללקוח (client_id=null). שימושי לזיהוי טבלאות "יתומות" שצריכות שיוך.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'link_table_to_client', description: 'שיוך טבלת CRM קיימת ללקוח — עדכון client_id בטבלה', parameters: { type: 'object', properties: { table_id: { type: 'string', description: 'מזהה הטבלה' }, client_id: { type: 'string', description: 'מזהה הלקוח לשיוך' } }, required: ['table_id', 'client_id'] } } },
  { type: 'function', function: { name: 'batch_link_tables_to_clients', description: 'שיוך מרובה של טבלאות CRM ללקוחות בבת אחת — עדכון client_id בכל טבלה', parameters: { type: 'object', properties: { links: { type: 'array', items: { type: 'object', properties: { table_id: { type: 'string' }, client_id: { type: 'string' } }, required: ['table_id', 'client_id'] }, description: 'מערך של { table_id, client_id }' } }, required: ['links'] } } },
  // === BACKGROUND TASK DELEGATION ===
  { type: 'function', function: { name: 'delegate_to_background', description: 'העבר משימה ארוכה לריצה ברקע. **חובה להשתמש בכלי הזה** כאשר המשימה דורשת עיבוד של יותר מ-5 לקוחות (בדיקת דופק, עדכון דשבורד, batch updates, סנכרון מרובה). המשימה תרוץ ברקע גם אם המשתמש סוגר את הצ׳אט, ותעדכן התקדמות בזמן אמת.', parameters: { type: 'object', properties: { task_description: { type: 'string', description: 'תיאור מפורט של המשימה לביצוע ברקע — כולל הוראות מדויקות, כמו "בצע בדיקת דופק לכל 75 הלקוחות הפעילים" או "עדכן mood_status לכל הלקוחות לפי ביצועי קמפיינים"' }, task_title: { type: 'string', description: 'כותרת קצרה למשימה (למשל: "בדיקת דופק", "עדכון דשבורד")' } }, required: ['task_description', 'task_title'] } } },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const reqBody = await req.json();
    const { message, conversation_id, tenant_slug } = reqBody;

    // Resolve tenant
    let tenantId: string | null = null;
    if (tenant_slug) {
      const { data: tenantBySlug } = await supabaseClient.from('tenants').select('id').eq('slug', tenant_slug).maybeSingle();
      if (tenantBySlug) tenantId = tenantBySlug.id;
    }
    if (!tenantId) {
      const { data: activeTenant } = await supabaseClient.from('user_active_tenant').select('tenant_id').eq('user_id', user.id).maybeSingle();
      tenantId = activeTenant?.tenant_id || null;
    }
    if (!tenantId) {
      const { data: tenantData } = await supabaseClient.from('tenant_users').select('tenant_id').eq('user_id', user.id).limit(1).maybeSingle();
      tenantId = tenantData?.tenant_id || null;
    }
    if (!tenantId) throw new Error('אין לך גישה למערכת');

    // Load Carmen agent configuration (engine, talent, personality, system_prompt)
    // — single source of truth shared with AgentEditor.
    const { data: carmenAgent } = await supabaseClient
      .from('ai_agents')
      .select('id, engine, talent, personality, system_prompt, active')
      .eq('tenant_id', tenantId)
      .or('name.ilike.%carmen%,name.ilike.%כרמן%')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    // Resolve agent.engine (alias like "gpt-5.4-pro" → full gateway id "openai/gpt-5.4-pro").
    // Sending the bare alias makes the gateway return 400 ("invalid model: gpt-5.4-pro").
    const { resolveModelId } = await import("../_shared/models.ts");
    const rawEngine = (carmenAgent?.active !== false && carmenAgent?.engine) ? carmenAgent.engine : null;
    const activeModel = rawEngine ? resolveModelId(rawEngine) : AI_MODEL_DEFAULT;



    // Get user profile
    const { data: profileData } = await supabaseClient.from('profiles').select('full_name, email, campaigner_id, ui_mode').eq('id', user.id).maybeSingle();
    let campaignerName: string | null = null;
    let campaignerId: string | null = null;

    if (profileData?.campaigner_id) {
      const { data: campaignerData } = await supabaseClient.from('campaigners').select('full_name, id').eq('id', profileData.campaigner_id).maybeSingle();
      if (campaignerData) { campaignerName = campaignerData.full_name; campaignerId = campaignerData.id; }
    }

    const userName = profileData?.full_name || user.email?.split('@')[0] || 'משתמש';
    const userEmail = profileData?.email || user.email || '';

    const now = new Date();
    const currentDateContext = `Israel: ${new Intl.DateTimeFormat('he-IL', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'Asia/Jerusalem',
    }).format(now)} | UTC: ${now.toISOString()}`;

    // Load persistent memory for system prompt
    let memoryContext = '';
    try {
      const { data: memories } = await supabaseClient
        .from('ai_memory')
        .select('category, key, content')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .order('category')
        .order('updated_at', { ascending: false })
        .limit(100);

      if (memories && memories.length > 0) {
        const grouped: Record<string, string[]> = {};
        for (const m of memories) {
          if (!grouped[m.category]) grouped[m.category] = [];
          grouped[m.category].push(`• **${m.key}**: ${m.content}`);
        }
        memoryContext = Object.entries(grouped)
          .map(([cat, items]) => `**[${cat}]**\n${items.join('\n')}`)
          .join('\n\n');
      }
    } catch (memErr) {
      console.error('Failed to load memory:', memErr);
    }

    // Load skills for system prompt
    let skillsContext = '';
    try {
      const { data: skills } = await supabaseClient
        .from('ai_skills')
        .select('name, description, trigger_phrases')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false });

      if (skills && skills.length > 0) {
        skillsContext = skills.map(s => {
          const triggers = s.trigger_phrases?.length ? ` (טריגרים: ${s.trigger_phrases.join(', ')})` : '';
          return `• **${s.name}**: ${s.description}${triggers}`;
        }).join('\n');
      }
    } catch (skillErr) {
      console.error('Failed to load skills:', skillErr);
    }

    // Clear modified entities tracker for this request
    modifiedEntities.clear();

    // Load conversation
    let conversation = null;
    let messages: any[] = [];
    if (conversation_id) {
      const { data: convData } = await supabaseClient.from('ai_conversations').select('*').eq('id', conversation_id).eq('user_id', user.id).maybeSingle();
      if (convData) { conversation = convData; messages = convData.messages || []; }
    }

    messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });

    const aiMessages = messages.filter(m => m.role !== 'tool_call').map(m => ({ role: m.role, content: m.content }));

    // Call Lovable AI Gateway
    const forceToolsForWhatsApp =
      /(וואטסאפ|ווטסאפ|whatsapp|green api|גרין api|gery)/i.test(message || '') &&
      /(שלח|שליחה|תשלח|תנסה לשלוח|לא קיבלתי|לא הגיע)/i.test(message || '');

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [
          { role: 'system', content: buildSystemPrompt(userName, userEmail, currentDateContext, memoryContext, skillsContext, campaignerName || undefined, campaignerId || undefined, profileData?.ui_mode || 'classic', carmenAgent) },

          ...aiMessages,
        ],
        tools,
        ...(forceToolsForWhatsApp ? { tool_choice: 'required' } : {}),
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: 'חריגה ממגבלת הקצב' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ error: 'נדרש תשלום' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const errText = await response.text();
      console.error('AI Gateway error:', response.status, errText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    // Stream response
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantMessage = '';
        const toolCallAccumulators: Record<number, { name: string; arguments: string }> = {};
        let finishReason: string | null = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim() || line.startsWith(':')) continue;
              if (!line.startsWith('data: ')) continue;

              const data = line.slice(6);
              if (data === '[DONE]') { finishReason = finishReason || 'stop'; continue; }

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                const choiceFinishReason = parsed.choices?.[0]?.finish_reason;
                if (choiceFinishReason) finishReason = choiceFinishReason;

                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!toolCallAccumulators[idx]) toolCallAccumulators[idx] = { name: '', arguments: '' };
                    if (tc.function?.name) toolCallAccumulators[idx].name = tc.function.name;
                    if (tc.function?.arguments) toolCallAccumulators[idx].arguments += tc.function.arguments;
                  }
                } else if (delta?.content) {
                  assistantMessage += delta.content;
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'token', content: delta.content })}\n\n`));
                }
              } catch (e) { /* ignore parse errors */ }
            }
          }
          
          // Execute accumulated tool calls with recursive support (up to 3 rounds)
          const MAX_TOOL_ROUNDS = 50;
          let toolRound = 0;
          let currentToolCalls = { ...toolCallAccumulators };
          let currentFinishReason = finishReason;

          // Build running conversation for follow-ups
          let followUpMessages: any[] = [
            { role: 'system', content: buildSystemPrompt(userName, userEmail, currentDateContext, memoryContext, skillsContext, campaignerName || undefined, campaignerId || undefined, profileData?.ui_mode || 'classic', carmenAgent) },
            ...aiMessages,
          ];

          while ((currentFinishReason === 'tool_calls' || Object.keys(currentToolCalls).length > 0) && toolRound < MAX_TOOL_ROUNDS) {
            toolRound++;

            // Build tool_calls array for the assistant message
            const toolCallsForMessage: any[] = [];
            const toolResultsForMessage: any[] = [];

            for (const [idx, accumulated] of Object.entries(currentToolCalls)) {
              if (!accumulated.name) continue;
              let toolArgs = {};
              try { toolArgs = JSON.parse(accumulated.arguments || '{}'); } catch { continue; }
              
              const toolName = accumulated.name;
              const callId = `call_${toolRound}_${idx}`;

              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'tool_call', tool: toolName, args: toolArgs })}\n\n`));

              const toolResult = await executeTool({ name: toolName, args: toolArgs }, supabaseClient, user.id, tenantId, token);

              // If this is a display_data result, emit it as a special SSE event
              if (toolResult.success && toolResult.result?.__display_data__) {
                const { __display_data__, ...displayPayload } = toolResult.result;
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'display_data', data: displayPayload })}\n\n`));
              }

              messages.push({ role: 'tool_call', tool: toolName, args: toolArgs, result: toolResult, timestamp: new Date().toISOString() });

              toolCallsForMessage.push({ id: callId, type: 'function', function: { name: toolName, arguments: JSON.stringify(toolArgs) } });
              toolResultsForMessage.push({ role: 'tool', tool_call_id: callId, content: JSON.stringify(toolResult.success ? toolResult.result : { error: toolResult.error }) });
            }

            if (toolCallsForMessage.length === 0) break;

            // Add assistant tool_calls + tool results to conversation
            followUpMessages.push({ role: 'assistant', content: null, tool_calls: toolCallsForMessage });
            followUpMessages.push(...toolResultsForMessage);

            // Call AI again with full context
            const followUpResponse = await fetch(AI_GATEWAY_URL, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: activeModel,
                messages: followUpMessages,
                tools,
                stream: true,
              }),
            });

            // Reset for next round
            const nextToolCalls: Record<number, { name: string; arguments: string }> = {};
            let nextFinishReason: string | null = null;

            if (followUpResponse.ok) {
              const followReader = followUpResponse.body!.getReader();
              let followBuffer = '';
              while (true) {
                const { done: followDone, value: followValue } = await followReader.read();
                if (followDone) break;
                followBuffer += decoder.decode(followValue, { stream: true });
                const followLines = followBuffer.split('\n');
                followBuffer = followLines.pop() || '';
                for (const followLine of followLines) {
                  if (!followLine.trim() || followLine.startsWith(':') || !followLine.startsWith('data: ')) continue;
                  const followData = followLine.slice(6);
                  if (followData === '[DONE]') { nextFinishReason = nextFinishReason || 'stop'; continue; }
                  try {
                    const followParsed = JSON.parse(followData);
                    const followDelta = followParsed.choices?.[0]?.delta;
                    const followFinish = followParsed.choices?.[0]?.finish_reason;
                    if (followFinish) nextFinishReason = followFinish;

                    if (followDelta?.tool_calls) {
                      for (const tc of followDelta.tool_calls) {
                        const tcIdx = tc.index ?? 0;
                        if (!nextToolCalls[tcIdx]) nextToolCalls[tcIdx] = { name: '', arguments: '' };
                        if (tc.function?.name) nextToolCalls[tcIdx].name = tc.function.name;
                        if (tc.function?.arguments) nextToolCalls[tcIdx].arguments += tc.function.arguments;
                      }
                    } else if (followDelta?.content) {
                      assistantMessage += followDelta.content;
                      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'token', content: followDelta.content })}\n\n`));
                    }
                  } catch { /* ignore */ }
                }
              }
            } else {
              console.error('Follow-up AI call failed:', followUpResponse.status);
              break;
            }

            currentToolCalls = nextToolCalls;
            currentFinishReason = nextFinishReason;
          }

          // Send invalidation events for modified entities
          if (modifiedEntities.size > 0) {
            for (const entity of modifiedEntities) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'invalidate', entity })}\n\n`));
            }
          }

          // Save
          if (assistantMessage) {
            messages.push({ role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() });
          }

          const isNewConversation = !conversation_id || !conversation;
          const conversationTitle = conversation?.title || message.slice(0, 50);
          let savedConversationId = conversation_id;

          if (conversation_id && conversation) {
            await supabaseClient.from('ai_conversations').update({ messages, updated_at: new Date().toISOString() }).eq('id', conversation_id);
          } else {
            const { data: newConv } = await supabaseClient.from('ai_conversations').insert({ user_id: user.id, tenant_id: tenantId, title: conversationTitle, messages }).select().maybeSingle();
            if (newConv) {
              savedConversationId = newConv.id;
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'conversation_id', id: newConv.id })}\n\n`));
            }
          }

          // Auto-generate title for new conversations using AI
          if (isNewConversation && savedConversationId && assistantMessage) {
            try {
              const titleResponse = await fetch(AI_GATEWAY_URL, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: 'google/gemini-2.5-flash-lite',
                  messages: [
                    { role: 'system', content: 'תן כותרת קצרה בעברית (עד 5 מילים) לשיחה הבאה. תחזיר רק את הכותרת, בלי גרשיים או סימני פיסוק מיותרים.' },
                    { role: 'user', content: `הודעת המשתמש: ${message}\nתשובת העוזר: ${assistantMessage.slice(0, 300)}` },
                  ],
                  stream: false,
                }),
              });
              if (titleResponse.ok) {
                const titleData = await titleResponse.json();
                const generatedTitle = titleData.choices?.[0]?.message?.content?.trim();
                if (generatedTitle && generatedTitle.length > 0 && generatedTitle.length < 100) {
                  await supabaseClient.from('ai_conversations').update({ title: generatedTitle }).eq('id', savedConversationId);
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'title_update', title: generatedTitle })}\n\n`));
                }
              }
            } catch (titleErr) {
              console.error('Auto-title generation failed:', titleErr);
            }
          }

          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (error: any) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
  } catch (error: any) {
    console.error('Error in ai-support-chat:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

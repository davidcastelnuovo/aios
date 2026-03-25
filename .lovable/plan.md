

## הבעיה

כלי ה-AIOS `get_chat_history` דורש `contact_id` ספציפי, ולכן כששואלים "מי חיפש אותי?" או "מה ההודעה האחרונה שנכנסה?" — הסוכן לא יודע לענות כי אין לו כלי שמאפשר סריקה כללית של כל ההודעות הנכנסות.

## הפתרון

הוספת כלי חדש `get_recent_inbound_messages` לפונקציית `ai-support-chat` שיסרוק את **כל** ההודעות הנכנסות (מלקוחות, לידים, קבוצות, ואנשי קשר לא משויכים) ויחזיר אותן ממוינות לפי זמן.

## שינויים

### 1. Edge Function — `supabase/functions/ai-support-chat/index.ts`

**הוספת כלי חדש `get_recent_inbound_messages`:**

- **Tool definition** (בסוף מערך ה-tools):
  - `hours` (אופציונלי, ברירת מחדל: 2) — חלון זמן לסריקה
  - `limit` (אופציונלי, ברירת מחדל: 30) — מספר הודעות מקסימלי

- **Tool executor** (ב-switch של executeTool):
  - שליפה מטבלת `chat_messages` עם:
    - `tenant_id = tenantId`
    - `connection_user_id = userId` (רק הודעות ששייכות למשתמש הנוכחי)
    - `direction = 'inbound'`
    - `is_blocked = false`
    - `created_at >= now() - X hours`
  - מיון לפי `created_at DESC`
  - עבור כל הודעה — שליפת שם ליד/לקוח/קבוצה בהתאמה:
    - `lead_id` → שם מ-`leads`
    - `client_id` → שם מ-`clients`
    - `group_id` → שם מ-`whatsapp_groups`
    - אף אחד מהם → "לא משויך" + `sender_name` / `sender_phone`
  - החזרת מערך הודעות עם: שם שולח, סוג (ליד/לקוח/קבוצה/לא משויך), טקסט ההודעה, שעה

- **עדכון System Prompt**:
  - הוספת הוראה: "כששואלים 'מי חיפש אותי' או 'מה ההודעה האחרונה' — השתמש ב-`get_recent_inbound_messages` כדי לסרוק את כל השיחות"
  - הוראה ליצור `display_data` בפורמט טבלה עם ההודעות + סיכום טקסטואלי קצר

### 2. AIOSContext — ללא שינויים
הכלי החדש פועל בצד השרת בלבד, ללא צורך בשינוי frontend.

## פרטים טכניים

```sql
-- השאילתה שהכלי יריץ (דרך Supabase SDK):
SELECT cm.id, cm.direction, cm.message_text, cm.sender_name, cm.sender_phone, 
       cm.created_at, cm.lead_id, cm.client_id, cm.group_id
FROM chat_messages cm
WHERE cm.tenant_id = $tenantId
  AND cm.connection_user_id = $userId
  AND cm.direction = 'inbound'
  AND cm.is_blocked = false
  AND cm.created_at >= now() - interval '$hours hours'
ORDER BY cm.created_at DESC
LIMIT $limit
```

לאחר השליפה — enrichment עם שמות מ-leads, clients, whatsapp_groups בשאילתות נפרדות (batch by IDs).

## סיכום
שינוי אחד בקובץ אחד (`ai-support-chat/index.ts`) — הוספת כלי + הגדרת כלי + עדכון prompt. זה יאפשר ל-AIOS לענות על "מי חיפש אותי", "מה ההודעה האחרונה", "תראה לי הודעות אחרונות" בלי צורך לציין שם ספציפי.


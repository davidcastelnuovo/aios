# תיקון בעיית הצ'אט אחרי בחירת חיבור ספציפי

## הבעיה
1. בלוג הדפדפן רואים שגיאה חוזרת:
   `invalid UNION/INTERSECT/EXCEPT ORDER BY clause — Only result column names can be used`.
   ה-RPC `get_chat_contacts` נכשל בכל קריאה אחרי המיגרציה האחרונה. לכן הרשימה לא מתרעננת לפי החיבור הנבחר ומציגה צ'אטים מקאש ישן/שונים מקרמן.
2. גם כשנתקן את השגיאה — סינון לפי "חיבור ספציפי" מסתמך רק על `connection_user_id` של בעל החיבור. אם לאותו משתמש קיימים מספר חיבורים מאותו סוג (למשל יותר מחיבור Manus אחד) — הרשימה תכלול את כולם, ולא רק את החיבור שנבחר.

## מה לתקן

### 1. מיגרציה: שכתוב `get_chat_contacts`
- לעטוף את שלושת ה-`SELECT` (clients / leads / groups) ב-CTE או ב-`SELECT * FROM (... UNION ALL ...) sub` ולעשות `ORDER BY sub.last_message_at DESC NULLS LAST` בחוץ — כך שלא נסמך על שם עמודה משתנה אחרי UNION.
- להוסיף פרמטר אופציונלי חדש `p_provider chat_provider DEFAULT NULL` ולסנן בכל אחד מ-EXISTS/COUNT/MAX לפי `cm.provider = p_provider` כשהוא לא NULL. ככה כשבוחרים חיבור ספציפי נוכל להגביל גם לפי הספק של אותו חיבור.
- שמירה על שמות עמודות, סדר, וכל שאר ההתנהגות (החסימות, agency join, אווטאר וכו') בדיוק כמו היום.

### 2. עדכון `src/pages/Chat.tsx`
- כש-`chatFilter.kind === "connection"`: למצוא את האובייקט של החיבור הנבחר ב-`chatConnections`, ולהעביר ל-RPC גם את `p_provider` שמתאים ל-`provider` של אותו חיבור (ממופה ל-enum `chat_provider`: `green_api`/`manus_wa`/`telegram`/`manychat`).
- בשאר המקרים (all / platform) — לא להעביר `p_provider`, להשאיר את ההתנהגות הקיימת.
- להוסיף את ה-provider ל-`queryKey` כדי שהקאש יתרענן בצורה נכונה בין חיבורים.

### 3. בלי שינויים אחרים
- אין לגעת ב-`useChatConnections`, ב-`ChatConnectionSelector`, ב-RLS, או בלוגיקת השליחה. רק תיקון ה-RPC + העברת הפרמטר.

## פירוט טכני (ל-AI שמיישם)

מיגרציה חדשה — `CREATE OR REPLACE FUNCTION public.get_chat_contacts(p_tenant_id uuid DEFAULT NULL, p_connection_user_ids uuid[] DEFAULT NULL, p_provider chat_provider DEFAULT NULL)` עם אותה החתימה של `RETURNS TABLE`. מבנה:

```sql
RETURN QUERY
SELECT * FROM (
  -- clients SELECT ... (כל ה-EXISTS / COUNT / MAX מוסיפים: AND (p_provider IS NULL OR cm.provider = p_provider))
  UNION ALL
  -- leads SELECT ... (אותו דבר)
  UNION ALL
  -- groups SELECT ... (אותו דבר)
) sub
ORDER BY sub.last_message_at DESC NULLS LAST;
```

ב-`Chat.tsx` ליד `connectionUserIds`:
```ts
const selectedConnection = chatFilter.kind === "connection"
  ? chatConnections.find(c => c.id === chatFilter.integrationId)
  : null;
const providerFilter = selectedConnection?.provider ?? null;
```
ולהעביר ב-RPC `p_provider: providerFilter ?? undefined`, ולהוסיף את `providerFilter` ל-`queryKey`.

## אימות אחרי היישום
- לבחור "All chats" → לראות שהרשימה נטענת בלי שגיאה ב-console.
- לבחור חיבור ספציפי (קרמן) → לראות רק אנשי קשר שיש להם הודעות דרך אותו חיבור בלבד.
- לעבור בין חיבורים → הרשימה מתחלפת מיד ולא נשארת מהחיבור הקודם.

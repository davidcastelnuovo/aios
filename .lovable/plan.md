## הבעיה
כששואלים את כרמן "אילו לקוחות משוייכים לדקל", היא לא יודעת לבדוק את שיוך הלקוחות עצמם (טבלת `client_team` שמקשרת `campaigner_id` ל-`client_id`), אז היא נסוגה למשימות ולפעמים מחזירה תשובה לא מדויקת.

## הפתרון
להוסיף ל-Carmen יכולת לסנן לקוחות לפי קמפיינר משוייך, דרך הכלי `list_clients` (ב-`supabase/functions/run-ai-agent/index.ts`).

### שינויים

1. **הרחבת `list_clients`** — להוסיף שני פרמטרים אופציונליים:
   - `campaigner_id` — סינון לפי מזהה קמפיינר
   - `campaigner_name` — סינון לפי שם (מילת חיפוש, ילך דרך `campaigners.full_name ilike`)
   
   כשאחד מהם מועבר, השאילתה תבצע join מול `client_team` ותחזיר רק לקוחות עם שורה תואמת. תיאור הכלי יעודכן כדי שכרמן תדע להשתמש בו לשאלות מסוג "מי הלקוחות של X".

2. **תיאור כלי** — לעדכן את ה-description של `list_clients` ל: "רשימת לקוחות. אפשר לסנן לפי סטטוס, או לפי קמפיינר משוייך (campaigner_id / campaigner_name) — השתמש בזה לשאלות כמו 'אילו לקוחות משוייכים ל-X'."

3. **חיזוק ה-system prompt** (אזור הוראות הכלים, סביב שורה 1415) — להוסיף משפט: "לשאלות 'אילו לקוחות משוייכים ל-X' השתמש ב-`list_clients` עם `campaigner_name`, ולא ב-`list_tasks`."

### Technical details
- שאילתה: `clients` join `client_team` on `client_team.client_id = clients.id`, פילטר `tenant_id`, ואז `client_team.campaigner_id = ?` או join נוסף ל-`campaigners` עם `full_name ilike %X%`.
- אם `campaigner_name` לא מזהה אף קמפיינר → מחזירים `{count:0, clients:[], note:'no campaigner matched'}` כדי שכרמן תוכל לדווח נכון.
- אין שינויי DB, אין שינויי UI, אין שינויים נוספים בקבצים אחרים.

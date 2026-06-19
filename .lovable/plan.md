## הבעיות שאיתרתי

### 1. כרמן לא מצליחה לשמור הוראות בזיכרון
ב-`save_memory` (קובץ `supabase/functions/ai-support-chat/index.ts`, שורה 2694) הקטגוריה מוגבלת ב-enum נוקשה:
```ts
enum: ['preferences','projects','clients','workflows','personal']
```
אבל ה-Memory של הפרויקט מחייב את כרמן לשמור הוראות תחת `category=instructions` (טריגרים בעברית: "תזכרי/זכרי/שמרי/מעכשיו/תמיד"). הערך `instructions` **לא קיים ב-enum**, ולכן ה-AI Gateway דוחה את ה-tool call כ-`invalid enum value` — וכרמן עונה "ניסיתי לשמור אבל לא הצלחתי". זה גם הסיבה ש-`recall_memory` לא רואה אותן בשיחות הבאות.

### 2. כרמן לא עוברת דוח-דוח על קמפיינים
היום `analyze_campaign_performance` מצברת לכל לקוח שורת סיכום אחת (`spend7/spend30/leads7/leads30`) ומחזירה הכל בקריאה אחת. כשיש הרבה לקוחות עם כמה פלטפורמות (Meta + Google + TikTok), המודל מקבל גוש אחד צפוף ובוחר לסכם — במקום לדווח שורה לכל "דוח" (טבלה/פלטפורמה לכל לקוח). אין לה גם דרך לבקש לקוח בודד עם פירוט לפי פלטפורמה.

---

## התיקונים

### A. הרחבת `save_memory` (שורות 2691-2699 + 1252-1293)
- להחליף את ה-enum הסגור ב:
  ```ts
  category: { type: 'string', description: 'קטגוריה חופשית: preferences, projects, clients, workflows, personal, instructions, ...' }
  ```
  (להסיר `enum`, להשאיר רק תיאור — מאפשר `instructions` וכל קטגוריה עתידית).
- אותו תיקון ב-`recall_memory` ו-`delete_memory` (שורות 2710, 2723).
- לעדכן את ה-system prompt (שורה ~115) שיציין במפורש: "טריגרים 'תזכרי/זכרי/שמרי/מעכשיו/תמיד' → קרא ל-`save_memory` עם `category='instructions'`".
- ב-`buildSystemPrompt` כבר נטען `memoryContext` מ-`ai_memory` ללא סינון קטגוריה, אז הוראות חדשות יעלו אוטומטית בכל שיחה.

### B. מעבר דוח-דוח ב-`analyze_campaign_performance` (שורות 1592-1730)
- להוסיף ארגומנט אופציונלי `breakdown_by_platform: boolean` (ברירת מחדל `false` כדי לא לשבור את הדגלים הקיימים).
- כשהוא `true` — להחזיר במקום `clients[]` עם בקט מצטבר, מערך `reports[]` שבו **כל פלטפורמה לכל לקוח היא רשומה נפרדת**:
  ```
  { client_id, client_name, platform: 'meta_ads', spend7, spend30, leads7, leads30, last_data_date, freshness_days }
  ```
- להוסיף ארגומנט `client_ids: string[]` (אופציונלי) כדי שכרמן תוכל לבקש קבוצת לקוחות ספציפית ולא להעמיס על תשובה אחת.
- בעדכון תיאור הכלי ב-tool schema (~שורה 2890 בסביבה) לציין: "השתמש ב-`breakdown_by_platform=true` כדי לקבל שורה לכל דוח (לקוח × פלטפורמה) בנפרד".

### C. חיזוק ה-system prompt לבדיקת דוחות (שורות ~128-140)
- להוסיף הוראה: "כשהמשתמש מבקש 'לעבור על כל הדוחות' או 'לקוח-לקוח' → קרא ל-`analyze_campaign_performance` עם `breakdown_by_platform=true`, ודווח **שורה לכל זוג לקוח+פלטפורמה**, פורמט: `<שם לקוח> · <פלטפורמה>: ספנד 7י׳ ₪X | לידים 7י׳ Y | טריות: Z ימים`. אם > 5 לקוחות → `delegate_to_background`."
- גם להוסיף מפורשות שאם `freshness_days > 2` להבליט את זה כ"דוח לא מסונכרן".

---

## טכני קצר

קבצים שישונו:
- `supabase/functions/ai-support-chat/index.ts` — בלבד.
  - הסרת ה-enum מ-3 כלי הזיכרון.
  - הוספת `breakdown_by_platform` ו-`client_ids` ל-`analyze_campaign_performance` + שינוי הפלט כשהדגל פעיל.
  - חיזוק 2 קטעים ב-system prompt (זיכרון + מעבר דוח-דוח).

ללא שינוי DB, ללא שינוי RLS, ללא שינוי בכלים אחרים.

מאשר?

# תוכנית: תמיכה בקליטת לידים ישירה מ-Maskyoo (ללא הגדרת JSON)

## הבנת הבעיה

מסקיו שולחת נתונים דרך "פתיחת קישור" (URL Callback) - לא כ-JSON בגוף הבקשה, אלא כ-**פרמטרים ב-URL (query string) או form-data**.

כשמסמנים "הוסף פרמטרים מברירת מחדל לקישור" במסקיו, הם שולחים את פרמטרי השיחה הבאים:
- **caller** - מספר הטלפון של המתקשר
- **maskyoo** - מספר המסקיו שאליו התקשרו
- **description** - תיאור המספר במסקיו
- **call_status** - סטטוס השיחה (נענתה/לא נענתה)
- **call_duration** - משך השיחה
- **private_field1-5** - שדות פרטיים מוגדרים

המערכת הנוכחית מצפה ל-JSON עם מבנה מסוים שהמשתמש לא יכול להגדיר במסקיו.

## הפתרון

נבנה **Endpoint ייעודי למסקיו** שיקבל קריאות GET/POST עם פרמטרים ויתרגם אותם ליצירת ליד.

## שלבי הביצוע

### שלב 1: יצירת Edge Function ייעודית - `webhook-maskyoo-intake`

Edge Function חדשה שתקבל בקשות מ-Maskyoo:

**קבלת פרמטרים:**
- תומכת ב-GET (query string) וגם ב-POST (form-data או JSON)
- מחלצת את הפרמטרים של Maskyoo:
  - `caller` / `phone` / `caller_phone` -> מספר טלפון
  - `description` / `maskyoo` -> מקור/שם
  - `private_field1` -> שם איש קשר (אופציונלי)
  - `call_status` -> לבדוק אם להתעלם משיחות שנענו

**לוגיקה:**
1. מזהה את ה-tenant לפי פרמטר `tenant_id` בקריאה
2. מחפש ליד קיים לפי מספר טלפון (מניעת כפילויות)
3. אם לא קיים - יוצר ליד חדש
4. מפעיל אוטומציות מסוג `inbound_webhook_lead` אם קיימות

### שלב 2: עדכון ממשק האוטומציה

שינוי ב-`AddAutomationForm.tsx` ו-`EditAutomationDialog.tsx`:

**URL חדש למסקיו:**
במקום להציג את ה-URL הכללי של `trigger-automation`, נציג את ה-URL הייעודי:
```
https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/webhook-maskyoo-intake?tenant_id=XXX
```

**הסבר פשוט למשתמש:**
- "העתק את ה-URL הזה והדבק אותו בהגדרות האוטומציה של מסקיו"
- "בחר בשיטת שליחה POST"
- "סמן 'הוסף פרמטרים מברירת מחדל לקישור'"

### שלב 3: מיפוי הפרמטרים

| פרמטר ממסקיו | שדה בליד |
|-------------|---------|
| `caller` / `phone` | phone |
| `description` | source + company_name |
| `maskyoo` | notes (מספר המסקיו שהתקשרו אליו) |
| `private_field1` | contact_name (אם הוגדר) |
| `call_status` | סינון - רק שיחות שלא נענו |

---

## פרטים טכניים

### מבנה ה-Edge Function

```typescript
// webhook-maskyoo-intake/index.ts

// קבלת פרמטרים מ-GET או POST
// GET: /?tenant_id=xxx&caller=0501234567&description=פרסום
// POST: form-data או query string

// 1. חילוץ tenant_id (חובה)
// 2. חילוץ phone מ-caller או phone
// 3. חילוץ source מ-description
// 4. בדיקת כפילויות לפי טלפון
// 5. יצירת ליד עם pipeline stage ראשון
// 6. הפעלת אוטומציות קיימות (אופציונלי)
```

### הוספת סינון לשיחות

אפשרות בממשק האוטומציה לבחור:
- "כל השיחות" - יוצר ליד לכל שיחה
- "רק שיחות שלא נענו" - יוצר ליד רק אם `call_status` = missed/unanswered

### עדכון הממשק

בבחירת trigger "קליטת ליד מ-Webhook (מסקיו)":
1. הצגת URL ייעודי עם ה-tenant_id מוטמע
2. הוראות פשוטות בעברית להגדרה במסקיו
3. הסרת ה-JSON דוגמה (לא רלוונטי למסקיו)

---

## קבצים שישתנו

| קובץ | שינוי |
|------|------|
| `supabase/functions/webhook-maskyoo-intake/index.ts` | **חדש** - Edge Function ייעודית |
| `src/components/forms/AddAutomationForm.tsx` | עדכון UI להצגת URL ייעודי והוראות |
| `src/components/forms/EditAutomationDialog.tsx` | אותו עדכון UI |

---

## יתרונות הפתרון

1. **פשטות למשתמש** - רק להעתיק URL ולהדביק במסקיו
2. **ללא JSON** - תומך בפורמט שמסקיו שולחת
3. **תאימות קדימה** - אם בעתיד מסקיו ישנו פורמט, קל לעדכן
4. **מניעת כפילויות** - בדיקה לפי מספר טלפון
5. **גמישות** - תומך גם ב-GET וגם ב-POST

## תקציר ממצאים

### 1. למה אין שיחות בדוחות SEO חדשים?
שיחות מסקיו **כן נכנסות** למערכת (אחרונה לפני דקות, ב-08/05). הבדיקה ב-DB מראה ש**אף דוח SEO/Ads לא מוגדר עם `maskyoo_number`** ב-integration_settings — לכן `MaskyooSiblingCard` מחזיר `null`. כלומר הבעיה היא חוסר קישור בין הדוח ל-DID של מסקיו, לא חוסר נתונים.

### 2. עריכה ידנית של שיחות
ניצור ממשק שמאפשר ל-override את הספירה האוטומטית עבור 30 יום אחרונים (או טווח אחר), כך שגם אם משהו לא נמשך נכון מ-Maskyoo — נציג את הערך הידני בדוח.

### 3. תצוגה משותפת (Public Share)
היום `PublicSeoView` לא מציג את כרטיסיית מסקיו ולא את שורת חיפוש מילות המפתח של GSC. נשלים אותם.

---

## תוכנית מפורטת

### חלק א׳ — תיקון "אין שיחות בדוחות חדשים"
1. **כפתור הצמדה מהיר** בכרטיסיית `MaskyooSiblingCard` (כשאין מספר מוגדר): "🔗 קשר מספר מסקיו לדוח". פותח Popover עם שני שדות:
   - מספר אורגני (לדוחות GSC/GA/Ahrefs)
   - מספר ממומן (לדוחות Google Ads)
   ושומר ל-`crm_tables.integration_settings.maskyoo_number` עבור הדוח האחים המתאים.
2. **רמז ויזואלי** — אם לא מוגדר עדיין מספר, נציג את הכרטיס במצב ריק עם הקריאה לפעולה במקום `return null` שקט (כך תדע שהמודול קיים אבל חסר חיבור).

### חלק ב׳ — Override ידני לשיחות מסקיו
1. **טבלה חדשה** `maskyoo_manual_overrides`:
   - `tenant_id`, `client_id` (אופציונלי), `crm_table_id` (אופציונלי), `maskyoo_last9` (9 ספרות אחרונות של ה-DID), `period_days` (ברירת מחדל 30), `incoming_count`, `unique_count`, `answered_count`, `note`, `created_by`, `updated_at`.
   - RLS לפי tenant + cross-tenant agency_ids כמו שאר הדוחות.
2. **לוגיקה ב-`MaskyooCallsCard`**:
   - אם קיים override שתואם ל-(tenant + last9 + days) — מציגים את הערכים הידניים עם תג "ידני".
   - אחרת — הספירה מה-DB כרגיל.
3. **ממשק עריכה** — כפתור עיפרון קטן בכל שורה של מספר. לוחצים → דיאלוג עם 3 שדות מספריים + הערה. אופציה "החזר לאוטומטי" (מוחק את ה-override).
4. **תצוגה משותפת קוראת מאותו override** (ראה חלק ג׳).

### חלק ג׳ — Public Share Parity
ב-`PublicSeoView` נוסיף:
1. **`MaskyooCallsCard` (גרסה ציבורית)** — fetch ב-Edge Function ציבורי קיים (או נוסיף סעיף לכרטיסיית share שמחזיר ספירה + override).
2. **שורת חיפוש מילות מפתח של GSC** — אותה חוויה כמו בדוח הפרטי (חיפוש פנימי בטבלה ש-share כבר טוען).
3. נוודא שגם בכרטיס וגם בשורת החיפוש אין דליפת data של טננטים אחרים — נצמיד ל-`crm_table_id` של ה-share token בלבד.

---

## פרטים טכניים

**קבצים שייגעו:**
- `supabase/migrations/<new>.sql` — טבלת `maskyoo_manual_overrides` + RLS.
- `src/components/dynamic-tables/MaskyooCallsCard.tsx` — קריאה ל-overrides + תג "ידני" + כפתור עריכה.
- `src/components/dynamic-tables/MaskyooSiblingCard.tsx` — מצב empty עם CTA לקישור מספר.
- חדש: `src/components/dynamic-tables/MaskyooManualEditDialog.tsx` — דיאלוג עריכה.
- חדש: `src/components/dynamic-tables/LinkMaskyooNumberPopover.tsx` — קישור מספר לדוח.
- `src/components/dynamic-tables/PublicSeoView.tsx` — הוספת כרטיס מסקיו + שורת חיפוש GSC.
- אם נדרש: `supabase/functions/get-shared-seo-report/index.ts` (או הקיימת) — להחזיר גם spice של maskyoo (count + override).

**מה לא נוגעים:**
- `maskyoo-webhook` נשאר כמו שהוא — הוא עובד.
- `call_logs` — לא משנים schema, רק קוראים.

**איך הספירה הידנית מתממשת:**
- אם override קיים: `display = override`. כפתור "ראה את הספירה האוטומטית" יציג את האמיתי לצד.
- אם רוצים לאפס: מוחקים את ה-override; חוזר לאוטומטי.

---

## שאלה אחת לפני יישום
ה-override צריך להיות **גלובלי לטננט** (מספר אחד = ספירה אחת לכולם), או **פר-דוח** (אותו מספר יכול להופיע בכמה דוחות עם ספירה שונה)? ברירת המחדל המוצעת: **פר-מספר (last9) בטננט** — פשוט יותר ועקבי בין דוח פרטי לדוח שיתוף. אם תרצה פר-דוח אחליף ל-`crm_table_id` כמפתח.
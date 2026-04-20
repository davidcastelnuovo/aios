

# תיקון רוחבי: קישור שיתוף וצילום מסך לא משקפים את הדשבורד

## הבעיה

מצאתי בדיוק את אותה תקלה כמו שהייתה ב-24 קאראט — לא רק ב-YTS, אלא ב-**29 לקוחות** (סה"כ **54 טבלאות אינטגרציה**) במערכת.

**שורש הבעיה:**
- ב-YTS למשל: הלקוח (`clients.tenant_id`) משויך ל-tenant של DMM, אבל טבלאות ה-Ahrefs / GA / Facebook Insights שלו (`crm_tables.tenant_id`) משויכות ל-tenant של MarketingCaptain.
- ה-edge function `public-dashboard` מסנן טבלאות ורשומות לפי `dashboard.tenant_id` בלבד:
  ```ts
  .eq("client_id", dashboard.client_id)
  .eq("tenant_id", dashboard.tenant_id)   // ← זה מסנן הכל החוצה
  ```
- ולכן בקישור השיתוף + בצילום המסך (שמרנדר את אותו `SharedDashboard`) — הטבלאות "נעלמות" ומציגים דשבורד כמעט ריק.

## הפתרון — שתי שכבות (קוד + נתונים)

### 1. תיקון `public-dashboard` שיהיה עמיד גם בעתיד
בקובץ `supabase/functions/public-dashboard/index.ts`:
- **טבלאות**: לבטל את `.eq("tenant_id", dashboard.tenant_id)` ב-query של `crm_tables`. הסינון לפי `client_id` מספיק (לקוח שייך לחברת הסוכנות; כל הטבלאות שמקושרות אליו רלוונטיות, ללא קשר ל-tenant הטכני שלהן).
- **רשומות**: באותה צורה — לבטל את `.eq("tenant_id", dashboard.tenant_id)` ב-query של `crm_records`. הסינון לפי `table_id` בלבד מספיק ובטוח (זהו service-role בתוך share token תקף).
- **Ahrefs reports**: כבר מסנן לפי `client_id` — להשאיר, אבל גם כאן להוריד את ה-`.eq("tenant_id", dashboard.tenant_id)` כדי לתפוס דוחות שנקלטו מ-tenant אחר אך שויכו ללקוח.

ההגנה האמיתית כאן היא **share token + is_active = true** (כבר קיימת), לא שדה ה-tenant — ולכן הסרת הפילטר לא פוגעת באבטחה.

### 2. תיקון `public-table` (אותה לוגיקה)
בקובץ `supabase/functions/public-table/index.ts`:
- ה-query של GA / GSC records כבר משתמש ב-`tenant_id` של הטבלה הראשית (עקיף), אז זה תקין.
- ב-Ahrefs reports יש `.eq("tenant_id", table.tenant_id)` — להשאיר (כאן זה תואם, כי אנחנו ב-context של טבלה ספציפית).
- לוודא שאין סינון tenant מיותר על records הראשיים (כבר אין).

### 3. ניקוי נתונים — איחוד ה-tenant של הטבלאות עם הלקוח
מיגרציית SQL חד-פעמית שתסדר את כל 54 הטבלאות:
```sql
UPDATE crm_tables t
SET tenant_id = c.tenant_id
FROM clients c
WHERE c.id = t.client_id
  AND c.tenant_id != t.tenant_id;
```
בדקתי שאין mismatch ברשומות עצמן (`crm_records.tenant_id` מול `crm_tables.tenant_id`), אז לא צריך לעדכן רשומות.

זה מבטיח שגם:
- הדשבורד הפנימי (כשמשתמש מתחלף בין tenants)
- שיתופים עתידיים
- כל מקום אחר שמסנן לפי tenant_id

יציגו את הנתונים נכון.

### 4. אימות — בדיקת השוואה בין דשבורד פנימי לקישור משותף
- פתיחת הדשבורד הפנימי של YTS (תצוגה רגילה במערכת).
- פתיחת הקישור המשותף של YTS (`yts-3mr6`).
- יצירת צילום מסך דרך כפתור הסקרינשוט.
- ודא ששלושתם מציגים אותם KPIs / טבלאות / Ahrefs / GA.
- בדיקה דומה על 24 קאראט (כדי לוודא שהוא ממשיך לעבוד) ועל עוד לקוח אחד מתוך הרשימה (למשל "ברלינר מעליות" או "אלהאם פארם").

## פרטים טכניים

**קבצים שיעודכנו:**
- `supabase/functions/public-dashboard/index.ts` — הסרת `.eq("tenant_id", dashboard.tenant_id)` משלושת ה-queries (tables / records / ahrefs_reports).
- `supabase/functions/public-table/index.ts` — סקירה ווידוא, ככל הנראה ללא שינוי קוד.
- מיגרציית SQL — `UPDATE crm_tables SET tenant_id = c.tenant_id FROM clients c WHERE ...`.

**אבטחה:**
- ה-share token (UUID אקראי) + `is_active = true` נשארים כשער הכניסה היחיד — אין חשיפה של נתונים מטננטים אחרים, כי כל query עדיין ממוסגר תחת `dashboard.client_id` או `table.id` ספציפי שכבר אומת מול ה-token.
- ה-RLS על הטבלאות לא משתנה — service role פועל מחוץ ל-RLS ממילא ב-edge functions.

**מדוע זה קורה מלכתחילה:**
ככל הנראה טבלאות אינטגרציה נוצרו (Ahrefs webhook / sync flows) כשהמשתמש המחובר היה ב-tenant של MarketingCaptain, אבל הלקוח הסופי נמצא ב-DMM. זה מקרה אופייני ל-shared agencies / cross-tenant. הפתרון לטווח ארוך הוא הקפדה על set-tenant מתוך ה-`client_id` בעת יצירת הטבלאות — אך זה מחוץ לטווח של הבעיה הנוכחית; המיגרציה החד-פעמית + הקוד הסלחני בקישורים הציבוריים פותרים את כל המקרים הקיימים.




# תוכנית: Webhook לקליטת נתוני Ahrefs + תיקון שגיאות Build

## סקירה

הפרויקט צריך שני דברים:
1. **תיקון שגיאות Build קיימות** (3 שגיאות ב-Edge Functions + שגיאות ב-useAiDetection.ts)
2. **יצירת מערכת Webhook לקליטת דוחות Ahrefs** — Edge Function שמקבלת נתונים מ-Ahrefs, שומרת אותם מקוטלגים בטבלה ייעודית, ומאפשרת למשוך אותם לדוחות SEO

## שלב 1: תיקון שגיאות Build

### Edge Functions (3 תיקונים קטנים)
- `make-paycall-call/index.ts` שורה 120: `error.message` → `(error as Error).message`
- `paycall-webhook/index.ts` שורה 66: אותו תיקון
- `manus-webhook/index.ts` שורה 54: Cast של `Uint8Array` — `new Uint8Array(await crypto.subtle.digest('SHA-256', body)) as unknown as Uint8Array<ArrayBuffer>`

### useAiDetection.ts
- פונקציית `safeQuery` לא עושה `await` — חסר `await` לפני הקריאה ל-`queryFn()`. צריך להוסיף `.then()` או לשנות ל-await כדי שהחזרה תהיה Promise תקין

## שלב 2: טבלת אחסון דוחות Ahrefs

### Migration חדשה — טבלת `ahrefs_reports`
```text
ahrefs_reports
├── id (uuid, PK)
├── tenant_id (uuid, FK → tenants)
├── client_id (uuid, FK → clients, nullable)
├── agency_id (uuid, FK → agencies, nullable)
├── domain (text) — הדומיין שנסרק
├── report_type (text) — organic_keywords / backlinks / referring_domains / site_explorer / domain_rating
├── report_data (jsonb) — הנתונים המלאים
├── metadata (jsonb) — מטאדאטה נוספת (מקור, גרסה, וכו')
├── report_date (date) — התאריך שהדוח מייצג
├── received_at (timestamptz, default now())
├── created_at (timestamptz)
```

RLS: גישה לפי tenant_id + super_admin

## שלב 3: Edge Function — `ahrefs-webhook`

פונקציה חדשה שמקבלת POST עם נתוני דוח:

- **אימות**: API key (secret) בכותרת `x-api-key` או `Authorization`
- **קלט**: JSON עם `domain`, `report_type`, `report_data`, `client_id` (אופציונלי), `agency_id` (אופציונלי), `tenant_id`
- **שמירה**: מוסיפה רשומה ל-`ahrefs_reports`
- **אופציונלי**: אם יש `table_id` — גם מעדכנת את טבלת ה-CRM המתאימה (כמו sync-ahrefs-data עושה היום)
- **תמיכה ב-batch**: אפשרות לשלוח מערך של דוחות בפעם אחת

כתובת ה-Webhook:
`https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/ahrefs-webhook`

## שלב 4: ממשק צפייה בדוחות

### עדכון דף Ahrefs Settings
- הוספת סקשן שמציג את כתובת ה-Webhook להעתקה
- הוספת סקשן "דוחות שהתקבלו" — טבלה שמציגה את כל הדוחות שנקלטו, מסוננים לפי דומיין/סוג/תאריך
- אפשרות לצפות בדוח ספציפי

### הוספת hook — `useAhrefsReports`
- שליפת דוחות מ-`ahrefs_reports` לפי tenant, client, domain
- שימוש ב-React Query

## שלב 5: אינטגרציה עם דוח SEO

- הוספת אפשרות למשוך נתוני Ahrefs מהדוחות השמורים לדשבורד/טבלאות קיימות
- כפתור "ייבא מדוח Ahrefs" בטבלאות SEO

## פרטים טכניים

### Secret נדרש
- `AHREFS_WEBHOOK_SECRET` — מפתח אימות לוובהוק (המשתמש יגדיר ערך ויספק אותו למערכת החיצונית)

### קבצים שישתנו/ייווצרו
1. `supabase/functions/make-paycall-call/index.ts` — תיקון type error
2. `supabase/functions/paycall-webhook/index.ts` — תיקון type error
3. `supabase/functions/manus-webhook/index.ts` — תיקון type error
4. `src/hooks/useAiDetection.ts` — תיקון await חסר
5. **חדש**: Migration ליצירת טבלת `ahrefs_reports`
6. **חדש**: `supabase/functions/ahrefs-webhook/index.ts`
7. `src/pages/AhrefsSettings.tsx` — הוספת תצוגת webhook URL + דוחות שהתקבלו
8. **חדש**: `src/hooks/useAhrefsReports.ts`




# הגדרת כרמן לניתוח דוחות קמפיינים ועדכון הדשבורד

## הבעיה הנוכחית

1. **כרמן קוראת מטבלה ישנה** — הכלי `get_facebook_campaign_data` שולף מ-`facebook_insights`, אבל נתוני הקמפיינים מסונכרנים ל-`crm_records` דרך `sync-meta-ads-data`
2. **אין לכרמן כלי לעדכן את הדשבורד** — אין כלים ליצירת רשומות ב-`communication_logs` או עדכון `mood_status`/flags בלקוחות
3. **הדשבורד לא מקבל נתוני ביצועים** — בשורה 247 ב-DMMDashboard: `performanceChangePct: null` (מסומן כ-TODO)

## הפתרון — 3 שלבים

### שלב 1: כלי חדש — `analyze_campaign_performance`
הוספה ל-`ALL_TOOLS` ב-`run-ai-agent/index.ts`:
- שולף `crm_records` מטבלאות מסוג `meta_ads` / `facebook_insights` / `facebook_ecommerce` לכל הלקוחות (או לקוח ספציפי)
- משווה 7 ימים אחרונים מול 30 ימים (spend, leads, CPL, ROAS)
- מחזיר רשימת לקוחות עם אחוז שינוי בעלויות ובביצועים

### שלב 2: כלי חדש — `update_client_health`
הוספה ל-`ALL_TOOLS`:
- מעדכן שדות `mood_status` ו/או `tier` בטבלת `clients`
- יוצר רשומה ב-`communication_logs` עם סטטוס וסיכום
- מאפשר לכרמן "להדליק דגל" על לקוח כשיש התייקרות

### שלב 3: חיווט `performanceChangePct` בדשבורד
ב-`DMMDashboard.tsx`:
- שליפת `crm_records` מטבלאות meta_ads לכל הלקוחות
- חישוב % שינוי בעלויות (7d vs 30d)
- הזנת הערך ל-`calculateHealthScore` במקום `null`

## מיגרציות נדרשות

### טבלת `communication_logs`
```sql
CREATE TABLE IF NOT EXISTS public.communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'normal',  -- normal, sensitive, complaint
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
```
(אם הטבלה כבר קיימת — לא ניצור שוב)

### עמודות `tier`, `services`, `mood_status` ב-`clients`
(כנראה כבר קיימות לפי הקוד — נוודא)

## קבצים לעריכה

| קובץ | שינוי |
|---|---|
| `supabase/functions/run-ai-agent/index.ts` | הוספת 2 כלים חדשים + executors |
| `src/pages/DMMDashboard.tsx` | חיווט performanceChangePct מ-crm_records |
| מיגרציה | communication_logs + עמודות clients (אם חסרות) |

## תוצאה
כרמן תוכל: לקרוא את נתוני הקמפיינים → לזהות התייקרויות → לעדכן את הדשבורד עם flags → המשתמש יראה אור אדום/צהוב על לקוחות עם בעיות


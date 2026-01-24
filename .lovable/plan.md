
# תיקון מערכת אנליטיקס אתרים

## הבעיות שזוהו

### 1. `tracking_id` ריק - הבעיה הקריטית
הקוד יוצר רשומה עם `tracking_id: ""` (מחרוזת ריקה), אבל ה-Trigger בבסיס הנתונים בודק רק `IS NULL`.
מכיוון שמחרוזת ריקה אינה NULL, ה-Trigger לא יוצר את ה-ID האוטומטי.

**תוצאה:** קוד המעקב שהוטמע באתר לא עובד כי הוא שולח `tracking_id` ריק.

### 2. הדשבורד לא נפתח אוטומטית לפי קוד מעקב
כרגע צריך לבחור לקוח ידנית מהתפריט. הבקשה היא שהדשבורד יהיה מקושר ישירות לקוד המעקב/לקוח.

---

## פתרון טכני

### שלב 1: תיקון ה-Trigger בבסיס הנתונים

עדכון הפונקציה `set_tracking_id()` לטפל גם במחרוזת ריקה:

```sql
CREATE OR REPLACE FUNCTION public.set_tracking_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tracking_id IS NULL OR NEW.tracking_id = '' THEN
    NEW.tracking_id := generate_tracking_id();
  END IF;
  RETURN NEW;
END;
$$;
```

### שלב 2: עדכון הרשומה הקיימת

יצירת `tracking_id` לרשומה הקיימת שנוצרה כבר עם ID ריק:

```sql
UPDATE site_tracking_configs 
SET tracking_id = public.generate_tracking_id()
WHERE tracking_id = '' OR tracking_id IS NULL;
```

### שלב 3: שיפור ה-UI - דשבורד לפי קוד מעקב

#### 3.1 הוספת לחצן "צפה בדשבורד" ליד כל קוד מעקב
בקומפוננטת `TrackingCodeGenerator.tsx`:

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    setSelectedClientId(config.client_id);
    setActiveTab("dashboard");
  }}
>
  <BarChart3 className="h-4 w-4 ml-2" />
  צפה בדשבורד
</Button>
```

#### 3.2 תיקון קוד הפרונטאנד
בקובץ `SiteAnalytics.tsx`, שינוי מ-`tracking_id: ""` ל-undefined:

```tsx
const { data, error } = await supabase
  .from("site_tracking_configs")
  .insert([{
    client_id: clientId,
    tenant_id: currentTenantId!,
    website_domain: domain,
    // לא לשלוח tracking_id בכלל - ייווצר אוטומטית
  }])
  .select()
  .single();
```

---

## סיכום השינויים

| מיקום | שינוי |
|-------|-------|
| מיגרציה SQL | תיקון Trigger לטפל גם ב-`''` |
| מיגרציה SQL | יצירת tracking_id לרשומות קיימות |
| `SiteAnalytics.tsx` | הסרת `tracking_id: ""` מה-insert |
| `TrackingCodeGenerator.tsx` | הוספת כפתור "צפה בדשבורד" |

## לאחר התיקון

1. הרשומה הקיימת תקבל `tracking_id` תקין (משהו כמו `mc_abc123def456`)
2. צריך לעדכן את קוד ההטמעה באתר הלקוח עם ה-ID החדש
3. הנתונים יתחילו להגיע לדשבורד

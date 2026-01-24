
# שיפור דשבורד אנליטיקס - RTL, פילטרים מתקדמים וייבוא נתונים

## סקירת הבקשה

המשתמש מבקש:
1. **RTL מלא** - כיוון מימין לשמאל
2. **פילטרי תאריכים מורחבים** - היום, אתמול, השבוע, 7/14/30 יום, חודש שעבר, 3 חודשים, שנה, וטווח מותאם
3. **השוואה לתקופה קודמת** - להראות שינוי יחסית לתקופה הקודמת
4. **ייבוא נתונים היסטוריים** - העלאת CSV מ-Google Analytics וקליטתו למערכת

---

## שלב 1: תיקון RTL מלא

### קובץ: `src/components/analytics/AnalyticsDashboard.tsx`

- הוספת `dir="rtl"` ל-container הראשי
- היפוך סדר ה-grid cards (מכשירים + דפים פופולריים)
- התאמת alignments בטבלאות וגרפים

```tsx
// Before
<div className="space-y-6">

// After  
<div className="space-y-6" dir="rtl">
```

---

## שלב 2: פילטרי תאריכים מתקדמים

### מבנה הפילטרים החדש

```text
+-------------------------------------------+
|  [היום] [אתמול] [7 ימים] [14 יום] [30 יום]  |
|  [השבוע] [החודש] [חודש שעבר] [3 חודשים] [שנה]  |
|  [טווח מותאם: __ עד __] [השווה לתקופה קודמת ☑] |
+-------------------------------------------+
```

### לוגיקת חישוב התאריכים

| פילטר | תאריך התחלה | תאריך סיום |
|-------|-------------|------------|
| היום | startOfDay(today) | endOfDay(today) |
| אתמול | startOfDay(yesterday) | endOfDay(yesterday) |
| השבוע | startOfWeek(today) | endOfDay(today) |
| 7 ימים אחרונים | today - 7 days | today |
| 14 ימים אחרונים | today - 14 days | today |
| 30 ימים אחרונים | today - 30 days | today |
| החודש | startOfMonth(today) | endOfDay(today) |
| חודש שעבר | startOfMonth(lastMonth) | endOfMonth(lastMonth) |
| 3 חודשים | today - 90 days | today |
| שנה | today - 365 days | today |
| מותאם | userStart | userEnd |

---

## שלב 3: השוואה לתקופה קודמת

### לוגיקה

כאשר מופעל "השווה לתקופה קודמת":
- מחשבים את אורך הטווח הנבחר (למשל 7 ימים)
- מושכים נתונים גם מ-7 הימים שלפני הטווח הנבחר
- מציגים חיצים עם אחוז שינוי בכל KPI

### דוגמה ויזואלית

```text
+---------------------------+
|  סה"כ סשנים              |
|  125                      |
|  ▲ +15.2% לעומת תקופה קודמת |
+---------------------------+
```

### קוד

```typescript
interface ComparisonData {
  currentValue: number;
  previousValue: number;
  changePercent: number;
  isIncrease: boolean;
}

const calculateComparison = (current: number, previous: number): ComparisonData => {
  const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  return {
    currentValue: current,
    previousValue: previous,
    changePercent: Math.abs(change),
    isIncrease: change >= 0
  };
};
```

---

## שלב 4: ייבוא נתונים מ-Google Analytics

### רכיב חדש: `ImportAnalyticsDialog.tsx`

דיאלוג להעלאת CSV שמכיל נתונים היסטוריים מ-Google Analytics.

### פורמט CSV נתמך

המערכת תתמוך ביצוא סטנדרטי מ-GA:

```csv
Date,Sessions,Users,Pageviews,Bounce Rate,Avg. Session Duration
2024-01-01,150,120,450,45.5,02:30
2024-01-02,175,140,520,42.0,02:45
```

### Edge Function חדש: `import-analytics-data`

```typescript
// supabase/functions/import-analytics-data/index.ts
// - מקבל CSV בגוף הבקשה
// - עושה parsing לנתונים
// - יוצר רשומות בטבלת site_sessions (עם visitor_id ו-tracking_config_id מזויפים אך תקינים)
// - מחזיר סיכום של כמה רשומות נקלטו
```

### טבלה חדשה (אופציונלי): `analytics_imports`

לצורך מעקב אחרי ייבואים:

```sql
CREATE TABLE analytics_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID REFERENCES clients(id),
  tracking_config_id UUID REFERENCES site_tracking_configs(id),
  import_date TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'google_analytics',
  records_imported INTEGER DEFAULT 0,
  date_range_start DATE,
  date_range_end DATE,
  raw_data JSONB
);
```

### UI לייבוא

```text
+------------------------------------------+
|         ייבוא נתונים מ-Google Analytics    |
+------------------------------------------+
|                                          |
|  [📁 בחר קובץ CSV]                        |
|                                          |
|  בחר לקוח: [▼ Select Client]              |
|                                          |
|  תצוגה מקדימה:                           |
|  +------+----------+-------+            |
|  | Date | Sessions | Users |            |
|  +------+----------+-------+            |
|  | 1/1  |   150    |  120  |            |
|  | 2/1  |   175    |  140  |            |
|  +------+----------+-------+            |
|                                          |
|  [ייבא X רשומות]  [ביטול]                 |
+------------------------------------------+
```

---

## קבצים לעדכון/יצירה

| קובץ | פעולה | תיאור |
|------|-------|-------|
| `src/components/analytics/AnalyticsDashboard.tsx` | עדכון | RTL, פילטרים חדשים, השוואת תקופות |
| `src/components/analytics/DateRangeFilter.tsx` | חדש | רכיב לבחירת טווח תאריכים עם presets |
| `src/components/analytics/ImportAnalyticsDialog.tsx` | חדש | דיאלוג לייבוא נתונים מ-GA |
| `src/components/analytics/ComparisonBadge.tsx` | חדש | רכיב להצגת השוואה עם חץ ואחוז |
| `supabase/functions/import-analytics-data/index.ts` | חדש | Edge Function לקליטת נתונים |
| Database migration | חדש | טבלת `analytics_imports` |

---

## תוצאה צפויה

1. **RTL מלא** - כל הממשק בכיוון מימין לשמאל
2. **פילטרים גמישים** - 10+ אפשרויות + טווח מותאם אישית
3. **השוואה חכמה** - בכל KPI יוצג אחוז שינוי מהתקופה הקודמת
4. **ייבוא קל** - העלאת CSV מ-Google Analytics והצגת הנתונים ההיסטוריים בדשבורד

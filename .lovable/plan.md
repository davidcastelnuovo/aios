

## תוכנית: חיבור פילטר סוכנות מההדר ללוח המשימות

### הבעיה
1. **לוח המשימות לא מתייחס כלל לפילטר הסוכנות מההדר** — ה-`selectedAgency` מ-`AgencyContext` לא נמצא בשימוש ב-`WeeklyTaskBoard.tsx`
2. **משימות נוצרו עם `agency_id` שגוי** — למשל, משימות של הלקוח "פ.ד פסגות" (ששייך ל-MarketingCaptain) נוצרו עם `agency_id` של "promo" — כנראה בגלל שיוך ישן
3. **הפילטר צריך לעבוד לפי הסוכנות של הלקוח**, לא לפי ה-`agency_id` של המשימה עצמה

### מה ישתנה

**קובץ: `src/components/tasks/WeeklyTaskBoard.tsx`**
- ייבוא `useAgency` מ-`AgencyContext`
- כשה-`selectedAgency` שונה מ-"all", הוספת פילטר לשאילתה:
  - שליפת רשימת `client_id` ששייכים לסוכנות הנבחרת
  - סינון המשימות כך שיוצגו רק משימות עם `client_id` מהרשימה הזו, **או** משימות עם `agency_id` תואם (למשימות ללא לקוח)
- הוספת `selectedAgency` ל-`queryKey` כדי שהנתונים יתרעננו בעת שינוי הפילטר

**קובץ: תיקון נתונים (migration)**
- עדכון ה-`agency_id` של המשימות הקיימות של "פ.ד פסגות" כך שיתאימו לסוכנות של הלקוח (MarketingCaptain) במקום promo

### פרטים טכניים

```text
שאילתת המשימות הנוכחית:
  tasks WHERE tenant_id = X (+ cross-tenant)
        AND date filters
        AND campaigner filters

לאחר התיקון:
  tasks WHERE tenant_id = X (+ cross-tenant)
        AND date filters
        AND campaigner filters
        AND (client.agency_id = selectedAgency 
             OR (client_id IS NULL AND agency_id = selectedAgency))
        // רק כש-selectedAgency !== "all"
```

הפילטור ייעשה ב-2 שלבים:
1. שליפת client_ids ששייכים לסוכנות → `clients WHERE agency_id = selectedAgency`
2. סינון משימות → `task.client_id IN (clientIds) OR (task.client_id IS NULL AND task.agency_id = selectedAgency)`


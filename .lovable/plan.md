
# תוכנית: שיוך ליד למספר אנשי מכירות (Many-to-Many)

## הבעיה הנוכחית
המבנה הנוכחי תומך רק באיש מכירות **אחד** לכל ליד (`sales_person_id` בטבלת `leads`).
אתה מבקש ששתי אנשי המכירות - **נחמה ורויטל** - יראו את **כל 50 הלידים**.

## הפתרון המוצע
יצירת טבלת קישור חדשה `lead_sales_people` שתאפשר שיוך ליד למספר אנשי מכירות:

```text
┌─────────────────┐         ┌────────────────────┐         ┌─────────────────┐
│     leads       │         │  lead_sales_people │         │  sales_people   │
├─────────────────┤         ├────────────────────┤         ├─────────────────┤
│ id              │◄────────│ lead_id            │         │ id              │
│ contact_name    │         │ sales_person_id    │────────►│ full_name       │
│ ...             │         │ tenant_id          │         │ ...             │
│ sales_person_id │         │ created_at         │         │                 │
│ (legacy)        │         └────────────────────┘         └─────────────────┘
└─────────────────┘
```

---

## שינויים נדרשים

### שלב 1: יצירת טבלת קישור חדשה
טבלה חדשה `lead_sales_people` עם:
- `id` - מזהה ייחודי
- `lead_id` - קישור לליד
- `sales_person_id` - קישור לאיש מכירות
- `tenant_id` - לבידוד ארגוני
- `created_at` - תאריך יצירה

### שלב 2: הוספת RLS Policies
- SELECT: משתמש יכול לראות קישורים שלו או של הארגון שלו
- INSERT/UPDATE/DELETE: רק בעלים/מנהלים יכולים לשנות

### שלב 3: עדכון הממשק
**בדיאלוג השיוך המרובה:**
- כשבוחרים מספר אנשי מכירות, יווצרו רשומות בטבלה החדשה לכל צירוף ליד + איש מכירות
- לדוגמה: 50 לידים × 2 אנשי מכירות = 100 רשומות בטבלה החדשה

**בתצוגת הלידים:**
- סינון לידים לפי איש מכירות יבדוק גם את הטבלה החדשה
- תצוגת "משויך ל-" תציג את כל אנשי המכירות המקושרים

### שלב 4: מיגרציה של נתונים קיימים
- העתקת כל הקישורים הקיימים מ-`sales_person_id` לטבלה החדשה
- שמירת העמודה המקורית לצורך תאימות לאחור

---

## פירוט טכני

### מיגרציית בסיס נתונים
```sql
-- טבלת קישור חדשה
CREATE TABLE lead_sales_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sales_person_id UUID NOT NULL REFERENCES sales_people(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lead_id, sales_person_id)
);

-- RLS
ALTER TABLE lead_sales_people ENABLE ROW LEVEL SECURITY;

-- מיגרציה של נתונים קיימים
INSERT INTO lead_sales_people (lead_id, sales_person_id, tenant_id)
SELECT id, sales_person_id, tenant_id 
FROM leads 
WHERE sales_person_id IS NOT NULL;
```

### עדכון קוד הלקוח (`src/pages/Leads.tsx`)

1. **שינוי mutation השיוך:**
   - במקום לעדכן `sales_person_id` בטבלת `leads`
   - ליצור רשומות ב-`lead_sales_people` לכל צירוף

2. **שינוי שליפת לידים:**
   - להוסיף JOIN עם הטבלה החדשה
   - לאפשר סינון לפי אנשי מכירות מרובים

3. **שינוי תצוגת ליד:**
   - להציג את כל אנשי המכירות המקושרים

---

## תוצאה צפויה
לאחר היישום:
- נחמה תראה את **כל 50 הלידים**
- רויטל תראה את **כל 50 הלידים**
- בכל ליד יוצגו **שתי** אנשי המכירות המשויכות

---

## קבצים לעדכון

| קובץ | שינוי |
|------|-------|
| מיגרציה SQL | יצירת טבלה + RLS + מיגרציית נתונים |
| `src/pages/Leads.tsx` | עדכון mutation + שליפה + תצוגה |
| `src/components/forms/EditLeadDialog.tsx` | עדכון עריכת אנשי מכירות (אם רלוונטי) |

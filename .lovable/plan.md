
# תוכנית לתיקון: לידים לא מוצגים (בעיית פורמט תוצאת RPC)

## הבעיה שזוהתה

המשתמש `david.castelnuovo@gmail.com` לא רואה לידים בשום ארגון למרות שיש נתונים במסד הנתונים (לדוגמה: 3 לידים בארגון marlog-leads).

### שורש הבעיה
הפונקציה `get_leads_by_stages` עודכנה בזמנו לתמוך בפרמטר `p_sales_person_ids` (UUID array למולטי-סלקט), ובמקביל **סוג ההחזרה שלה השתנה**:

| גרסה ישנה | גרסה חדשה (הבעייתית) |
|-----------|----------------------|
| `TABLE(stage text, leads jsonb, total_count bigint)` | `JSONB` |
| מחזיר **מערך שורות** | מחזיר **אובייקט** |

הקוד בפרונטאנד (שורה 858) מצפה ל**מערך**:
```javascript
if (Array.isArray(data)) {
  for (const stageData of data as any[]) {
    stageMap[stageData.stage] = { ... };
  }
}
```

כיוון שהפונקציה מחזירה **אובייקט** ולא מערך, הבדיקה `Array.isArray(data)` מחזירה `false` והלידים לא נטענים.

## הפתרון

לעדכן את קוד הפרונטאנד כדי לתמוך גם בפורמט JSONB object וגם במערך (backwards compatibility).

## שלבי הביצוע

### שלב 1: עדכון `src/pages/Leads.tsx`

שינוי הקוד בשורות 856-865 מ:

```javascript
// Transform RPC result to map: { [stageId]: { leads: [...], totalCount: number } }
const stageMap: Record<string, { leads: any[]; totalCount: number }> = {};
if (Array.isArray(data)) {
  for (const stageData of data as any[]) {
    stageMap[stageData.stage] = {
      leads: stageData.leads || [],
      totalCount: stageData.total_count || 0
    };
  }
}
```

ל:

```javascript
// Transform RPC result to map: { [stageId]: { leads: [...], totalCount: number } }
const stageMap: Record<string, { leads: any[]; totalCount: number }> = {};

if (data) {
  if (Array.isArray(data)) {
    // TABLE format: array of { stage, leads, total_count }
    for (const stageData of data as any[]) {
      stageMap[stageData.stage] = {
        leads: stageData.leads || [],
        totalCount: stageData.total_count || 0
      };
    }
  } else if (typeof data === 'object') {
    // JSONB format: { [stageKey]: { leads: [...], total_count: number, ... } }
    for (const [stageKey, stageData] of Object.entries(data as Record<string, any>)) {
      stageMap[stageKey] = {
        leads: stageData.leads || [],
        totalCount: stageData.total_count || 0
      };
    }
  }
}
```

## פרטים טכניים

### למה זה קרה?
כשהפונקציה עודכנה לתמוך בסינון מרובה של אנשי מכירות (`p_sales_person_ids` במקום `p_sales_person_id`), נוצרה גרסה חדשה שמחזירה JSONB object במקום TABLE rows. PostgreSQL בוחר את הפונקציה לפי חתימת הפרמטרים, ולכן כשה-Frontend שולח UUID array - הגרסה החדשה נבחרת.

### מבנה הנתונים

**פורמט JSONB (מה שמוחזר כעת):**
```json
{
  "new": {
    "stage_id": "uuid",
    "stage_name": "חדש",
    "stage_color": "#3b82f6",
    "leads": [{ "id": "...", "contact_name": "...", ... }],
    "total_count": 3
  },
  "contacted": {
    "stage_id": "uuid",
    "stage_name": "יצרנו קשר",
    "leads": [],
    "total_count": 0
  }
}
```

**פורמט TABLE (מה שהקוד ציפה לו):**
```json
[
  { "stage": "new", "leads": [...], "total_count": 3 },
  { "stage": "contacted", "leads": [], "total_count": 0 }
]
```

## קבצים שישתנו

| קובץ | שינוי |
|------|------|
| `src/pages/Leads.tsx` | עדכון לתמוך בשני פורמטים של תוצאת RPC |

## בדיקה

לאחר השינוי, המשתמש `david.castelnuovo@gmail.com` יוכל לראות לידים בכל הארגונים שלו, כולל 3 הלידים בארגון marlog-leads.

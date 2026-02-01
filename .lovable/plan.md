
# תוכנית תיקון: שיוך כפול של אנשי מכירות ללידים מפייסבוק

## הבעיות שזוהו

### בעיה 1: הסנכרון הידני לא תומך בריבוי אנשי מכירות
הפונקציה `sync-facebook-leads` לא מכניסה רשומות לטבלת `lead_sales_people`, בניגוד ל-webhook הרגיל.

**מה קורה:**
- Webhook בזמן אמת → מכניס ל-`lead_sales_people` ✅
- סנכרון ידני → משתמש רק ב-`sales_person_id` ולא מכניס ל-junction table ❌

### בעיה 2: טופס 21.01 מוגדר רק עם רויטל
- טופס "21.01" (החדש) → רק `sales_person_id: רויטל`
- טופס "27.11-copy-copy" (הישן) → יש `sales_person_ids: [נחמה, רויטל]` אבל הסנכרון הידני לא השתמש בו

## פתרון

### חלק 1: תיקון הסנכרון הידני
לעדכן את `sync-facebook-leads/index.ts` כדי שיתמוך ב-`sales_person_ids` וישמור ל-`lead_sales_people`

```text
קובץ: supabase/functions/sync-facebook-leads/index.ts

1. לאחר הכנסת הליד (שורה 235), להוסיף לוגיקה:
   - לקרוא sales_person_ids מה-formMapping
   - להכניס רשומות ל-lead_sales_people עבור כל איש מכירות
```

### חלק 2: שיוך רטרואקטיבי של הלידים הקיימים
להריץ UPDATE שישייך את רויטל ונחמה לכל הלידים מהשבוע האחרון:
- לידים שהגיעו מטופס 21.01 → להוסיף גם נחמה
- לידים שהגיעו מטופס 27.11 → להוסיף גם רויטל (אם חסרה)

### חלק 3: עדכון הגדרות הטופס
הטופס "טופס לידים 21.01" צריך להתעדכן עם שני אנשי המכירות (זה צריך להיעשות בממשק המשתמש).

## פרטים טכניים

### שינוי ב-sync-facebook-leads/index.ts

**לפני (שורה 192):**
```typescript
sales_person_id: formMapping.sales_person_id || null,
```

**אחרי:**
```typescript
// Support both legacy single and new multi-select
const salesPersonIds: string[] = formMapping.sales_person_ids 
  || (formMapping.sales_person_id ? [formMapping.sales_person_id] : []);

// Primary sales_person_id for backwards compatibility
sales_person_id: salesPersonIds.length > 0 ? salesPersonIds[0] : null,
```

**הוספה אחרי שורה 236 (אחרי ההכנסה המוצלחת):**
```typescript
// Insert into lead_sales_people junction table for multi-salesperson support
if (salesPersonIds.length > 0) {
  const junctionRecords = salesPersonIds.map(spId => ({
    lead_id: newLead.id,
    sales_person_id: spId,
    tenant_id: integration.tenant_id,
  }));
  
  const { error: junctionError } = await supabase
    .from('lead_sales_people')
    .insert(junctionRecords);
  
  if (junctionError) {
    console.error('Error inserting lead_sales_people:', junctionError);
  } else {
    console.log('Assigned lead to', salesPersonIds.length, 'salespeople');
  }
}
```

### שיוך רטרואקטיבי ידני (SQL)

לאחר אישור התוכנית, אריץ את ה-queries הבאים:

1. שיוך נחמה ורויטל לכל לידי השבוע האחרון:
```sql
-- Get IDs
-- נחמה: 4f058f40-0ae2-4df1-8b7a-796b6bcb77aa
-- רויטל: 48ba2e9e-bf50-4cf0-bf71-5f0d16d4bf91
-- tenant: (nexus-capital)

-- Insert missing assignments
INSERT INTO lead_sales_people (lead_id, sales_person_id, tenant_id)
SELECT DISTINCT l.id, sp.id, l.tenant_id
FROM leads l
CROSS JOIN (
  SELECT '4f058f40-0ae2-4df1-8b7a-796b6bcb77aa'::uuid as id
  UNION ALL
  SELECT '48ba2e9e-bf50-4cf0-bf71-5f0d16d4bf91'::uuid as id
) sp
WHERE l.tenant_id = (SELECT id FROM tenants WHERE slug = 'nexus-capital')
  AND l.created_at >= NOW() - INTERVAL '7 days'
  AND l.source = 'paid_ads'
  AND NOT EXISTS (
    SELECT 1 FROM lead_sales_people lsp 
    WHERE lsp.lead_id = l.id AND lsp.sales_person_id = sp.id
  )
ON CONFLICT DO NOTHING;
```

## סיכום הפעולות

| פעולה | תיאור |
|-------|-------|
| תיקון קוד | עדכון sync-facebook-leads לתמוך ב-multi-salesperson |
| שיוך רטרואקטיבי | הוספת רויטל ונחמה לכל הלידים מהשבוע האחרון |
| עדכון הגדרות | הטופס 21.01 צריך עדכון בממשק להוספת נחמה |

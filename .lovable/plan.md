

# תוכנית: תיקון גישת הלידים לרויטל ונחמה

## הבעיה שזוהתה

רויטל ונחמה לא רואות את הלידים המשויכים אליהן בגלל **חוסר קישור נכון** בין חשבון המשתמש שלהן לבין רשומות אנשי המכירות:

| בעיה | מצב נוכחי | מצב נדרש |
|------|-----------|----------|
| `profiles.sales_person_id` | NULL (ריק) | צריך להיות מקושר לרשומת sales_people |
| תפקיד ב-`user_roles` | campaigner | צריך גם sales_person |
| RLS policy | בודק `get_user_sales_person_id()` | מחזיר NULL בגלל חוסר הקישור |

## מה קורה עכשיו

```text
משתמשת: רויטל (revital640@gmail.com)
    │
    ├── profiles.sales_person_id = NULL ❌
    │
    └── user_roles.role = 'campaigner' (לא 'sales_person')
```

מדיניות ה-RLS עבור אנשי מכירות:
```
has_role('sales_person') AND sales_person_id = get_user_sales_person_id(auth.uid())
```

מכיוון ש-`get_user_sales_person_id()` מחזיר NULL, הבדיקה נכשלת והלידים לא מוצגים.

## הפתרון

### שלב 1: עדכון טבלת profiles
קישור חשבונות המשתמש לרשומות אנשי המכירות:

| משתמשת | user_id | sales_person_id (חדש) |
|--------|---------|----------------------|
| נחמה | 432abeca-7475-4f02-b636-6df873078918 | 4f058f40-0ae2-4df1-8b7a-796b6bcb77aa |
| רויטל | 91379ba0-5022-4dfb-8895-302a67693eeb | 48ba2e9e-bf50-4cf0-bf71-5f0d16d4bf91 |

### שלב 2: הוספת תפקיד sales_person
הוספת שורות ל-`user_roles` עם תפקיד `sales_person` בנוסף לתפקיד `campaigner` הקיים.

---

## פרטים טכניים

### מיגרציית בסיס נתונים

```sql
-- Link Nachama's profile to her sales_person record
UPDATE profiles 
SET sales_person_id = '4f058f40-0ae2-4df1-8b7a-796b6bcb77aa'
WHERE id = '432abeca-7475-4f02-b636-6df873078918';

-- Link Revital's profile to her sales_person record
UPDATE profiles 
SET sales_person_id = '48ba2e9e-bf50-4cf0-bf71-5f0d16d4bf91'
WHERE id = '91379ba0-5022-4dfb-8895-302a67693eeb';

-- Add sales_person role to Nachama
INSERT INTO user_roles (user_id, role, tenant_id)
VALUES ('432abeca-7475-4f02-b636-6df873078918', 'sales_person', 'eb31659b-7a21-4411-b99d-01df51cf2895')
ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

-- Add sales_person role to Revital
INSERT INTO user_roles (user_id, role, tenant_id)
VALUES ('91379ba0-5022-4dfb-8895-302a67693eeb', 'sales_person', 'eb31659b-7a21-4411-b99d-01df51cf2895')
ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
```

### איך זה עובד

לאחר התיקון:
1. `get_user_sales_person_id(auth.uid())` יחזיר את ה-ID של איש המכירות
2. RLS Policy יבדוק: `leads.sales_person_id = '48ba2e9e-...'` (לדוגמה עבור רויטל)
3. כל הלידים המשויכים לאותו sales_person_id יוצגו למשתמשת


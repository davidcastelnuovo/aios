

# תוכנית: שיוך מחדש של 77 לידים לרויטל ונחמה

## סיבת הבעיה

הפקודה הקודמת השתמשה בהשוואה מדויקת של טלפונים (`=`), אבל:
- **בקובץ**: `972503466290` (בלי +)
- **במערכת**: `+972503466290` (עם +)

זה גרם לכך שאף ליד מהקובץ לא זוהה כ"קיים", ולכן כולם נמחקו.

## נתונים מאומתים

| מקור | כמות |
|------|------|
| שורות בקובץ | 77 |
| טלפונים ייחודיים בקובץ | ~70 |
| לידים תואמים במערכת (לפי 9 ספרות אחרונות) | 74 |
| טלפונים שלא נמצאו | 4 |
| שורה אחת בלי טלפון (סהר עזרא) | 1 |

## שלבי הביצוע

### שלב 1: מציאת הליד ללא טלפון

לשורה "סהר עזרא" עם אימייל `Saharezra6@gmail.com` - נחפש לפי אימייל.

### שלב 2: שיוך מחדש לטבלת lead_sales_people

לכל ליד שמתאים (לפי 9 ספרות אחרונות או אימייל), ניצור שתי רשומות שיוך:
- אחת לרויטל (`48ba2e9e-bf50-4cf0-bf71-5f0d16d4bf91`)
- אחת לנחמה (`4f058f40-0ae2-4df1-8b7a-796b6bcb77aa`)

### שלב 3: אימות

נבדוק שהשיוך הושלם בהצלחה.

## פרטים טכניים

```sql
-- שלב 2: שיוך לפי 9 ספרות אחרונות
WITH csv_phones AS (
  SELECT unnest(array[...]) AS phone_raw
),
normalized_csv AS (
  SELECT 
    phone_raw,
    RIGHT(regexp_replace(phone_raw, '\D', '', 'g'), 9) AS last9
  FROM csv_phones
  WHERE phone_raw IS NOT NULL AND phone_raw != ''
),
matching_leads AS (
  SELECT l.id
  FROM leads l
  JOIN normalized_csv nc 
    ON RIGHT(regexp_replace(l.phone, '\D', '', 'g'), 9) = nc.last9
  WHERE l.tenant_id = 'eb31659b-7a21-4411-b99d-01df51cf2895'
)
INSERT INTO lead_sales_people (tenant_id, lead_id, sales_person_id)
SELECT 
  'eb31659b-7a21-4411-b99d-01df51cf2895',
  ml.id,
  sp.id
FROM matching_leads ml
CROSS JOIN (
  SELECT unnest(array[
    '48ba2e9e-bf50-4cf0-bf71-5f0d16d4bf91',
    '4f058f40-0ae2-4df1-8b7a-796b6bcb77aa'
  ]) AS id
) sp
ON CONFLICT (tenant_id, lead_id, sales_person_id) DO NOTHING;

-- שלב 1: שיוך לפי אימייל (לסהר עזרא)
INSERT INTO lead_sales_people (tenant_id, lead_id, sales_person_id)
SELECT 
  'eb31659b-7a21-4411-b99d-01df51cf2895',
  l.id,
  sp.id
FROM leads l
CROSS JOIN (
  SELECT unnest(array[
    '48ba2e9e-bf50-4cf0-bf71-5f0d16d4bf91',
    '4f058f40-0ae2-4df1-8b7a-796b6bcb77aa'
  ]) AS id
) sp
WHERE l.tenant_id = 'eb31659b-7a21-4411-b99d-01df51cf2895'
  AND lower(l.email) = 'saharezra6@gmail.com'
ON CONFLICT DO NOTHING;
```

## תוצאה צפויה

| מדד | ערך |
|-----|-----|
| לידים שישויכו לשתי המתאמות | ~75 |
| שיוכים חדשים (רשומות) | ~150 (75 × 2) |
| לידים שלא נמצאו (4 טלפונים לא קיימים) | 4 |

## הערות

4 הטלפונים הבאים מהקובץ **לא קיימים במערכת** (יתכן שנמחקו או לא נוספו):
- `972502174415` (Uziozon)
- `972504949497` (יוסף)
- `972523986346` (נתי)
- `972525833137` (Dan Zisman)


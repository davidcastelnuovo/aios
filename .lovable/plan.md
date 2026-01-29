

# תוכנית: מחיקת לידים כפולים

## מה יימחק?
- **80 לידים כפולים** יימחקו
- **69 מספרי טלפון** מופיעים יותר מפעם אחת
- אשאיר את **הליד העדכני ביותר** לכל מספר טלפון

## לוגיקת המחיקה

### שלב 1: ניקוי שיוכים מטבלת lead_sales_people
מחיקת רשומות השיוך של הלידים הכפולים (לא הראשיים):

```sql
DELETE FROM lead_sales_people
WHERE lead_id IN (
  SELECT id FROM leads l1
  WHERE tenant_id = 'eb31659b-7a21-4411-b99d-01df51cf2895'
  AND EXISTS (
    SELECT 1 FROM leads l2
    WHERE l2.tenant_id = l1.tenant_id
    AND l2.phone = l1.phone
    AND l2.created_at > l1.created_at  -- ליד חדש יותר קיים
  )
);
```

### שלב 2: מחיקת הלידים הכפולים
מחיקת כל ליד שיש ליד אחר עם אותו טלפון שנוצר מאוחר יותר:

```sql
DELETE FROM leads
WHERE id IN (
  SELECT l1.id FROM leads l1
  WHERE l1.tenant_id = 'eb31659b-7a21-4411-b99d-01df51cf2895'
  AND l1.phone IS NOT NULL AND l1.phone != ''
  AND EXISTS (
    SELECT 1 FROM leads l2
    WHERE l2.tenant_id = l1.tenant_id
    AND l2.phone = l1.phone
    AND l2.created_at > l1.created_at
  )
);
```

### שלב 3: עדכון שיוכים לרויטל ונחמה
לאחר המחיקה, נעדכן את השיוכים כך ש-78 הלידים מהקובץ המקורי יהיו משויכים לשתיהן.

## תוצאה צפויה

| לפני | אחרי |
|------|------|
| 522 לידים | ~442 לידים |
| 121 שיוכים לרויטל/נחמה | 78 שיוכים (לפי הקובץ) |
| 69 טלפונים כפולים | 0 כפילויות |

## פרטים טכניים

- המחיקה תתבצע באמצעות ה-Insert Tool (פעולת DELETE)
- נשמור את הליד **העדכני ביותר** לכל מספר טלפון
- כל הנתונים (הערות, סטטוסים) מהליד העדכני יישמרו


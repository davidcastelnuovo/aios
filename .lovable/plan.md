## הבעיה

בכרטיס הלקוח (Marina Divers), כשמנקים את השדה **"הוצאות חודשיות קבועות"** ולוחצים שמירה — השמירה נכשלת בשקט (לא נשמרת).

### שורש הבעיה

ב-`src/components/clients/ClientsChatView.tsx` הרכיב `EditableField` ממיר שדה מספרי ריק ל-`null`:

```ts
const finalValue = type === "number" ? (editValue ? Number(editValue) : null) : ...
```

אבל בעמודה `clients.monthly_fixed_expense` קיימת מגבלה:
- `is_nullable: NO`
- `default: 0`

כלומר Postgres דוחה `UPDATE ... SET monthly_fixed_expense = NULL` → המחיקה לא נשמרת.
(הצגנו זאת מול ה-DB: שאר הפרמטרים — RLS, הרשאות, טריגרים — תקינים.)

## הפתרון

עבור שדות מספריים ב-`EditableField` — כשהמשתמש מוחק את הערך, נשמור **`0`** במקום `null`. זה תואם גם להתנהגות התצוגה היום שמראה "₪0" כברירת מחדל.

### שינוי ממוקד

קובץ: `src/components/clients/ClientsChatView.tsx` (פונקציית `handleSave` בתוך `EditableField`, סביב שורה 320-324):

```ts
// לפני
const finalValue = type === "number"
  ? (editValue ? Number(editValue) : null)
  : (editValue || null);

// אחרי
const finalValue = type === "number"
  ? (editValue === "" ? 0 : Number(editValue))
  : (editValue || null);
```

זה משפיע על שלושת השדות המספריים בכרטיס (ריטיינר, תקציב חודשי, הוצאות חודשיות קבועות) — כולם מקבלים `0` במקום `null` כשנמחקים, מה שנשמר תקין ב-DB.

### בנוסף (שיפור איכות)

`updateClientField` כיום קורא ל-`.update(...)` בלי `.select()`, כך שכשל RLS לא מחזיר שגיאה אלא 0 שורות. נוסיף `.select()` כדי שגם בעתיד שגיאות לא יסתתרו:

```ts
const { error, data } = await supabase
  .from("clients")
  .update({ [field]: value })
  .eq("id", clientId)
  .select();
if (error) throw error;
if (!data || data.length === 0) throw new Error("Update blocked by permissions");
```

## בדיקה לאחר היישום

1. פתיחת כרטיס Marina Divers → ניקוי "הוצאות חודשיות קבועות" → שמירה.
2. לוודא ש-toast הצלחה מופיע והערך מוצג כ-`₪0`.
3. רענון הדף — הערך נשאר `0`.

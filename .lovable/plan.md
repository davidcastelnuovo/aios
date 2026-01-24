
# תוכנית: תיקון טבלת דירוג ביטויים (RTL) ושיפור הסריקה

## זיהוי הבעיות

### בעיה 1: ביטויים לא נסרקו
מבדיקת המסד נתונים - **כל הביטויים ברשימה מעולם לא נסרקו** (`last_checked_at = null`). הטקסט "לא נמצא" מוצג כי הסריקה עוד לא בוצעה, לא בגלל שהם לא נמצאו בגוגל.

יש לבדוק: האם הסריקה הושלמה בהצלחה? האם היו שגיאות API?

### בעיה 2: טבלה לא RTL
הטבלה הנוכחית לא מותאמת ל-RTL:
- כותרות לא מיושרות לימין
- סדר העמודות לא הפוך
- כפתור המחיקה בצד הלא נכון

---

## פתרון טכני

### קובץ: `src/pages/RankTrackingProject.tsx`

#### 1. תיקון RTL לטבלה

**לפני:**
```tsx
<TableHead>ביטוי</TableHead>
<TableHead className="text-center w-24">מיקום</TableHead>
...
```

**אחרי:**
```tsx
<Table dir="rtl">
  <TableHeader>
    <TableRow>
      <TableHead className="text-right">ביטוי</TableHead>
      <TableHead className="text-center w-24">מיקום</TableHead>
      <TableHead className="text-center w-24">שינוי</TableHead>
      <TableHead className="text-center w-20">Best</TableHead>
      <TableHead className="text-center w-20">Worst</TableHead>
      <TableHead className="text-right">URL</TableHead>
      <TableHead className="text-center w-36">נבדק</TableHead>
      <TableHead className="w-16 text-left"></TableHead>
    </TableRow>
  </TableHeader>
```

#### 2. יישור תאים לימין
```tsx
<TableCell className="font-medium text-right">{keyword.keyword}</TableCell>
...
<TableCell className="max-w-[200px] truncate text-muted-foreground text-xs text-right">
  {keyword.found_url || "-"}
</TableCell>
```

#### 3. הוספת אינדיקציה "לא נסרק עדיין"

כרגע "לא נמצא" מוצג גם עבור ביטויים שמעולם לא נסרקו. נבחין:

```tsx
const getPositionBadge = (position: number | null, lastChecked: string | null) => {
  if (!lastChecked) {
    return <Badge variant="outline" className="bg-gray-50 text-gray-500">ממתין</Badge>;
  }
  if (position === null) {
    return <Badge variant="outline" className="bg-orange-50 text-orange-600">לא נמצא</Badge>;
  }
  // ...existing logic
};
```

---

## סיכום שינויים

| שינוי | תיאור |
|-------|-------|
| RTL לטבלה | הוספת `dir="rtl"` ויישור ימין לכותרות ותאים |
| אינדיקציה "ממתין" | הבחנה בין ביטוי שלא נסרק לביטוי שנסרק ולא נמצא |
| יישור כפתור מחיקה | הזזה לצד שמאל (סוף השורה ב-RTL) |

## המלצה
לאחר התיקונים, יש להפעיל "סרוק הכל" כדי לסרוק את כל הביטויים שטרם נסרקו.

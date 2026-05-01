
## הבעיה
בכרטיסיות של הטבלאות הדינמיות (דף `/dynamic-tables`), הטקסט והאייקונים לא מיושרים נכון ל-RTL:

1. **כותרת הכרטיסייה** (`CardTitle`) - האייקון מופיע משמאל לטקסט אבל בעברית הוא צריך להופיע מימין, וגולש לתוך אזור כפתורי העריכה/מחיקה.
2. **תיאור הכרטיסייה** ("דוח SEO עבור ggds.co.il" ו-"לחץ לצפייה וניהול") - מיושרים לשמאל במקום לימין.
3. **שם הטבלה הארוך** - לא נשבר נכון ויוצר overlap עם הכפתורים בצד שני.

## התיקון

**קובץ:** `src/pages/DynamicTables.tsx` (שורות ~758-870)

### שינויים:
1. הוספת `dir="rtl"` או `text-right` ל-`CardHeader` וה-`CardContent` של הכרטיסייה.
2. שינוי סדר האייקון והטקסט ב-`CardTitle` כדי שהאייקון יופיע אחרי הטקסט (`flex-row-reverse` או החלפת הסדר), כך שב-RTL האייקון יראה ימינה לטקסט.
3. הוספת `truncate` או `min-w-0` לטקסט הכותרת כדי למנוע גלישה לכפתורים, והוספת `flex-shrink-0` לכפתורי הפעולה.
4. ודאי שכל ה-`CardDescription` ופסקאות `CardContent` יורשים יישור ימני.

### לפני:
```tsx
<CardTitle className="flex items-center gap-2">
  <FileSpreadsheet className="h-5 w-5" />
  {table.name}
</CardTitle>
```

### אחרי:
```tsx
<CardTitle className="flex items-center gap-2 min-w-0 flex-1">
  <FileSpreadsheet className="h-5 w-5 flex-shrink-0" />
  <span className="truncate">{table.name}</span>
</CardTitle>
```

ובלוק הכפתורים יקבל `flex-shrink-0`.

### בנוסף:
- בדיקה שאר הכרטיסיות (קטגוריות בשורות ~661-688) עוברות אותו טיפול אם יש שם בעיה דומה.
- ודאי ש-`CardDescription` ב-`text-right` (אם לא יורש מ-`dir="rtl"` הגלובלי).

## מה לא נכלל
- לא נשנה את לוגיקת הסנכרון - היא כבר תוקנה בהודעות קודמות.
- לא נוגעים בעיצוב הצבעים/גרדיאנט של הכרטיסיות.

האם לאשר את התיקון?

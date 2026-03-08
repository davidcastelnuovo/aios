

# קישור קטגוריות ל-Gmail Labels

## הבעיה
כרגע קטגוריות עובדות רק לפי **התאמת נושא** (subject pattern). אם אין חוקים שמורים לקטגוריה מסוימת, היא מציגה הכל או כלום.
המשתמש רוצה:
- **"חשובים"** → יציג אימיילים עם תג Gmail (למשל IMPORTANT)
- **"חשבוניות"** → יציג אימיילים עם תג Gmail ספציפי לחשבוניות

## הפתרון

### 1. DB Migration — הוספת `gmail_label_id` ל-`gmail_categories`
```sql
ALTER TABLE gmail_categories ADD COLUMN gmail_label_id text DEFAULT null;
```
כל קטגוריה תוכל להיות מקושרת ל-Gmail Label ID (למשל `IMPORTANT`, `Label_123`).

### 2. עדכון `GmailSettings.tsx` — בחירת Gmail Label לכל קטגוריה
- בטופס יצירת/עריכת קטגוריה, הוספת dropdown לבחירת Gmail Label מתוך הרשימה (כבר יש `listLabels`)
- שמירת ה-`gmail_label_id` הנבחר

### 3. עדכון `Gmail.tsx` — סינון לפי Label כשקטגוריה נבחרת
- כשנבחרת קטגוריה עם `gmail_label_id`: שולחים ל-API את ה-`labelIds` המתאים במקום/בנוסף ל-subject query
- כשנבחרת קטגוריה בלי `gmail_label_id`: ממשיכים עם subject patterns כמו היום
- תמיכה משולבת: label + subject patterns ביחד

### 4. עדכון קריאת ה-API ב-`Gmail.tsx`
```typescript
// כשקטגוריה נבחרת עם gmail_label_id
const categoryLabelIds = selectedCategory 
  ? categories.find(c => c.id === selectedCategory)?.gmail_label_id 
  : null;

// בקריאה ל-API:
labelIds: categoryLabelIds ? [categoryLabelIds] : (allowedLabels.length > 0 ? allowedLabels : undefined)
```

## קבצים לשינוי

| קובץ | שינוי |
|-------|-------|
| DB migration | `ALTER TABLE gmail_categories ADD COLUMN gmail_label_id text` |
| `src/pages/Gmail.tsx` | שינוי query כשקטגוריה עם label נבחרת — שליחת `labelIds` ל-API |
| `src/pages/GmailSettings.tsx` | הוספת dropdown לבחירת Gmail Label בטופס קטגוריה |

## זרימה חדשה
```text
הגדרות:
  1. יוצר קטגוריה "חשבוניות"
  2. בוחר Gmail Label מתוך dropdown (למשל "חשבוניות" מ-Gmail)
  3. שומר

תצוגה:
  1. לוחץ על קטגוריה "חשבוניות"
  2. המערכת שולחת query ל-Gmail API עם labelIds=["Label_xyz"]
  3. רואה את כל האימיילים עם אותו תג
```




# הוספת Gmail לתפריט

## מצב נוכחי
- עמוד Gmail קיים בנתיב `/gmail` (ב-`App.tsx`)
- **אין פריט תפריט** בטבלת `menu_items` עבור Gmail
- התפריט נטען דינמית מהדאטהבייס

## מה צריך לעשות

### 1. הוספת פריט תפריט ל-DB (migration)
הוספת שורת `menu_items` לכל 11 הטנאנטים:
```sql
INSERT INTO menu_items (tenant_id, menu_key, original_label, route, icon, is_visible, sort_order)
SELECT id, 'gmail', 'דואר נכנס', '/gmail', 'Mail', true, 11
FROM tenants;
```

- `menu_key`: `gmail`
- `original_label`: `דואר נכנס`
- `icon`: `Mail` (Lucide icon)
- `sort_order`: 11 (אחרי חתימות דיגיטליות)
- `is_visible`: true

### 2. הוספת permission mapping ב-AppSidebar
בתוך `modulePermissions` צריך להוסיף:
```ts
'gmail': 'gmail',
```

כך המערכת תדע לבדוק הרשאות עבור הפריט הזה.

## קבצים לשינוי

| קובץ | שינוי |
|-------|-------|
| DB migration | הוספת שורות `menu_items` לכל הטנאנטים |
| `src/components/layout/AppSidebar.tsx` | הוספת `'gmail': 'gmail'` ל-`modulePermissions` |


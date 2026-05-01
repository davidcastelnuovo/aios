
## הבעיה

כפתור "סנכרן עכשיו" בקטגוריה שולח לפונקציה `sync-ahrefs-data` רק `{ tableId, table_id }`, אבל הפונקציה דורשת גם אובייקט `config` עם `target` (דומיין) ו-`dataType`. בלי זה, הפונקציה מחזירה שגיאה 400 ("Missing tableId or config.target") — ולכן כל 36 הדוחות נכשלים.

הנתונים הנדרשים כבר קיימים ב-`integration_settings` של כל טבלה (`targetDomain`, `reportType`).

## התיקון

### 1. עדכון `CategorySyncControl.tsx`
כשהסוג הוא `ahrefs`, לשלוח את הפרמטרים הנדרשים מתוך `integration_settings`:

```ts
body: {
  tableId: t.id,
  table_id: t.id,
  config: {
    target: t.integration_settings?.targetDomain,
    dataType: t.integration_settings?.reportType || 'site_explorer',
  }
}
```

### 2. עדכון `sync-ahrefs-data/index.ts`
להוסיף fallback: אם לא נשלח `config`, לשלוף את `integration_settings` מהטבלה עצמה בבסיס הנתונים ולבנות ממנו את ה-`config` אוטומטית. כך גם קריאות עתידיות שלא ישלחו config יצליחו.

---

שני שינויים בלבד, ללא שינויי מסד נתונים.

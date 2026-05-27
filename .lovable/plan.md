## הבעיה
המיני-טאב של דוח Google Analytics מצלם מסך לבן/ריק. הסיבה: ב-`DynamicTableView.tsx` הרינדור של GA (וגם GSC) חסום מאחורי `!summaryOnly`. ב-`ClientReportPanel.tsx` רק `ahrefs` מקבל `summaryOnly={false}`, לכן ה-snapshot של GA רץ ב-summaryOnly ולא מציג כלום — והצילום יוצא ריק.

## התיקון
בקובץ `src/components/clients/ClientReportPanel.tsx` שורה 703 — להרחיב את החריגה כך שגם `google_analytics` ו-`google_search_console` יצולמו במצב מלא ולא ב-summary:

```tsx
summaryOnly={
  ["ahrefs", "google_analytics", "google_search_console"].includes(table.integration_type)
    ? false
    : true
}
```

זה גם יישר את ההתנהגות עם דוחות SEO (GSC) ש-לא בדקת אבל סובלים מאותה בעיה בשקט.

## אופציונלי — להוסיף עיכוב גדול יותר ל-GA
GA טוען כמה queries מקבילים (פלחי תאריכים, אירועים). אם אחרי התיקון הצילום יוצא חלקי, נעלה את ה-`delay` ב-`useEffect` (שורה 226) גם ל-GA ל-6000ms (כמו ahrefs) במקום 3000.

## קבצים שיתעדכנו
- `src/components/clients/ClientReportPanel.tsx` (שורה 703, ואופציונלית גם 226)
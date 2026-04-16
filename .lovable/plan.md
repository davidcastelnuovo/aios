

## תוכנית: ברירת מחדל "לידים" בדוח Analytics דרך SEO

### בעיה
כשפותחים את לשונית Analytics דרך דוח SEO, הדוח תמיד נפתח על "איקומרס" כי `defaultReportMode` לא מועבר לקומפוננטה.

### שינוי

**קובץ: `src/components/dynamic-tables/SeoReportTabs.tsx`** (שורה ~354)

העברת `defaultReportMode` מתוך `integration_settings` של טבלת ה-GA הנבחרת:

```tsx
<GoogleAnalyticsDashboard
  records={gaRecords}
  tableId={selectedGaTableId}
  defaultReportMode={
    (gaTables.find(t => t.id === selectedGaTableId)?.integration_settings as any)?.default_report_mode || 'leads'
  }
/>
```

ברירת המחדל תהיה `'leads'` במקום `'ecommerce'` — כך שכל טבלת GA שנפתחת דרך דוח SEO תציג לידים כברירת מחדל, אלא אם המשתמש שינה ידנית לאיקומרס (ואז ההגדרה נשמרת ב-`integration_settings`).

### QA
- לוודא שלשונית Analytics בדוח SEO נפתחת על "לידים"
- לוודא שאם משנים לאיקומרס, השינוי נשמר ונשאר בפתיחה הבאה


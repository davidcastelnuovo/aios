

## תיקון קישור שיתוף טבלה

### הבעיה
ב-`ShareTableDialog` הפונקציה `getShareUrl` משתמשת ב-`window.location.origin` ישירות, מה שגורם ליצירת קישורים עם דומיין ה-preview (שלא עובד לצפייה חיצונית). בדשבורד זה כבר תוקן לשימוש בדומיין הפרסום `after-lead.lovable.app`.

### הפתרון
**קובץ: `src/components/dynamic-tables/ShareTableDialog.tsx`**

שינוי `getShareUrl` (שורה 104-106) לאותה לוגיקה כמו בדשבורד:

```typescript
const getShareUrl = (token: string) => {
  const origin =
    window.location.hostname.includes("preview") || window.location.hostname.includes("lovableproject")
      ? "https://after-lead.lovable.app"
      : window.location.origin;
  return `${origin}/shared/table/${token}`;
};
```

שינוי של 3 שורות בלבד בקובץ אחד.


## תיקון שיקוף הדשבורד בקישור השיתוף

### הבעיה
הקישור הציבורי מציג נתונים שונים מהדשבורד הפנימי כי הם שני קומפוננטים נפרדים עם לוגיקה שונה.

### הפתרון

**1. הסתרת קובייית Analytics כשאין נתונים**
- ב-`DashboardView.tsx` וב-`SharedDashboard.tsx`: להציג את כרטיס Analytics רק כש-`analyticsSessions > 0`.

**2. יישור טווח תאריכים ברירת מחדל**
- `SharedDashboard.tsx`: לשנות מ-`last_30_days` ל-`last_7_days` כדי להתאים לדשבורד הפנימי.

**3. יישור לוגיקת KPI של פייסבוק**
- לוודא שהקישור הציבורי מציג Leads/CPL/Clicks (כמו הפנימי) ולא Purchases/ROAS.
- התאמת חישוב המדדים ב-`public-dashboard` Edge Function ל-`DashboardView`.

### בדיקה
- דשבורד איריס גאיר: לוודא שהקישור הציבורי מציג בדיוק את אותם מספרים כמו התצוגה הפנימית, בלי קוביית Analytics.
- דשבורדים עם Analytics אמיתי: לוודא שהקובייה עדיין מופיעה.

### קבצים מושפעים
- `src/pages/DashboardView.tsx`
- `src/pages/SharedDashboard.tsx`
- `supabase/functions/public-dashboard/index.ts` (אם נדרש יישור חישובים)

## מטרה
להרחיב את מסנן התאריכים בדשבורד (`/dashboard/:id`) כך שיכלול את האפשרויות הנוספות: **14 ימים אחרונים**, **השבוע**, **שבוע שעבר**, ו**טווח מותאם אישית** (בחירה מהיומן). הלוגיקה ב-Backend (`crm-records`) כבר תומכת בכל הערכים האלה — הבעיה היא רק שה-UI ב-`DashboardView.tsx` לא חושף אותם, וה-Custom Picker שמופיע ב-Analytics (`GoogleAnalyticsDashboard.tsx`) לא משולב כאן.

## גישה
לא בונים רכיב חדש — נשתמש באותו דפוס שכבר עובד ב-`GoogleAnalyticsDashboard.tsx`: `Select` + `Popover` עם `Calendar mode="range"`.

## שינויים

### 1. `src/pages/DashboardView.tsx`
- להוסיף ל-`DATE_FILTERS` את הערכים: `this_week` (השבוע), `last_week` (שבוע שעבר), `last_14_days` (14 יום אחרונים), `custom` (טווח מותאם אישית).
- להוסיף state חדש: `customDateRange: { from?: Date; to?: Date }` + `calendarOpen`.
- ליד ה-`Select` הקיים (שורה 1055), להוסיף Popover עם `Calendar mode="range"` שמופיע רק כשהמסנן הוא `custom` — מועתק מהדפוס ב-`GoogleAnalyticsDashboard.tsx` שורות 702–733.
- להעביר `date_from`/`date_to` ל-query של `crm-records` (שורה 237) כשהמסנן הוא `custom` — ה-Edge Function כבר תומך בזה (`getDateRange(filter, customFrom, customTo)`).
- להוסיף את הערכים החדשים ל-`wooDateRange` switch (שורות 315–342) ול-`computeRange` ב-`handleRefresh` (שורות 868–884).
- להוסיף את הערכים החדשים גם ל-queryKey של ה-queries הרלוונטיים כדי לטרגר refetch.

### 2. `src/components/dynamic-tables/WooCommerceDashboard.tsx`
- להוסיף ל-`getDateRange` (שורות 29–77) את `this_week`, `last_week`, `last_14_days`, ולקבל פרופ אופציונלי `customFrom`/`customTo` עבור `custom`.
- להעביר את ה-Props החדשים מ-`DashboardView.tsx`.

### 3. `src/components/dynamic-tables/AgencyDashboardContent.tsx`
- לקבל גם `customFrom`/`customTo` ולהעביר אותם כ-`date_from`/`date_to` ב-query ל-`crm-records` (שורה 517).

## הערות
- `GoogleAnalyticsDashboard` כבר מקבל `externalDateFilter` ויודע לטפל בכל הערכים — אין צורך לשנותו.
- אין נגיעה ב-Edge Functions; הלוגיקה כבר קיימת ב-`supabase/functions/crm-records/index.ts`.
- אין שינויי עיצוב — שימוש באותם רכיבי `Select`/`Popover`/`Calendar` שכבר בשימוש.

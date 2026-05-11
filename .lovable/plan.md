
## הבעיה

ללקוח "24 קאראט" יש כעת **2 דוחות Ahrefs**:

| דוח | תאריך דוח | טננט | ביטויים במעקב |
|-----|-----------|------|----------------|
| חדש (סנכרון היום) | 11.5.2026 | DMM (`6ad8f3…`) | **27** (כולל "מחשבון זהב") |
| ישן | 6.4.2026 | MarketingCaptain | 14 |

ה-RLS וה-`useSeoScope` כבר מאפשרים למשתמש ב-MarketingCaptain לראות את שני הדוחות (דרך `agency_tenant_access` + `agency_id` על השורה החדשה). למרות זאת בדאשבורד בפועל מוצגים 14 הביטויים של דוח אפריל ולא 27 של מאי.

הסיבה: ב-`SeoDashboardView` הדוח שנבחר כברירת מחדל הוא `validReports[0]` כשהמיון מהשרת הוא `order('report_date', { ascending: false })`. כשיש קצוות (דוחות בלי `report_date` תקין, או ערכים שווים), Postgres יכול להחזיר את הדוח הישן לפני החדש, וגם אם המיון תקין — אין fallback ל-`received_at` שהוא תאריך הסנכרון בפועל. בנוסף, הקומבו-בוקס מציג רק `report_date`, מה שמסתיר מהמשתמש איזה דוח באמת חדש יותר.

## התיקון

1. **`src/components/dynamic-tables/SeoDashboardView.tsx`**
   - לשנות את שאילתת `seo-dashboard-reports` למיין לפי `received_at desc` (תאריך הסנכרון בפועל) ואחר כך `report_date desc` כ-tiebreaker.
   - ב-`useMemo` של `selectedReport`: אם אין `selectedReportId`, לבחור את הדוח עם ה-`received_at` הכי חדש מתוך `validReports`, ולא רק `validReports[0]`.
   - להוסיף `useEffect` שמאפס את `selectedReportId` כש-`clientId` משתנה, כך שלאחר סנכרון מצליח (שמרענן את ה-query) הדוח החדש תמיד נבחר.
   - בקומבו-בוקס של בחירת הדוח: להוסיף ליד ה-`report_date` תווית קטנה "סונכרן: dd/MM" מ-`received_at`, ולסמן את הדוח האחרון עם Badge "אחרון" כדי שיהיה ברור איזה דוח מציגים.

2. **`src/pages/DynamicTableView.tsx`** (אופציונלי-קצר)
   - אחרי `syncAhrefsMutation` מוצלח, להוסיף `queryClient.invalidateQueries({ queryKey: ['seo-dashboard-reports'] })` (כבר קיים ב-`handleManualSync` הפנימי, אבל לא בכפתור הסנכרון החיצוני של DynamicTableView). זה מבטיח שדוחות חדשים יופיעו מיד גם כשמסנכרנים מהכפתור החיצוני.

3. **בדיקה**
   - לטעון מחדש את `/t/marketingcaptain/table/seo-report-…-1775762800150` ולוודא:
     - הקומבו-בוקס פתוח על הדוח של 11.5.2026 (Badge "אחרון").
     - ה-Badge "🎯 27 במעקב" מופיע.
     - בלשונית "ביטויים במעקב" מוצג "מחשבון זהב" וכל 27 הביטויים.

## הערות

- אין שינוי באף Edge Function או ב-DB; הדוח החדש כבר קיים ועובר RLS. זה אך ורק תיקון UI לבחירת ברירת המחדל.
- לא מוחקים את הדוח הישן — נשאר זמין דרך הקומבו-בוקס למשתמש שירצה להשוות.

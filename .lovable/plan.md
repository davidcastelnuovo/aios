
המשתמש בחר באופציה 3 — שניהם: כרטיס סיכום בטאב WordPress של הלקוח + דף מלא מנוהל.

אני יודע מהבדיקה הקודמת:
- האתר חושף `/wp-json/elementor/v1/forms` ו-`/wp-json/elementor/v1/form-submissions`
- האימות עם Application Password הקיים
- כל submission כולל: email, referer (עם gclid/gad_campaignid), created_at, form_id, IP

צריך לבנות:
1. Edge function `fetch-elementor-submissions` — שולפת ומעבדת
2. רכיב תצוגה לכרטיס סיכום בטאב WordPress של הלקוח
3. דף מלא ב-route חדש

לא צריך טבלאות DB — fetch בזמן אמת + cache קצר ב-React Query.

שומר את הplan קצר.

## מה אבנה

### 1) Edge function: `fetch-elementor-submissions`
- מקבל `site_id` של אתר WordPress + טווח תאריכים אופציונלי
- שולף את האתר מ-`social_media_wordpress_sites` (כולל credentials)
- קורא ל-Elementor REST API עם pagination מלא:
  - `/wp-json/elementor/v1/forms` — רשימת טפסים
  - `/wp-json/elementor/v1/form-submissions?per_page=100` — כל ה-submissions
- מחזיר JSON מאוגד:
  - **per_form**: לכל טופס — שם, count, פילוח מקורות (Google/Facebook/Direct/Organic/Test)
  - **per_campaign**: לפי `gad_campaignid` — מספר submissions לכל קמפיין גוגל
  - **submissions[]**: רשימה גולמית עם email, referer, gclid, gad_campaignid, תאריך, form name
- זיהוי טסטים אוטומטי: referer מכיל `gtm_debug` או `localhost`

### 2) כרטיס סיכום בטאב WordPress של הלקוח
מיקום: `ClientWordPressTab.tsx` (קיים)
תוכן:
- כותרת "Submissions בעמודי נחיתה" + כפתור "רענן"
- 3 מטריקות בולטות: סה"כ Submissions / מ-Google Ads / טסטים שזוהו
- טבלה קומפקטית: שם טופס | כמות 7 ימים | כמות 30 ימים | מקור עיקרי
- קישור "פתח דף מלא →" לדף המנוהל

### 3) דף מלא: `/landing-page-submissions` (או תת-route תחת WordPress)
- בורר אתר (אם יש כמה אתרים מחוברים)
- בורר טווח תאריכים (7/30/90 ימים / מותאם)
- 4 כרטיסי KPI: סה"כ / Google / Facebook / טסטים
- טבלת טפסים מלאה עם sorting + סינון
- לחיצה על שורה → drawer עם רשימת ה-emails + referer מלא לכל submission
- טאב נוסף "לפי קמפיין גוגל" שמציג `gad_campaignid` ↔ כמות submissions (מוכן לקישור עתידי לדוח Google Ads)

### 4) Hook משותף: `useElementorSubmissions(siteId, dateRange)`
- React Query עם cache של 5 דקות
- משמש את שני הרכיבים (כרטיס + דף מלא) כדי לא לכפול קריאות

## מבנה זרימה

```text
ClientWordPressTab ──┐
                     ├──> useElementorSubmissions ──> fetch-elementor-submissions ──> WP REST API
LandingPageSubsPage ─┘                                         │
                                                               ▼
                                                       social_media_wordpress_sites
                                                       (credentials)
```

## ללא שינויי DB
שום מיגרציה. הכל בזמן אמת מ-WP. עתידית, אם תרצה היסטוריה — נוסיף טבלת snapshots.

## פירוט טכני קצר
- חילוץ source מ-referer: regex על `gad_campaignid=`, `gclid=`, `fbclid=`, `utm_source=`, וזיהוי `gtm_debug`
- pagination: לולאה עד שמתקבל `per_page` מלא, מקסימום 10 דפים (1000 submissions) לבטיחות
- אימות: Basic Auth — `Authorization: Basic ${base64(username:app_password)}`
- אם ה-API מחזיר 404/401 — fallback מסודר עם הודעה ברורה ב-UI ("Elementor Pro Submissions לא מופעל באתר")

## קבצים שיושפעו / ייווצרו
- **חדש**: `supabase/functions/fetch-elementor-submissions/index.ts`
- **חדש**: `src/hooks/useElementorSubmissions.ts`
- **חדש**: `src/pages/LandingPageSubmissions.tsx`
- **חדש**: `src/components/landing-page-submissions/SubmissionsSummaryCard.tsx`
- **חדש**: `src/components/landing-page-submissions/SubmissionsFullView.tsx`
- **עדכון**: `src/components/clients/ClientWordPressTab.tsx` — הוספת הכרטיס
- **עדכון**: `src/App.tsx` — route חדש `/t/:tenantSlug/landing-page-submissions`
- **עדכון**: `src/components/layout/AppSidebar.tsx` — פריט תפריט (אופציונלי, תחת "אינטגרציות")

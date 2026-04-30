## הבעיה

ב-Tab "ביטויים במעקב" (`tracked_keywords`) בדוח SEO של תבניקול לא מופיעים ביטויים, כי:

- הסנכרון הידני (Project Picker → `fetch-ahrefs-snapshot`) מושך **רק `organic-keywords`** מ-Site Explorer של Ahrefs.
- הוא **לא** מושך את הביטויים מה-**Rank Tracker** של אותו פרויקט (זה המקור ל"ביטויים במעקב").
- שדה `tracked_keywords` נכתב רק כש-Make/Zapier שולחים אותו ידנית ל-`ahrefs-webhook`. אין עבור תבניקול אוטומציה כזו, ולכן השדה נשאר ריק.

ב-frontend: `SeoKeywordsTable.tsx` מציג את לשונית "🎯 ביטויים במעקב" רק כש-`trackedKeywords.length > 0` — ולכן היא לא מופיעה.

## הפתרון

להרחיב את `fetch-ahrefs-snapshot` כך שכשהמשתמש בוחר פרויקט מה-Project Picker (יש לנו `project_id` של Ahrefs), נמשוך גם את ה-Rank Tracker keywords ונכלול אותם תחת `tracked_keywords` ב-payload שעובר ל-`ahrefs-webhook`. ה-webhook כבר יודע לטפל בהם (שורה 213).

### שינויים

**1. `src/components/dynamic-tables/AhrefsProjectPicker.tsx`**
- להעביר גם `projectId: project.project_id` בקריאה ל-`fetch-ahrefs-snapshot`. (כרגע מועברים רק `domain`, `mode`, `protocol`.)

**2. `supabase/functions/fetch-ahrefs-snapshot/index.ts`**
- לקבל `projectId` בגוף הבקשה.
- אם קיים, לקרוא ל-Ahrefs Rank Tracker API:
  ```
  GET https://api.ahrefs.com/v3/rank-tracker/overview?project_id={projectId}&country={country}
  ```
  או נקודת הקצה הנכונה לקבלת רשימת keywords עם position נוכחי. (אאמת את ה-endpoint המדויק מתיעוד Ahrefs v3 לפני המימוש — Rank Tracker חושף את `keywords-overview` / `metrics-by-position` / `serp-positions-history`.)
- למפות את התוצאה למבנה הקיים שה-frontend מצפה לו:
  ```ts
  { keyword, position, position_prev_month, traffic, traffic_prev_month, volume, kd, cpc, url }
  ```
- לכלול את המערך ב-payload:
  ```ts
  report_data: { domain, snapshot, organic_keywords, tracked_keywords }
  ```
- להחזיר גם `tracked_count` בתשובה כדי לתת פידבק ב-toast.

**3. `src/components/dynamic-tables/AhrefsProjectPicker.tsx` (toast)**
- אחרי הסנכרון להציג: `הדוח של {project_name} נטען בהצלחה (X organic, Y tracked)`.

### קבצים מעורבים

- `supabase/functions/fetch-ahrefs-snapshot/index.ts` — לוגיקה חדשה למשיכת Rank Tracker.
- `src/components/dynamic-tables/AhrefsProjectPicker.tsx` — העברת `project_id` והודעת toast מורחבת.

### לא משתנה

- `ahrefs-webhook` — כבר תומך ב-`tracked_keywords`.
- `SeoDashboardView` / `SeoKeywordsTable` — כבר מציגים את הלשונית כשיש נתונים.

## אימות

לאחר הפריסה: סנכרון מחדש של תבניקול דרך Project Picker → לוודא ש-`tracked_count > 0` ב-toast → הלשונית "🎯 ביטויים במעקב" אמורה להופיע בדוח.

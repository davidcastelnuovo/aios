# תכנית: "צור ארגון ללקוח" (Create Organization for Client)

מטרה: מתוך לקוח קיים, ליצור בלחיצה אחת ארגון (tenant) חדש שמייצג אותו לקוח — עם
בעלים = איש הקשר הראשי, שיתוף כל החיבורים, וכרמן + אוטומציות מוכנים לעבודה.

## החלטות מוצר שאושרו
1. **שיתוף חיבורים = הפניה משותפת** (לא העתקה). מקור אמת אחד; רענון/עדכון token
   מתעדכן אוטומטית בשני הארגונים.
2. **איש הקשר הראשי = owner**. אם אין לו חשבון במערכת — נשלחת הזמנה אוטומטית
   (`invitation_tokens`).
3. **כרמן + אוטומציות נוצרים אוטומטית** בארגון החדש (שימוש חוזר ב-`clone-entity-to-tenant`).

## מה כבר קיים ונשתמש מחדש
- `create-tenant-with-owner` — יצירת tenant, owner ב-`tenant_users`+`user_roles`,
  הזמנה, החלת template דרך `copy_tenant_template`.
- `clone-entity-to-tenant` — משכפל כרמן (+`ai_skills` skins), אוטומציות (כבויות),
  pipelines; אידמפוטנטי; מזהה חיבורים חסרים.
- `tenant_integrations.shared_from_integration_id` — שדה קיים לשיתוף אינטגרציות בין tenants.
- `clients` (contact_name/email/phone, meta_ads_account_id, google_ads_account_id),
  `client_contacts` (is_primary), `social_pages` (client_id),
  `social_media_wordpress_sites` (client_id).
- `profiles` (חיפוש משתמש לפי אימייל), `invitation_tokens`.

## פערים שצריך לבנות
1. אין טבלאות שיתוף ל-`social_pages` ו-`social_media_wordpress_sites` בין ארגונים.
2. אין flow שמשתמש ב-`shared_from_integration_id` (כולל RLS שמאפשר לארגון היעד לקרוא את ה-token מהמקור).
3. אין קישור אוטומטי איש-קשר → משתמש מערכת.
4. אין נקודות כניסה ב-UI.

---

## שלב 0 — מיגרציות DB (Supabase, פרויקט `zvoijyneresvkadpprel`)
- טבלה חדשה `social_pages_shared_tenants`:
  `id, social_page_id (FK), tenant_id (FK), shared_by, shared_at, UNIQUE(social_page_id, tenant_id)`.
- טבלה חדשה `wordpress_sites_shared_tenants`:
  `id, site_id (FK), tenant_id (FK), shared_by, shared_at, UNIQUE(site_id, tenant_id)`.
- מדיניות RLS:
  - חברי tenant היעד יכולים `SELECT` על `social_pages` / `social_media_wordpress_sites`
    שמשותפים אליהם דרך הטבלאות הנ"ל.
  - `tenant_integrations`: שורת mirror בארגון היעד עם `shared_from_integration_id`
    שמצביעה למקור; helper/VIEW שמושך את ה-`api_key`/`settings` מהמקור כשהשדה מאוכלס,
    כך שרענון token במקור משפיע מיד על היעד.
- אינדקסים על עמודות ה-FK + ה-tenant_id.

## שלב 1 — Edge Function חדשה `create-org-for-client`
קלט: `{ client_id, template_id?, share_llm?: boolean, clone_carmen?: boolean=true }`

זרימה (אטומית, עם rollback בכשל חלקי):
1. אימות הרשאות (super_admin / owner של ה-tenant המקור).
2. טעינת הלקוח (שם, איש קשר, אימייל, טלפון, ads accounts, tenant_id מקור).
3. יצירת הארגון (refactor של הלוגיקה מ-`create-tenant-with-owner` ל-helper משותף):
   שם הארגון = שם הלקוח; org_type לפי היררכיית המקור; החלת `template_id` אם נמסר.
4. **בעלים**: חיפוש `profiles` לפי אימייל איש הקשר →
   אם קיים: הוספה ל-`tenant_users`+`user_roles` כ-owner;
   אחרת: יצירת `invitation_tokens` (owner, כל ההרשאות) + שליחת הזמנה.
5. **שיתוף חיבורים** (הפניה משותפת, idempotent עם onConflict):
   - `tenant_integrations` (facebook_lead_ads, google_ads, וכו') → שורות mirror עם `shared_from_integration_id`.
   - `social_pages` של הלקוח → רשומות ב-`social_pages_shared_tenants`.
   - `social_media_wordpress_sites` של הלקוח → רשומות ב-`wordpress_sites_shared_tenants`.
   - ads accounts (meta/google) → מועתקים לרשומת הלקוח/הגדרות הארגון החדש.
   - LLM → רק אם `share_llm=true` (mirror של שורת ה-llm).
6. **כרמן + אוטומציות + pipelines**: קריאה ל-`clone-entity-to-tenant` לכל סוג ישות.
7. החזרת סיכום: `{ tenant, owner_status, invited_email?, shared: {pages, sites, integrations}, warnings[] }`.

## שלב 2 — Frontend
- קומפוננטה `CreateOrgForClientDialog.tsx`:
  - שדות: template (אופציונלי), toggle "שתף חיבורי LLM", toggle "צור כרמן + אוטומציות" (דלוק כברירת מחדל).
  - תצוגה מקדימה של מה ישותף (כמות עמודים/אתרים/אינטגרציות) ושל איש הקשר שיהפוך ל-owner.
  - קריאה ל-edge function והצגת סיכום תוצאה + קישור הזמנה אם נוצר.
- נקודות כניסה: כפתור בכותרת תצוגת הצ'אט של הלקוח + פעולה בשורת הטבלה/כרטיס.

## שלב 3 — בדיקות והשקה
- מיגרציות דרך `apply_migration`.
- פריסת ה-edge function דרך `deploy-edge-function.yml`.
- בדיקה ידנית על לקוח לדוגמה: יצירת ארגון, אימות owner/הזמנה, אימות שהחיבורים
  נראים בארגון החדש, אימות כרמן/אוטומציות.

## סיכונים ונקודות פתוחות
- **RLS להפניה משותפת** הוא הסיכון המרכזי — צריך בדיקה קפדנית שארגון היעד רואה רק
  את מה ששותף אליו ולא יותר.
- **רמת שיתוף**: שיתוף ברמת tenant (דרך junction לפי tenant_id) פשוט יותר מאשר
  יצירת רשומת לקוח-מראה בארגון החדש. ברירת המחדל בתכנית: שיתוף ברמת tenant.
- **אידמפוטנטיות**: הרצה חוזרת לא תיצור כפילויות (onConflict).
- היקף: בינוני-גדול. נוגע בסכמת פרודקשן ובאדג' פונקציות — דורש אישור לפני ביצוע.

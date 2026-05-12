## הבעיה שמדווחת
ב-DMM:
1. במודול "צוות" (Campaigners → תצוגת Chat) לא רואים אף קמפיינר — לא של DMM ולא של DMM-MC המשותפת.
2. בדף Users לא רואים אף משתמש, למרות שאתה Super Admin + Owner של DMM.

## מה שמצאתי בבדיקה
- המיגרציה האחרונה (`20260512043846`) הוסיפה רק policy SELECT permissive חדש (`View campaigners linked to cross-tenant agencies`). היא לא יכולה להעלים נתונים — רק להוסיף.
- Policies קיימים ב-`campaigners` כוללים `is_super_admin(...) OR tenant_id = get_user_tenant_id(...)` — שניהם אמורים לתת לך גישה מלאה.
- בדקתי ב-DB: ל-DMM (`6ad8f321...`) יש 8 קמפיינרים, `allow_super_admin_access=true`, ו-`user_active_tenant` שלך מצביע על DMM. סוכנות DMM-MC משותפת ל-DMM דרך `agency_tenant_access` עם 16 קמפיינרים מקושרים.
- הסרתי `.eq("tenant_id", tenantId)` מהשאילתות ב-`Campaigners.tsx` ו-`CampaignersChatView.tsx`. כעת RLS אמור להחזיר כל מה שהמשתמש רואה — ולסופר-אדמין זה כל הקמפיינרים בכל ה-tenants.
- דף Users לא נגעתי בו במיגרציה הזו — הבעיה שם כנראה לא קשורה ל-RLS של campaigners.

## חשד עיקרי
מאחר שהמיגרציה רק מוסיפה policy permissive, האפס בקמפיינרים כנראה נובע מ:
1. **Race condition** ב-TenantContext — `tenantId` נשאר `null` בעת ה-fetch ולכן ה-query בכלל לא רץ (רואים `enabled: !!tenantId`).
2. או — ה-query מצליח אבל סינון `selectedAgency` ב-`AgencyContext` נשאר ממצב קודם וחותך הכל.
3. עבור Users — סביר שמדובר בבעיה שלא קשורה למיגרציה (אולי `tenant_users` RLS, או tenantId לא סונכרן).

## תוכנית

### שלב 1 — אבחון בלייב (ללא שינוי קוד)
- אפעיל logging זמני / אבדוק network ב-preview ב-DMM כדי לוודא:
  - מה ה-`tenantId` ש-`useCurrentTenant` מחזיר
  - האם ה-query של campaigners חוזר עם 0 שורות או עם error
  - האם ה-query של profiles/tenant_users ב-Users חוזר ריק
- אריץ `SELECT` כסופר-אדמין (`auth.uid()='bcd21d1c...'`) דרך `supabase.read_query` עם `SET ROLE` כדי לראות מה RLS מחזיר בפועל.

### שלב 2 — תיקון על בסיס האבחון
תרחישים אפשריים והפתרון לכל אחד:

**א. אם `tenantId` ריק/לא מסונכרן ל-DMM:**
- אוסיף guard ב-Campaigners/Users שממתין ל-`isActiveTenantSynced` (כבר קיים ב-`useCurrentTenant`) לפני ה-fetch.

**ב. אם `selectedAgency` נתקע מארגון אחר:**
- אאפס את `selectedAgency` ל-`"all"` כשה-`tenantId` משתנה ב-`AgencyContext`.

**ג. אם RLS לא מחזיר נתונים אפילו לסופר-אדמין:**
- אבדוק האם `user_active_tenant` שלך באמת DMM באותו רגע.
- אם לא — יש בעיה ב-`get_user_tenant_id`/סינכרון ה-active tenant שצריך תיקון.

**ד. אם ה-policy החדש גורם לכשל בשאילתה (timeout/recursion):**
- אסיר אותה ואחליף ב-security definer function שמחזירה `campaigner_id[]` נגישים cross-tenant (כמו `get_cross_tenant_campaigner_ids` שכבר קיים).

### שלב 3 — שחזור ה-filter המפורש כ-fallback
- אם RLS מסבך — אחזיר את `.eq("tenant_id", tenantId)` ובמקביל אוסיף UNION ב-frontend: query נפרד ל-cross-tenant campaigners דרך `campaigner_agencies` + `agency_tenant_access`. זה מבטיח שאין רגרסיה ל-DMM עצמו.

### שלב 4 — אימות
- ב-DMM: ודא שרואים 8 קמפיינרים של DMM + 11 קמפיינרים של DMM-MC.
- ב-Users: ודא שרואים את כל המשתמשים של DMM.
- ב-MarketingCaptain: ודא שלא נשברה הראייה הקיימת.

## הערה
אני צריך הרשאה להריץ את שלב האבחון (קריאת queries ובדיקת state חי). אאשר את הסיבה לפני שאני נוגע בקוד או ב-RLS.

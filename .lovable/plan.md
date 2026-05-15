
# בעיית צפייה בדוחות SEO — פליקס (owner של dmm)

## ממצאי בדיקה

בדקתי את הצד הבאקאנד לעומק עבור פליקס (`dmm4business@gmail.com`, user_id `953a18d4-…495858`) — **אין שום בעיית הרשאות במסד הנתונים**:

| בדיקה | תוצאה |
|---|---|
| `user_roles` | `owner` של tenant `dmm` ✅ |
| `tenant_users` | משויך ל-`dmm` ✅ |
| `user_active_tenant` | `dmm` ✅ |
| `get_user_tenant_id(felix)` | `6ad8f321-…` (dmm) ✅ |
| `has_role(felix,'owner')` | `true` ✅ |
| `is_super_admin(felix)` | `false` (מצופה) |
| `user_is_restricted_client_viewer(felix)` | `false` ✅ |
| `user_can_access_crm_table(felix, SEO table)` | `true` ✅ |
| `user_can_access_client(felix, client)` | `true` ✅ |
| RLS על `crm_tables` / `ahrefs_reports` / `clients` | מאפשר ✅ |
| נתונים בפועל | קיימים 2 דוחות Ahrefs ב-`dmm` ל-`tavnicol.co.il` |

המסקנה: **לא חסרה הרשאה**. הדוחות אמורים להיטען. המסך הריק שפליקס רואה אינו נובע מ-RLS.

## גורם אפשרי בצד פרונט

הדף `DynamicTableView` תלוי בשרשרת:
1. `useCurrentTenant()` → `tenantId`
2. `useQuery('crm-tables')` → קריאה ל-edge function `crm-tables` עם JWT
3. שיוך `tables.find(t => t.slug === slug)` → `table`
4. אם `!table` עדיין מחזיר skeletons (אין הודעת "לא נמצא")

נקודות כשל אפשריות שיגרמו ל"מסך ריק" אצל פליקס דווקא:
- ה-edge function `crm-tables` נכשל בסשן שלו (למשל JWT פג תוקף, או שגיאת רשת) — הקוד פשוט מציג skeletons לנצח.
- `useCurrentTenant()` מחזיר `tenantId=null` (race condition עם resolve של tenant מה-URL `/t/dmm`) ואז `enabled=false` על הקריאות.
- Cache ישן ב-localStorage/queryClient של דפדפן פליקס ספציפית.

## תוכנית

### שלב 1 — איסוף סימן ברור מסשן פליקס
לבקש מפליקס:
1. לפתוח DevTools → Console + Network ולעלות לכתובת `/t/dmm/table/seo-tavnicol-co-il-1776855136192`.
2. לשלוח צילום של:
   - שגיאות באדום בקונסול
   - הסטטוס וגוף התשובה של הקריאה ל-`functions/v1/crm-tables`
   - הסטטוס של קריאה ל-`ahrefs_reports` ב-Network (אם קיימת)
3. לרענן עם **Hard Reload** (Ctrl+Shift+R) ועם פרופיל גלישה בסתר — לשלול cache.

### שלב 2 — קשיחות פרונט (להיעשות בעת המעבר ל-build)
ב-`src/pages/DynamicTableView.tsx`:
- כש-`tablesLoading=false` ו-`!table` → להציג הודעה ברורה: *"הטבלה לא נמצאה או שאין לך הרשאה לצפות בה"* + כפתור חזרה. כיום פשוט נשארים skeletons → בעיני המשתמש "מסך ריק".
- להוסיף `console.error` עם פירוט במקרה ש-`useQuery('crm-tables')` נכשל (כיום השגיאה נבלעת בשקט).

ב-`src/components/dynamic-tables/SeoDashboardView.tsx`:
- כשהקריאה ל-`ahrefs_reports` מחזירה ריק (`reports.length === 0`) להציג כרטיס "אין דוחות זמינים — לחץ לסנכרון Ahrefs" במקום סקלטונים.

ב-`src/contexts/TenantContext.tsx`:
- אם `tenantSlug` מה-URL לא נפתר תוך X שניות, להציג הודעת שגיאה במקום להישאר במצב טעינה.

### שלב 3 — ניקוי תיאורטי בסשן של פליקס
אם ההודעות יזוהו כ-stale auth/cache — לבקש Sign out + Sign in לרענן את ה-JWT ואת ה-cache של React Query.

## הערה טכנית

הבדיקה הראתה שאין אף `tenant_integrations` מסוג Google/Ahrefs ב-tenant `dmm`. זה לא מסביר את המסך הריק (כי דוחות Ahrefs נשמרים ב-`ahrefs_reports` ולא דורשים integration row), אך כדאי לעלות אותו במקביל אם פליקס מצפה ל-GSC/GA — אלה מחייבים חיבור OAuth ייעודי.

---

מאחר שלא נמצא ב-DB שום חוסר-הרשאה, הצעד הראשון ההכרחי הוא לאסוף את שגיאות הדפדפן/Network של פליקס. לאחר מכן אטפל בהקשחת הפרונט לפי הממצאים. אשמח לאישור להתקדם, או — אם יש לך כבר צילום מסך של הקונסול שלו — לצרף אותו ואקפוץ ישר לתיקון.

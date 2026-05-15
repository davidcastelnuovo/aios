## מטרה
לוודא שקמפיינרים שנכנסים לדשבורד סוכנות (או דשבורד ארגון) רואים רק את הלקוחות שמשויכים אליהם דרך `client_team`, בעוד בעלים/מנהלים/super_admin ממשיכים לראות את כל לקוחות הסוכנות.

## ממצאים
- `src/components/dynamic-tables/AgencyDashboardContent.tsx` שולף את הלקוחות עם `.from('clients').eq('agency_id', agencyId).eq('status', 'active')` בשתי קוורי (שורות 314 ו-332) — **אין שום סינון לפי קמפיינר**.
- שאר הקוורי בקובץ (communication_logs, מטריקות, וכו׳) מסתמכות על `clientIds` שמחושב מהלקוחות שנשלפו, אז ברגע שמסננים את הרשימה הראשית — כל השאר מסתנן אוטומטית.
- התבנית הנכונה כבר קיימת ב-`src/pages/DynamicTables.tsx` (שורות 117–130): שימוש ב-`useUserRole` כדי לזהות `isCampaigner` + `campaignerId`, ושאילתה ל-`client_team` עבור `client_id` המשויכים.
- `useUserRole` כבר טוען `campaignerId` באופן עצל כשהתפקיד הוא קמפיינר.

## שינויים בקוד
**קובץ יחיד:** `src/components/dynamic-tables/AgencyDashboardContent.tsx`

1. ייבוא `useUserRole` בראש הקובץ.
2. בתוך `AgencyDashboardContent`:
   - לשלוף `{ isCampaigner, isOwner, isTeamManager, isSuperAdmin, campaignerId } = useUserRole()`.
   - להגדיר `isRestrictedCampaigner = isCampaigner && !isOwner && !isTeamManager && !isSuperAdmin`.
   - להוסיף `useQuery` חדש `assignedClientIds` שטוען מ-`client_team` את ה-`client_id` של אותו `campaignerId`, מופעל רק כש-`isRestrictedCampaigner === true`.
3. לעדכן את שתי שאילתות ה-`clients`:
   - להוסיף ל-`queryKey` את `assignedClientIds` (כדי שתשתנה כשהרשימה נטענת).
   - להוסיף `enabled: !!agencyId && (!isRestrictedCampaigner || !!assignedClientIds)` כדי לא לרוץ לפני שהרשימה זמינה.
   - בתוך הקוורי, אם `isRestrictedCampaigner`: אם הרשימה ריקה — `return []`; אחרת להוסיף `.in('id', assignedClientIds)` לפני ה-await.

## התנהגות צפויה
- **Owner / Team Manager / Super Admin** — ממשיכים לראות את כל לקוחות הסוכנות (ללא שינוי).
- **Campaigner** — רואה רק את הלקוחות שהוא משויך אליהם דרך `client_team`. אם אין שיוכים, הטבלאות (CRM ו-Performance) יציגו רשימה ריקה.
- **Sales person / SEO** — לא משתנה (ההגבלה היא ספציפית ל-`isCampaigner`).

## מה לא משתנה
- אין שינויי DB / RLS — RLS על `clients` כבר מאפשר לקמפיינר לקרוא, וההגבלה היא רק UI כדי שלא יראה לקוחות שלא משויכים אליו.
- אין שינוי ב-`DashboardView` או ב-`CreateDashboardDialog`.

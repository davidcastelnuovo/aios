

## סנכרון מלא בין משתמשים (profiles) לאנשי צוות (campaigners)

### הבעיה (אילנית)
- למשתמש: `email=ilanitfinkelberg@gmail.com`, `full_name=אילנית פינקלברג`.
- לקמפיינר המקושר: `full_name=אילנית`, `email=NULL`, `phone=972528202963`.
- ה-`campaigner_id` בפרופיל מקושר נכון, אבל **שדות הפרופיל (אימייל/שם) מעולם לא הועתקו לכרטיס הקמפיינר** — לכן בכרטיס איש הצוות מוצג "אימייל: —".

הסיבה השורשית: זרימות היצירה/עריכה של המשתמש משאירות לפעמים את שדות הקמפיינר ריקים, ועריכת שם משתמש (`EditUserNameDialog`) או שיוך משתמש ↔ קמפיינר קיים אינם משכפלים את הנתונים לכיוון השני.

### העיקרון: One-time backfill + סנכרון דו-כיווני קל

#### 1. Backfill חד-פעמי (Migration)
עבור כל קמפיינר שמקושר לפרופיל (קיים `profiles.campaigner_id`):
- אם `campaigners.email` ריק/NULL → להעתיק מ-`profiles.email`.
- אם `campaigners.full_name` ריק או שווה לחלק מהשם בפרופיל → לעדכן ל-`profiles.full_name` (אם קיים ואינו ריק).
- אותו עיקרון ל-`sales_people` עם `profiles.sales_person_id`.

זה יתקן מיידית את אילנית וכל הקמפיינרים שכבר קיימים.

#### 2. סנכרון בעת שיוך משתמש → קמפיינר קיים
ב-`EditUserCampaignerDialog` (וגם בשורת ה-Select המהיר ב-`Users.tsx`, וב-`manage-user-roles` edge function כשמתבצע "reuse existing"):
- בעת שמירת `profiles.campaigner_id = X`, מיד אחרי השמירה: לעדכן את הקמפיינר X — אם `email` ריק אז `email = profile.email`, ואם `full_name` ריק/לא תואם, להציע (או למלא) מה-profile.
- בנוסף: לוודא שהקמפיינר נמצא תחת אותו `tenant_id` של המשתמש.

#### 3. סנכרון בעת יצירת קמפיינר חדש מתוך משתמש
`useAutoCreateTeamMember.createCampaigner` כבר מקבל `email/fullName` — נוודא שהוא תמיד שולח אותם (כיום יש fallback של `profile.email || "קמפיינר"` ב-edge function אבל ב-`createCampaigner` ב-hook זה נשלח כפי שהוא). נשאיר כפי שהוא — תקין.

#### 4. סנכרון בעת עדכון פרטי קמפיינר
ב-`EditCampaignerDialog` וב-עריכה inline ב-`CampaignersChatView` (שדות email/full_name):
- אחרי עדכון `campaigners.email`/`full_name`, אם לקמפיינר קיים פרופיל מקושר (`profiles.campaigner_id = campaigner.id`) — להציע סנכרון לכיוון הפרופיל **רק כאשר הפרופיל ריק** (אם הפרופיל כבר מלא, לא לדרוס. נשאיר את ה-Auth כמקור אמת לאימייל ההתחברות).
- בפועל הסנכרון לכיוון `profiles.email` הוא חד-כיווני בלבד: profile → campaigner. לכיוון השני נסנכרן רק `full_name` כשהפרופיל ריק.

#### 5. סנכרון בעת עדכון שם משתמש
ב-`EditUserNameDialog`: אחרי שמירת `profiles.full_name`, אם יש `campaigner_id` או `sales_person_id` מקושר — לעדכן את השם בקמפיינר/איש מכירות **רק אם הוא ריק או זהה לקודם** (לא לדרוס שם שערך מנהל ידנית).

### מה לא משתנה (חשוב לאי-רגרסיה)
- **RLS, הרשאות, תפקידים (`user_roles`)** — ללא שינוי.
- **`user_managed_agencies`, `campaigner_agencies`, `sales_person_agencies`** — ללא שינוי בלוגיקת השיוך.
- **`update-user-agencies` edge function** — ללא שינוי.
- **`manage-user-roles`** — נוסיף שם רק את העתקת ה-email בעת reuse של קמפיינר קיים (שורה 243-246), כי כיום הוא משתמש בקמפיינר קיים ללא לוודא שיש לו אימייל.
- אין שינוי במחיקת תפקידים/משתמשים, אין שינוי במסכי לקוחות/לידים/משימות.
- שום שינוי במבנה טבלאות — רק עדכוני נתונים.

### קבצים שיתעדכנו
1. **Migration חדש** — backfill של email/full_name ב-campaigners ו-sales_people מתוך profiles המקושרים.
2. `src/hooks/useAutoCreateTeamMember.ts` — אין שינוי לוגי, אבל נוודא שגם reuse של קמפיינר קיים מסנכרן אימייל אם חסר (להעביר ל-hook עזר חדש `syncProfileToTeamMember`).
3. `src/hooks/useSyncProfileTeamMember.ts` — **חדש**: helper שמקבל `userId` ומסנכרן profile ↔ campaigner/sales_person.
4. `src/components/forms/EditUserCampaignerDialog.tsx` — קריאה ל-helper אחרי `handleSave` כשבחרו קמפיינר קיים.
5. `src/components/forms/EditUserSalesPersonDialog.tsx` — אותו דבר עבור sales_person.
6. `src/components/forms/EditUserNameDialog.tsx` — אחרי עדכון השם, סנכרון לקמפיינר/איש מכירות אם ריק/זהה.
7. `src/pages/Users.tsx` — בתוך `updateCampaignerMutation` ו-`updateSalesPersonMutation`, קריאה ל-helper אחרי השמירה.
8. `src/components/campaigners/CampaignersChatView.tsx` — בעריכת inline של email/full_name, סנכרון חזרה לפרופיל המקושר רק אם ריק.
9. `supabase/functions/manage-user-roles/index.ts` — בנקודת reuse (שורות 242-246, 148-151), אם הקמפיינר/איש המכירות קיים אבל בלי email — לעדכן עם `profile.email`.

### בדיקות
1. רענון מסך הצוות → לאילנית מופיע אימייל `ilanitfinkelberg@gmail.com` ושם מלא "אילנית פינקלברג" (או נשמר השם הקצר אם נבחר).
2. יצירת משתמש חדש עם תפקיד "קמפיינר" → נוצר קמפיינר אוטומטית עם email + full_name של המשתמש.
3. שיוך משתמש קיים לקמפיינר קיים שלא היה לו אימייל → אחרי שמירה האימייל מתעדכן בקמפיינר.
4. עריכת שם משתמש ב-`EditUserNameDialog` → השם בקמפיינר מתעדכן (אם היה ריק או זהה לישן).
5. עריכת אימייל בכרטיס איש הצוות → לא נדרס ה-email בפרופיל (כי email בפרופיל מולא).
6. הרשאות, סוכנויות ותפקידים — ללא שינוי. EditUserAgenciesDialog ממשיך לעבוד באופן זהה.
7. אין רגרסיה במסכי לקוחות/לידים/משימות (לא נוגעים בלוגיקה הזו).


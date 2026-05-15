## הוספת סוג דשבורד "ארגון"

הוספת אפשרות שלישית "דשבורד ארגון" שמאחד את כל הסוכנויות של הארגון (כולל סוכנויות משותפות cross-tenant), עם בורר סוכנות פנימי בתוך הדשבורד עצמו.

### שינויים

**1. מסד נתונים** (`supabase/migrations/`)
- עדכון constraint על `crm_dashboards.dashboard_type` כך שיכלול גם `'organization'` (כיום מוגבל ל-`client`/`agency` בלבד).
- הפיכת `agency_id` ל-nullable עבור דשבורדי ארגון (אם עדיין NOT NULL).

**2. דיאלוג יצירה** (`src/components/dynamic-tables/CreateDashboardDialog.tsx`)
- הוספת אופציה שלישית ב-RadioGroup: "דשבורד ארגון" (אייקון Building2 כפול / Network).
- כשנבחר `organization`: מסתירים את בורר הסוכנות, לא דורשים `agency_id`.
- ב-insert: שומרים `dashboard_type='organization'`, `agency_id=null`, `client_id=null`.
- תצוגת preview: "X סוכנויות בארגון, Y לקוחות סה"כ" (סופר את כל הסוכנויות + לקוחות בעזרת `useCrossTenantAgencyIds`).

**3. תצוגת הדשבורד** (`src/pages/DashboardView.tsx`)
- זיהוי `isOrganizationDashboard = dashboard_type === 'organization'`.
- כש-organization: רינדור Header חדש עם `Select` של כל הסוכנויות (own + shared cross-tenant) + אופציית "כל הסוכנויות".
- ה-state המקומי `selectedAgencyId` מועבר ל-`AgencyDashboardContent` במקום `dashboard.agency_id`.
- ברירת מחדל: סוכנות ראשונה ברשימה (או "כל הסוכנויות" אם נתמך).

**4. AgencyDashboardContent** (`src/components/dynamic-tables/AgencyDashboardContent.tsx`)
- אם נדרש לתמוך ב-"כל הסוכנויות": החלפת `.eq('agency_id', agencyId)` ב-`.in('agency_id', agencyIds)` כש-`agencyId === null`.
- אחרת — אין שינוי (מקבל agency_id רגיל מה-Header).

### שאלה לפני יישום

- בבחירת "כל הסוכנויות" בתוך דשבורד הארגון — האם לאחד את כל הלקוחות מכל הסוכנויות לטבלה אחת ארוכה, או להציג ברירת מחדל סוכנות ראשונה ולחייב בחירה?

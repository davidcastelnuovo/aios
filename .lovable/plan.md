

## תוכנית תיקון גורף — נראות לקוחות חוצת-ארגונים (Cross-Tenant)

### הבעיה
לאחר העלאה מחדש של לקוחות DMM מתוך הארגון שלהם, ה-`tenant_id` של הלקוחות הוא של DMM ולא של MarketingCaptain. מודולים רבים מסננים לקוחות לפי `tenant_id` בלבד, ולכן לקוחות DMM לא מופיעים למרות שהסוכנויות DMM-MC ו-DMM-LTD משותפות.

### עיקרון הפתרון
בכל מקום שמושכים לקוחות עם `.eq("tenant_id", tenantId)`, צריך לשלב גם סוכנויות משותפות מטבלת `agency_tenant_access` — בדיוק כפי שכבר נעשה ב-`AddTaskForm.tsx` וב-`DMMDashboard.tsx`.

### פתרון טכני — יצירת Hook משותף
יצירת hook מרכזי `useCrossTenantAgencyIds` שימשוך את ה-agency IDs המשותפים פעם אחת, וישמש בכל המודולים.

### רשימת קבצים לתיקון

#### 1. Hook חדש — `src/hooks/useCrossTenantAgencyIds.ts`
- Hook שמושך `agency_tenant_access` לפי `accessing_tenant_id`
- מחזיר מערך של `agency_id` + פונקציית עזר לבניית filter

#### 2. `src/components/tasks/WeeklyTaskBoard.tsx` (שורות 96-108)
- שאילתת `clients-for-task-selector` — מסנן `.eq("tenant_id", tenantId!)` → צריך OR עם cross-tenant agencies

#### 3. `src/components/tasks/TaskDetailDialog.tsx` (שורה 139)
- שאילתת clients — אותו תיקון

#### 4. `src/pages/Dashboard.tsx` (שורות 138-152, 172-178)
- שאילתת clients לפילטר — `.eq("tenant_id", tenantId)` → OR
- שאילתת stats: `clientQuery`, `activeClientsQuery` — OR

#### 5. `src/pages/TeamChat.tsx` (שורות 152-156)
- שאילתת `clients-for-channel` — `.eq("tenant_id", tenantId)` → OR

#### 6. `src/components/chat/LinkFileToEntityDialog.tsx` (שורות 31-34)
- שאילתת `clients-for-link` — OR

#### 7. `src/components/SummarizeRecordingDialog.tsx` (שורות 254-257)
- שאילתת clients — OR

#### 8. `src/components/forms/TestAutomationDialog.tsx` (שורות 94-104)
- שאילתת `clients-for-test` — OR

#### 9. `src/components/forms/EditTaskDialog.tsx` (שורות 193-197)
- שאילתת clients — אין tenant filter כלל (מביא הכל), צריך לוודא שזה בסדר או להוסיף scoping

#### 10. `src/components/forms/EditOnboardingDialog.tsx` (שורות 65-69)
- שאילתת clients — אין tenant filter, צריך scoping + cross-tenant

#### 11. `src/components/forms/AddOnboardingForm.tsx` (שורות 69-73)
- שאילתת clients — מסנן לפי agency בלבד, צריך לוודא שכולל shared agencies

#### 12. `src/components/clients/ClientTasksTab.tsx`
- שאילתת tasks לפי `client_id` — זה בסדר (לא מסנן tenant)

### סדר ביצוע
1. יצירת ה-hook `useCrossTenantAgencyIds`
2. תיקון 10 הקבצים ברשימה — שימוש ב-hook + שינוי filter ל-OR
3. בדיקה שהדשבורד הראשי, משימות, צ'אט, וטפסים מציגים את לקוחות DMM

### סיכום
~10 קבצים לתיקון + hook חדש אחד. הגישה אחידה: במקום `.eq("tenant_id", tenantId)` → `.or("tenant_id.eq.X,agency_id.in.(Y,Z)")`.


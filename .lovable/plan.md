# העברת Facebook למודל פר-משתמש עם שיתוף מבוקר

## מצב היום
- `tenant_integrations` של `facebook_lead_ads` היא רשומה אחת לכל טננט. ל-MarketingCaptain יש את החיבור המקורי שלך (`user_id=שלך`), ול-7 ארגונים אחרים (כולל DMM) יש Mirror דרך `shared_from_integration_id`.
- אין לקמפיינרים אפשרות להוסיף חיבור Facebook אישי משלהם.
- לא ניתן לבחור איזה קמפיינר רואה את החיבור המשותף.

## המטרה
זהה ל-Google Ads:
1. **חיבור פר-משתמש**: כל קמפיינר יכול לחבר את הפייסבוק שלו ולראות את חשבונות המודעות שלו.
2. **שיתוף מבוקר**: בעלי חיבור (כולל המשותף שלך מ-MarketingCaptain) קובעים אילו משתמשים בארגון מקבלים גישת צפייה אליו.
3. **בורר חיבור**: קמפיינר עם גישה רואה גם את החיבור שלו וגם חיבורים משותפים, ובוחר באיזה להשתמש.

## שינויים

### 1. סכימה
- אין צורך בטבלה חדשה: כבר קיימת `integration_user_permissions` (לפי המוזיקרון `Integration Permissions RLS`).
- וידוא שב-`tenant_integrations` עמודת `user_id` נשמרת כבעלים של הרשומה (היא כבר קיימת ומשמשת ב-Google).
- מיגרציה: עדכון מדיניות RLS על `tenant_integrations` כך ש-SELECT עבור `facebook_lead_ads`/`facebook_capi` יחזיר:
  - רשומות שבהן `user_id = auth.uid()` (חיבור אישי), **או**
  - רשומות שיש להן שורה ב-`integration_user_permissions` עבור המשתמש הנוכחי (חיבור משותף אליו), **או**
  - super_admin.
  - שימוש בפונקציית `SECURITY DEFINER` קיימת/חדשה כדי למנוע recursion.

### 2. Hook חדש: `useFacebookIntegrations`
מקביל ל-`useUserIntegrations`. מחזיר מערך של חיבורים הזמינים למשתמש הנוכחי בארגון, עם דגל `is_own`/`is_shared` ושם הבעלים.

### 3. דף `FacebookSettings.tsx`
- **רשימת חיבורים** במקום `maybeSingle()` - מציג את כל החיבורים הזמינים (אישי + משותפים), עם בורר.
- כפתור "חבר את הפייסבוק שלי" - מבצע OAuth ויוצר רשומה חדשה עם `user_id = auth.uid()` (לא דורס את החיבור המשותף).
- לכל חיבור שאני בעליו: כפתור "ניהול שיתוף" שפותח דיאלוג בחירת משתמשים בארגון (לפי `tenant_users`) שמקבלים גישת צפייה - upsert/delete ב-`integration_user_permissions`.

### 4. Mirror Sharing קיים בין ארגונים
- נשמר כפי שהוא. החיבור המקורי שלך ב-MarketingCaptain ממשיך להופיע ב-DMM כ-Mirror, ומופיע בבורר עבור כל מי שיש לו `integration_user_permissions` עליו (או עבורך כבעלים).
- אם קמפיינר ב-DMM מחבר Facebook משלו - נוצרת רשומה חדשה עם `tenant_id=DMM`, `user_id=הקמפיינר`, 
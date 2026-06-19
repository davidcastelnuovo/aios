## הבעיה

מהצילום: כרמן מבצעת בדיקת דופק וכותבת "לא זוהה כרגע נתון קמפיינים" לכל לקוח. בדקתי את `ai-support-chat` ומצאתי שלושה כשלים שגורמים בדיוק לזה:

### 1. `analyze_campaign_performance` — פילטר קמפיינים שגוי
היום הקוד מחפש טבלאות עם:
```ts
.ilike('slug', '%facebook%')
```
זה מפספס:
- `integration_type = 'google_ads'` (טבלאות Google Ads)
- `integration_type = 'meta_ads'` (קמפיינים מ-Meta החדשים)
- `facebook_ecommerce`
- כל טבלה ש-slug שלה לא מכיל "facebook" (למשל "מטא-לקוח-X")

לכן רוב הלקוחות חוזרים ללא רשומות → "לא זוהה נתון".

### 2. אין תמיכה ב-cross-tenant
גם `list_clients` וגם `analyze_campaign_performance` מסננים רק `eq('tenant_id', tenantId)`. לקוחות של סוכנות DMM שמשותפת בין tenants דרך `agency_tenant_access` — הקמפיינים שלהם יושבים ב-`crm_tables` של ה-tenant המקור (לרוב MarketingCaptain), והשאילתה מסתכלת רק על ה-tenant הפעיל. זה גם הסיבה שהיא "לא רואה" קמפיינים אצל לקוחות DMM.

### 3. אין סקופינג לפי תפקיד
ה-Memory של הפרויקט מגדיר: campaigner→לקוחות active/onboarding שלו בלבד; team_manager→סוכנויות מנוהלות; owner/super_admin→כל ה-tenant + cross-tenant. בפועל `list_clients` מחזיר את כל ה-tenant ללא הבחנה. כדי שכרמן "באמת תעבור על כל הלקוחות" ותדע להבדיל סוכנויות/הרשאות — צריך להחיל סקופינג מובנה.

---

## מה אתקן

### A. `analyze_campaign_performance` (supabase/functions/ai-support-chat/index.ts ~1441)
- להחליף את `.ilike('slug', '%facebook%')` ב:
  ```ts
  .in('integration_type', ['facebook_insights','facebook_ecommerce','meta_ads','google_ads'])
  ```
- להרחיב את שליפת הטבלאות לכל ה-tenants הנגישים (ה-tenant הפעיל + כל ה-`source_tenant_id` מ-`agency_tenant_access` עבור ה-tenant הזה).
- בעת איסוף `crm_records`, לסנן לפי `table_id` (כבר מוגן ב-RLS), לא לפי `tenant_id`, כדי לתפוס נתונים cross-tenant.
- לטפל בשמות שדות מנורמלים: לחלק מהאינטגרציות `spend`/`leads`, לאחרות `cost_micros`/`conversions` (Google Ads). למפות לשדה אחיד לפני החישוב.

### B. `list_clients` (~750)
- להוסיף resolve של רשימת agency_ids משותפים מ-`agency_tenant_access` (כפי שעושה `useCrossTenantAgencyIds`).
- לבנות `OR` filter: `tenant_id.eq.${tenantId},agency_id.in.(${sharedAgencyIds})`.
- כך DMM תופיע במלואה בכל בדיקת דופק.

### C. סקופינג לפי תפקיד (helper משותף)
פונקציה `resolveCarmenScope(supabase, userId, tenantId)` שמחזירה:
- `role`: super_admin / owner / agency_owner / agency_manager / team_manager / campaigner
- `clientFilter`: או `null` (= כל ה-tenant + cross-tenant) או `{ campaigner_id }` או `{ agency_ids: [...] }`
- שימוש ב-`user_managed_agencies` עבור team_manager ו-`campaigner_agencies` עבור campaigner.

`list_clients` ו-`analyze_campaign_performance` יקבלו את הסקופ אוטומטית. campaigner יראה רק לקוחות active/onboarding שלו (תואם ל-Memory).

### D. פלט בדיקת דופק (system prompt)
לחזק את ההנחיה הקיימת:
- חובה להריץ `analyze_campaign_performance` לפני סיכום.
- חובה לדווח בדיוק כמה לקוחות נסרקו (count מ-`list_clients`) ולא להמציא "עברתי על כולם".
- שורה אחת לכל לקוח, משפט אחד.
- אם רשימה > 5 לקוחות — חובה `delegate_to_background` (כבר קיים בכלל אבל צריך לחזק בהודעת המערכת לבדיקת דופק).

---

## טכני קצר

קבצים שישונו:
- `supabase/functions/ai-support-chat/index.ts` — פילטר integration_type, cross-tenant tenants, סקופינג לפי תפקיד, חיזוק system prompt לבדיקת דופק.

ללא שינויי DB, ללא שינויי RLS — RLS כבר מאפשרת cross-tenant דרך agency_tenant_access; הקוד פשוט לא ניצל את זה.

מאשרת? אריץ את כל התיקונים בקובץ אחד.
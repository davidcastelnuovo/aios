# תוכנית: שיתוף אוטומציות כ-Mirror אמיתי

## הבעיה היום
ה-`clone-automation-to-tenant` יוצר **עותק עצמאי** של האוטומציה בכל טננט יעד (`source_automation_id` רק מצביע לאב). כל clone הוא רשומה נפרדת ב-`automations` עם trigger משלו, ולכן:
- אוטומציית "התרעה לקמפיינר על משימה" רצה פעם ב-MC ופעם ב-DMM
- קמפיינר משותף (דרך `campaigner_agencies`) מקבל **שתי הודעות** על אותה משימה לוגית
- כל עריכה צריכה להיעשות N פעמים בטננטים השונים

## הפתרון: Reference אמיתי
אוטומציה אחת בלבד (במקור), טריגר אחד, ביצוע אחד. שאר הטננטים מקבלים **שיקוף read-only** ברשימה שלהם.

---

## שלב 1: סכמת DB

**טבלה חדשה: `automation_shared_tenants`**
```
automation_id  uuid  → automations.id (CASCADE delete)
tenant_id      uuid  → tenants.id (טננט שהאוטומציה משותפת איתו)
shared_by      uuid  → המשתמש ששיתף
shared_at      timestamptz
PRIMARY KEY (automation_id, tenant_id)
```
- GRANTs לפי הסטנדרט; RLS: SELECT לחברי הטננט/המקור, INSERT/DELETE רק לבעלים/אדמין של טננט המקור.
- אינדקס על `tenant_id` לשליפות מהירות בצד הטננט-היעד.

**שינוי קיים:** משאירים את העמודות `source_automation_id` ו-`source_tenant_id` ב-`automations` רק עד שמיגרציית הנתונים תרוץ — בסיומה הן יוסרו או יוותרו ריקות (clones יומרו).

---

## שלב 2: מיגרציית נתונים (לפי בחירת המשתמש - אוטומטי)

לכל שורה ב-`automations` עם `source_automation_id IS NOT NULL`:
1. אם האב (`source_automation_id`) עדיין קיים → INSERT ל-`automation_shared_tenants(automation_id=source, tenant_id=clone.tenant_id)`.
2. מחיקת ה-clone (מחיקת `automation_flow_steps` שלו כתוצאה מ-CASCADE).
3. אם האב נמחק בעבר → log אזהרה, להשאיר את ה-clone כעצמאי (לא לאבד את האוטומציה של המשתמש).

הכל ב-migration אחד עם transaction.

---

## שלב 3: שינוי `clone-automation-to-tenant`

לשנות שם פונקציונלי ל-`share-automation-to-tenant`:
- במקום לעשות `insert` של אוטומציה + steps, רק `insert` ל-`automation_shared_tenants`.
- בדיקות הרשאה נשארות זהות (owner/admin/super_admin של טננט המקור + חברות בטננט יעד).
- מחזיר רשימת tenants ששותפו בהצלחה.
- ההסבר ב-UI: "האוטומציה תרוץ בטננט המקור ותהיה צפייה בלבד בטננטים א
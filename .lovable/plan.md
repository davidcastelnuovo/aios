# תיקון: אביעד לא רואה את הלקוחות המשויכים אליו ב-DMM

## סיבת השורש
ל-`user_roles` של אביעד יש שורה אחת בלבד: `role='campaigner'` עם `tenant_id = NULL`.

ה-RLS על clients משתמש ב-`has_role(uid, 'campaigner')`, וה-function דורש שהשורה ב-`user_roles` תכיל `tenant_id = get_user_tenant_id(uid)`. כש-`tenant_id` הוא NULL, `has_role` מחזירה `false` → המדיניות *"Campaigners view assigned clients"* לא נכנסת לתוקף → אביעד לא רואה אף לקוח, למרות ש-`client_team` מקשר אותו ל-10 לקוחות ב-DMM.

זאת בדיוק החריגה מ-Core rule: *"All `user_roles` (except `super_admin`) must have a non-null `tenant_id`"*. בדקתי — הוא היחיד עם תקלה כזו.

## תיקון
INSERT/UPDATE לטבלת `user_roles`:
- לעדכן את השורה של אביעד (`user_id=360c03dd...`, `role='campaigner'`) ולקבוע `tenant_id=6ad8f321-25db-4a04-8e44-e57a7c8961b2` (DMM, ה-active tenant שלו).

זה ייעשה דרך `insert` tool (data change, לא migration).

## אימות
- להריץ שוב `has_role` ולוודא `true`.
- לוודא שאביעד רואה את 10 הלקוחות ב-`/t/dmm/clients`.

## הערה
אין צורך בשינוי קוד או RLS — רק תיקון דאטה.

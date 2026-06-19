## דילוג על התראת אוטומציה כשהמשתמש משייך משימה לעצמו

### מה קורה היום
ה-trigger `trg_notify_task_assigned` (ב-`public.tasks`) שולח לכל שיוך של `campaigner_id` קריאה ל-`trigger-automation` עם `trigger_type='task_assigned'`. זה רץ גם כשמשתמש מכניס משימה לעצמו, ולכן הוא מקבל וואטסאפ של "התראה למשימה" על משימה שהוא בעצמו רק עכשיו יצר.

### השינוי
מיגרציה אחת שמחליפה את הפונקציה `public.notify_task_assigned`. בתחילתה, מיד אחרי בדיקות ה-NULL/NO-CHANGE הקיימות, נוסיף בדיקה:

```
v_actor_user_id := COALESCE(auth.uid(), NEW.created_by);
IF v_actor_user_id IS NOT NULL THEN
  v_actor_campaigner_id := public.get_user_campaigner_id(v_actor_user_id);
  IF v_actor_campaigner_id IS NOT NULL
     AND v_actor_campaigner_id = NEW.campaigner_id THEN
    RETURN NEW;  -- שיוך עצמי: לא שולחים התראה
  END IF;
END IF;
```

הסבר:
- `auth.uid()` הוא המשתמש הפעיל. ב-INSERT שמגיע מה-CRM הוא תואם ל-`created_by` (שכבר מוגדר default ל-`auth.uid()`).
- ב-UPDATE של `campaigner_id` ע"י קמפיינר על משימה של עצמו — `auth.uid()` יחזיר אותו, ולכן השיוך ייחשב עצמי.
- `get_user_campaigner_id` כבר קיים במערכת (מתועד בכמה מיגרציות RLS) — ממפה user_id → campaigner_id.
- super_admin/owner שמשייך לעצמו לא קמפיינר → `get_user_campaigner_id` יחזיר NULL → לא נחשב שיוך עצמי, וההתראה תרוץ כרגיל. אם תרצה שגם הם לא יקבלו התראה על שיוך לעצמם, נוסיף השוואה גם דרך `(SELECT user_id FROM campaigners WHERE id = NEW.campaigner_id) = v_actor_user_id` — תגיד אם אתה רוצה שזה יכוסה.

### מה לא משתנה
- שיוך מ-Carmen, מאוטומציות, או מאדמין שמשייך לקמפיינר אחר — ימשיך לטרגר את ההתראה כרגיל.
- ה-trigger עצמו (`AFTER INSERT OR UPDATE OF campaigner_id`) נשאר.
- הלוגיקה ב-`trigger-automation` לא משתנה.

### קובץ שיתעדכן
- מיגרציה חדשה שמחליפה את `public.notify_task_assigned()` (CREATE OR REPLACE FUNCTION).

### אימות
1. כניסה כמשתמש קמפיינר, יצירת משימה ושיוך לעצמו → אין התראה.
2. אדמין משייך משימה לקמפיינר אחר → ההתראה נשלחת.
3. שינוי `campaigner_id` של משימה קיימת מקמפיינר אחד למשתמש הפעיל עצמו → אין התראה.


# תוכנית: יצירה אוטומטית של איש מכירות ושיוך תפקיד

## הבעיה

כשמגדירים משתמש כ-"איש מכירות" במערכת, לא קורים אוטומטית:
1. יצירת רשומת `sales_people` בבסיס הנתונים
2. קישור הרשומה לפרופיל המשתמש (`profiles.sales_person_id`)
3. הוספת תפקיד `sales_person` לטבלת `user_roles`

כתוצאה מכך, המשתמש לא רואה את הלידים שמשויכים אליו.

---

## הפתרון המוצע

### שלב 1: יצירת Trigger חדש - `handle_sales_person_assignment`

בדומה ל-trigger הקיים ל-campaigner, ניצור trigger שמוסיף אוטומטית את תפקיד `sales_person` כשמקשרים `sales_person_id` לפרופיל:

```text
כש-profiles.sales_person_id מתעדכן:
  ├── אם הוגדר sales_person_id חדש:
  │   └── הוסף תפקיד 'sales_person' לטבלת user_roles
  └── אם sales_person_id הוסר:
      └── הסר את תפקיד 'sales_person' מטבלת user_roles
```

### שלב 2: עדכון טופס הזמנת משתמש חדש

בעת הזמנת משתמש עם תפקיד `sales_person`:
- אם לא נבחר איש מכירות קיים, נציע אפשרות ליצור אחד חדש אוטומטית
- או: נוסיף לוגיקה ב-Edge Function `invite-user` שתיצור רשומת `sales_people` אם התפקיד הוא `sales_person` ולא נבחר `salesPersonId`

### שלב 3: שיפור תהליך העריכה הקיים

הדיאלוג `EditUserSalesPersonDialog` כבר תומך ביצירת איש מכירות חדש ושיוך - נוודא שה-trigger החדש יטפל בהוספת התפקיד אוטומטית.

---

## שינויים נדרשים

| רכיב | שינוי |
|------|-------|
| מיגרציית SQL | יצירת פונקציה `handle_sales_person_assignment` ו-Trigger מתאים |
| `invite-user/index.ts` | (אופציונלי) יצירת `sales_people` אוטומטית אם התפקיד הוא `sales_person` |
| `Users.tsx` | שיפור UX להזמנת איש מכירות עם אפשרות יצירה אוטומטית |

---

## פרטים טכניים

### מיגרציית SQL - יצירת הפונקציה וה-Trigger

```sql
-- פונקציה לטיפול בשיוך sales_person
CREATE OR REPLACE FUNCTION public.handle_sales_person_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Get user's tenant_id
  SELECT tenant_id INTO v_tenant_id
  FROM public.tenant_users
  WHERE user_id = NEW.id
  LIMIT 1;

  -- If sales_person_id was just set
  IF NEW.sales_person_id IS NOT NULL AND 
     (OLD.sales_person_id IS NULL OR OLD.sales_person_id != NEW.sales_person_id) THEN
    -- Add sales_person role if it doesn't exist
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (NEW.id, 'sales_person', v_tenant_id)
    ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
  END IF;
  
  -- If sales_person_id was removed
  IF NEW.sales_person_id IS NULL AND OLD.sales_person_id IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = NEW.id 
      AND role = 'sales_person' 
      AND tenant_id = v_tenant_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Trigger לטבלת profiles
CREATE TRIGGER on_sales_person_assignment 
  AFTER UPDATE OF sales_person_id ON public.profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION handle_sales_person_assignment();
```

### עדכון Edge Function - יצירה אוטומטית (אופציונלי)

ב-`invite-user`, אם התפקיד הוא `sales_person` ולא נבחר `salesPersonId`:
1. יצירת רשומת `sales_people` חדשה עם שם המשתמש
2. קישור לסוכנויות שנבחרו
3. עדכון `profiles.sales_person_id`

---

## תוצאה צפויה

לאחר השינויים:
- שיוך `sales_person_id` לפרופיל יוסיף אוטומטית את התפקיד
- אנשי מכירות חדשים יוכלו לראות את הלידים שלהם מיד אחרי השיוך
- לא יהיה צורך בעדכונים ידניים בבסיס הנתונים

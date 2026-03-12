

## הבעיה שזוהתה

המשימות שנוצרות דרך הליד "Ariel Boton" לא מופיעות כי יש **טריגר בבסיס הנתונים** (`set_task_tenant_id`) שדורס את ה-tenant_id שהקוד מגדיר.

### מה קורה:
1. הקוד מכניס משימה עם `tenant_id = marketingcaptain` (הטנאנט הנוכחי)
2. הטריגר `set_task_tenant_id` רואה שיש `agency_id` ומחליף את ה-`tenant_id` ל-tenant של הסוכנות (Bull)
3. לוח המשימות מסנן לפי `tenant_id = marketingcaptain` ← המשימות לא מוצגות

### הסוכנות "Bull" שייכת לטנאנט אחר (`bull`), אבל הליד נגיש מ-`marketingcaptain` דרך שיתוף סוכנויות בין טנאנטים.

## התיקון המוצע

עדכון הטריגר `set_task_tenant_id` כך שידרוס את ה-`tenant_id` **רק אם לא הוגדר ערך** (NULL). אם הקוד כבר קבע tenant_id, הטריגר לא יתערב.

```sql
CREATE OR REPLACE FUNCTION public.set_task_tenant_id()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Only set tenant_id if not already provided
  IF NEW.tenant_id IS NULL THEN
    IF NEW.client_id IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id FROM public.clients WHERE id = NEW.client_id;
    ELSIF NEW.agency_id IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id FROM public.agencies WHERE id = NEW.agency_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

בנוסף, נתקן את 2 המשימות הקיימות שנשמרו עם tenant_id שגוי:
```sql
UPDATE tasks 
SET tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'
WHERE id IN ('9b7b406d-7e88-413f-ac44-83c0235a4abf', '98246876-8328-42f3-8cec-cd162c6359d0');
```

### סיכום שינויים
- **מיגרציה אחת**: תיקון הטריגר + עדכון 2 המשימות הקיימות
- **ללא שינויי קוד** - הקוד כבר שולח את ה-tenant_id הנכון


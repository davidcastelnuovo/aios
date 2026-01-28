
# תוכנית לתיקון בעיית הגישה ללידים עבור Team Managers

## הבעיה שזוהתה
המשתמש `aviiadco@gmail.com` לא רואה לידים למרות שיש לו:
- תפקיד `team_manager` בארגון marlog-leads
- ניהול סוכנות "marlog-leads"
- הרשאה `leads: true` בטבלת user_permissions

**שורש הבעיה:** מדיניות ה-RLS "Team managers view leads from managed agencies" משתמשת בפונקציה `get_effective_tenant_id()` שלא פועלת נכון בהקשר של RLS.

## תנאי RLS הנוכחי (לא עובד):
```text
has_role(auth.uid(), 'team_manager')
AND agency_id IS NOT NULL
AND user_manages_agency(auth.uid(), agency_id)
AND (tenant_id = get_effective_tenant_id() OR user_has_cross_tenant_agency_access(...))
```

## הפתרון
החלפת `get_effective_tenant_id()` ב-`get_user_tenant_id(auth.uid())` במדיניות ה-RLS.

## שלבי הביצוע

### שלב 1: עדכון מדיניות RLS על טבלת leads
מיגרציה של מסד הנתונים שתבצע:

```sql
-- Drop the existing policy
DROP POLICY IF EXISTS "Team managers view leads from managed agencies" ON public.leads;

-- Create new policy with corrected tenant check
CREATE POLICY "Team managers view leads from managed agencies"
ON public.leads
FOR SELECT
TO public
USING (
  has_role(auth.uid(), 'team_manager'::app_role)
  AND (
    -- Leads in user's active tenant
    tenant_id = get_user_tenant_id(auth.uid())
    OR
    -- Leads in agencies the user manages
    (agency_id IS NOT NULL AND user_manages_agency(auth.uid(), agency_id))
    OR
    -- Cross-tenant agency access
    (agency_id IS NOT NULL AND user_has_cross_tenant_agency_access(auth.uid(), agency_id))
  )
);
```

### שלב 2: בדיקה
לאחר הפעלת המיגרציה, המשתמש `aviiadco@gmail.com` יוכל לראות את כל הלידים בארגון marlog-leads.

## פרטים טכניים

### ההבדל בין הפונקציות:
| פונקציה | פרמטרים | שימוש |
|---------|----------|-------|
| `get_effective_tenant_id()` | ללא | משתמשת ב-`auth.uid()` פנימית - בעייתית |
| `get_user_tenant_id(user_id)` | user_id | מקבלת את ה-user_id כפרמטר - עובדת נכון |

### המדיניות המתוקנת:
- מאפשרת ל-team_managers לראות לידים בארגון הפעיל שלהם
- מאפשרת גישה ללידים מסוכנויות שהם מנהלים
- תומכת בגישה בין-ארגונית לסוכנויות משותפות

---

## השפעה צפויה
לאחר התיקון, המשתמש `aviiadco@gmail.com` יראה את 3 הלידים בארגון marlog-leads.

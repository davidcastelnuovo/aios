

## בעיות האבטחה שנמצאו ואיך לתקן

### הבעיה המרכזית

שתי הבעיות שהסורק מצא נובעות מאותו דבר: **policies עם `roles: {public}`** — כלומר, גם משתמשים **לא מחוברים** (anonymous) יכולים לקרוא נתונים.

### 1. טבלת `profiles` — כבר מתוקנת ✓
כל ה-SELECT policies כבר מוגדרות ל-`TO authenticated`. הסורק עדיין מדווח כי יש policy אחת ישנה (`Service role can insert profiles`) עם `roles: {public}`, אבל זו INSERT ולא SELECT — היא הכרחית ל-trigger של יצירת משתמש ולא מהווה סיכון אמיתי.

**לא נדרש שינוי בטבלת profiles.**

### 2. טבלת `leads` — דורשת תיקון ⚠️
5 מתוך 8 policies מוגדרות עם `roles: {public}` במקום `{authenticated}`:

| Policy | פעולה | בעיה |
|--------|-------|------|
| Owners view all leads in tenant | SELECT | `public` |
| Sales people view assigned leads | SELECT | `public` |
| Super admins can view leads with permission | SELECT | `public` |
| Super admins view leads with permission | SELECT | `public` (כפולה!) |
| Team managers view leads from managed agencies | SELECT | `public` |
| Users can create leads in their tenants | INSERT | `public` |
| Users can update leads in their tenants | UPDATE | `public` |
| Super admins can manage leads with permission | ALL | `public` |

בפועל, ה-RLS מגן כי כולן דורשות `auth.uid()`, אבל Best Practice הוא לציין `TO authenticated` כדי לחסום anonymous requests ברמת הפוליסי.

### התיקון

מיגרציה אחת שתעשה:
1. **מחיקת ה-policy הכפולה** (`Super admins view leads with permission` — קיימת פעמיים)
2. **שחזור כל 7 ה-policies הנותרות** עם `TO authenticated` במקום `public`

### פרטים טכניים

```sql
-- Drop all leads policies and recreate with TO authenticated
DROP POLICY IF EXISTS "Owners view all leads in tenant" ON leads;
DROP POLICY IF EXISTS "Sales people view assigned leads" ON leads;
DROP POLICY IF EXISTS "Super admins can view leads with permission" ON leads;
DROP POLICY IF EXISTS "Super admins view leads with permission" ON leads;
DROP POLICY IF EXISTS "Team managers view leads from managed agencies" ON leads;
DROP POLICY IF EXISTS "Users can create leads in their tenants" ON leads;
DROP POLICY IF EXISTS "Users can update leads in their tenants" ON leads;
DROP POLICY IF EXISTS "Super admins can manage leads with permission" ON leads;

-- Recreate each with same logic but TO authenticated
```

כל ה-USING clauses יישארו בדיוק אותו דבר — רק ה-`TO` ישתנה ל-`authenticated`.

**שינוי זה לא ישבור שום דבר** כי כל הפוליסיות כבר דורשות `auth.uid()` — פשוט מוסיפים שכבת הגנה נוספת.


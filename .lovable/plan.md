

# חקירת שורש הבעיה: למה הדאטה-בייס לא זמין

## ממצאים

### הבעיה המרכזית: Sequential Scans מסיביים על טבלאות קטנות

הנתונים מהדאטה-בייס חושפים את שורש הבעיה. שלוש טבלאות קטנות מאוד (25-53 שורות) סופגות מיליוני סריקות:

```text
Table                  | Rows | Seq Scans     | Idx Scans
-----------------------|------|---------------|----------
user_active_tenant     |   25 | 51,566,372    |    31,309
user_roles             |   53 | 42,907,208    | 62,062,015
tenant_users           |   42 |  6,629,581    |   725,339
profiles               |   31 |  7,832,830    |    55,938
tenants                |   11 |  2,173,079    | 3,671,005
```

### מה גורם לזה?

**כל שאילתת RLS** מפעילה את הפונקציות `get_user_tenant_id()`, `is_super_admin()`, ו-`has_role()`. כל אחת מהן סורקת את `user_active_tenant` ו-`user_roles`. 

**כל פעולה** על כל טבלה (leads, tasks, agencies, clients...) מטריגרת RLS שקורא לפונקציות האלה. כש-Postgres מחשב RLS, הוא קורא את `user_active_tenant` עשרות פעמים **לכל שאילתה בודדת** (פעם לכל שורה שנבדקת + פעם לכל policy). בגלל שהטבלאות קטנות, Postgres בוחר sequential scan במקום index scan.

כש-Green API שולח webhooks בתדירות גבוהה (ראינו שזה קורה כל כמה שניות) + ה-frontend מרענן נתונים + token refresh + cron jobs -- כולם ביחד יוצרים **connection contention** שגורם ל-timeouts.

### למה ה-timeouts?
1. הדאטה-בייס חווה **עומס I/O** מסריקות חוזרות על אותן טבלאות
2. **5 חיבורים "idle in transaction (aborted)"** נמצאו תפוסים -- אלה חוסמים חיבורים חדשים
3. **שאילתת metadata ענקית** (Lovable's own introspection query) רצה 53 שניות (!) ותפסה חיבור
4. Connection pool (ברירת מחדל ~20 חיבורים) נגמר, וכל בקשה חדשה ממתינה -> timeout

## הפתרון

### 1. הוספת אינדקסים חכמים לפונקציות RLS (שינוי מיגרציה)
הבעיה העיקרית: `user_active_tenant` נסרקת sequentially 51 מיליון פעם. צריך לוודא שהפונקציות `SECURITY DEFINER` משתמשות באינדקסים:

```sql
-- Force index usage in the critical RLS helper functions
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT tenant_id FROM public.user_active_tenant WHERE user_id = _user_id
  UNION ALL
  SELECT tenant_id FROM public.tenant_users WHERE user_id = _user_id LIMIT 1
  LIMIT 1;
$$;
```

**ולהוסיף ANALYZE** כדי לעדכן סטטיסטיקות:
```sql
ANALYZE public.user_active_tenant;
ANALYZE public.user_roles;
ANALYZE public.tenant_users;
ANALYZE public.profiles;
```

### 2. ביטול חיבורים "idle in transaction (aborted)" (שינוי מיגרציה)
```sql
-- Set idle_in_transaction_session_timeout to kill stuck connections
ALTER ROLE authenticator SET idle_in_transaction_session_timeout = '30s';
```

### 3. הקטנת שאילתות מיותרות מה-Frontend (שינוי קוד)
- ב-`TenantContext.tsx`: הפונקציה `syncTenantToDb` מבטלת **כל** ה-queries ומריצה invalidation על כל cache key בכל מעבר tenant -- זה מייצר burst של שאילתות חדשות
- ב-`useUserRole.ts`: שאילתות `campaigner_id` ו-`salesPersonAgencyIds` רצות לכל משתמש גם אם הוא לא קמפיינר/איש מכירות
- ב-`useUserPermissions.ts`: realtime subscription פתוח תמיד, מוסיף עומס חיבורים

### 4. צמצום Webhook load מ-Green API
ראינו שהוובהוק של Green API מקבל הודעות כל כמה שניות ונכשל ב-timeout -- כל webhook פותח חיבור DB חדש.

## תוכנית ביצוע

**שלב 1 - מיגרציה (הכי קריטי):**
- ANALYZE על הטבלאות הקריטיות
- הגדרת `idle_in_transaction_session_timeout`
- אופטימיזציית הפונקציה `get_user_tenant_id` להשתמש ב-`UNION ALL` + `LIMIT 1` במקום `COALESCE` (מאפשר ל-Postgres לעצור מוקדם)

**שלב 2 - קוד Frontend:**
- ב-`TenantContext.tsx`: להפוך את ה-upsert ל-`user_active_tenant` ל-fire-and-forget (לא חוסם UI)
- ב-`useUserRole.ts`: להפוך שאילתות `campaigner_id` ו-`salesPersonAgencyIds` ל-lazy (רק כשהמשתמש באמת קמפיינר/איש מכירות)
- להקטין את ה-burst של invalidation ב-`syncTenantToDb`

**שלב 3 - Green API webhook:**
- הוספת early-return ב-webhook כש-DB לא זמין (לא לנסות שוב ושוב)


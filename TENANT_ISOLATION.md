# Tenant Isolation - מסמך אבטחה

## סקירה כללית
המערכת מיושמת כ-SaaS multi-tenant עם בידוד מלא בין ארגונים.

## ארכיטקטורה

### 1. Tenant Context
- כל משתמש שייך לארגון אחד בלבד (tenant_users table)
- המערכת משתמשת ב-TenantProvider לניהול הארגון הנוכחי
- Super admins יכולים לצפות בכל הארגונים אבל לא לשנות נתונים בין ארגונים

### 2. Row Level Security (RLS)
כל טבלה בעלת נתונים משותפת את המבנה הבא:
```sql
tenant_id uuid REFERENCES tenants(id)
```

#### RLS Policies
כל טבלה עם tenant_id חייבת להכיל מדיניות RLS:
```sql
CREATE POLICY "Users can view data in their tenant"
ON table_name
FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
);
```

### 3. פונקציות בסיס נתונים

#### get_user_tenant_id
מחזירה את ה-tenant_id של המשתמש:
```sql
SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1
```

#### get_effective_tenant_id
מחזירה את ה-tenant הפעיל כרגע (לעתיד: תמיכה במעבר בין tenants ל-super admin)

#### is_super_admin
בודקת אם המשתמש הוא super admin

### 4. טבלאות עם בידוד Tenant

הטבלאות הבאות **חייבות** להיות מסוננות לפי tenant_id:

- ✅ agencies
- ✅ clients  
- ✅ leads
- ✅ campaigners
- ✅ sales_people
- ✅ suppliers
- ✅ tasks
- ✅ client_onboarding
- ✅ finance
- ✅ products
- ✅ automations
- ✅ time_entries
- ✅ import_history

### 5. טבלאות גלובליות (ללא tenant_id)

- user_roles - הרשאות משתמש
- tenant_users - חיבור משתמשים לארגונים
- tenants - רשימת ארגונים
- profiles - פרופילים (קישור ל-auth.users)

## כללי אבטחה

### ✅ דברים שחייבים להתקיים:

1. **כל שורה חדשה חייבת לכלול tenant_id**
   ```typescript
   await supabase.from('clients').insert({
     name: 'Client Name',
     tenant_id: userTenantId, // חובה!
     ...
   });
   ```

2. **כל query SELECT חייב לסנן לפי tenant_id** (למעט super admins)
   ```typescript
   const { data } = await supabase
     .from('clients')
     .select('*')
     .eq('tenant_id', currentTenantId); // RLS יוסיף גם סינון
   ```

3. **ארגון חדש מתחיל ריק**
   - אין העתקת נתונים מארגון אחר
   - כל ה-IDs חדשים
   - אין גישה לנתוני ארגונים אחרים

### ❌ דברים אסורים:

1. **לעולם אל תעקוף RLS policies** באמצעות service role key מהצד לקוח
2. **אל תשתמש ב-localStorage לאימות** - רק לשמירת העדפות UI
3. **אל תסמוך על auth.uid() בלבד** - תמיד השתמש גם ב-tenant_id
4. **אל תאפשר queries ללא סינון tenant_id** (למעט טבלאות גלובליות)

## בדיקת אבטחה

### כיצד לוודא בידוד נכון:

1. **הפעל את ה-linter**:
   ```bash
   supabase db lint
   ```

2. **בדוק RLS policies**:
   ```sql
   SELECT schemaname, tablename, policyname
   FROM pg_policies
   WHERE tablename NOT IN ('user_roles', 'tenant_users', 'profiles', 'tenants');
   ```

3. **בדוק שכל הטבלאות עם tenant_id מסוננות**:
   ```sql
   SELECT table_name 
   FROM information_schema.columns 
   WHERE column_name = 'tenant_id' 
   AND table_schema = 'public';
   ```

## יצירת ארגון חדש

כשיוצרים ארגון חדש:
1. נוצר record ב-`tenants` table
2. נוצר invitation token לבעלים
3. הבעלים מתווסף ל-`tenant_users` 
4. הארגון החדש ריק לגמרי - אין בו לקוחות, קמפיינרים, וכו'
5. הבעלים יכול להזמין משתמשים נוספים לארגון

## Super Admin

Super admin יכול:
- ✅ לצפות בכל הארגונים
- ✅ ליצור ארגונים חדשים
- ✅ לנהל משתמשים
- ❌ **לא יכול לשנות נתונים בין ארגונים** (RLS מונע)

## תחזוקה שוטפת

### כשמוסיפים טבלה חדשה:

1. **הוסף עמודת tenant_id**:
   ```sql
   ALTER TABLE new_table ADD COLUMN tenant_id uuid REFERENCES tenants(id);
   ```

2. **הוסף RLS policies**:
   ```sql
   ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Users can view in their tenant"
   ON new_table FOR SELECT
   USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
   ```

3. **עדכן את המסמך הזה** ✓

## סיכום

המערכת מיושמת עם **בידוד מלא** בין ארגונים:
- כל נתון משויך לארגון ספציפי
- RLS מבטיח שמשתמשים רואים רק את הנתונים של הארגון שלהם
- ארגון חדש מתחיל תמיד ריק
- אין דליפת נתונים בין ארגונים

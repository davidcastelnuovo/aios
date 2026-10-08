-- חיזוק RLS של טבלת profiles - שינוי מ-public ל-authenticated בלבד

-- מחיקת policies קיימות
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- יצירה מחדש עם authenticated בלבד
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can view profiles in their tenant" ON profiles
  FOR SELECT TO authenticated
  USING (id IN (
    SELECT tu1.user_id FROM tenant_users tu1
    WHERE tu1.tenant_id IN (
      SELECT tu2.tenant_id FROM tenant_users tu2
      WHERE tu2.user_id = auth.uid()
    )
  ));

CREATE POLICY "Super admins can view all profiles" ON profiles
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
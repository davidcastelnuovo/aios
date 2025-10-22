-- Drop ALL existing policies from all tables
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Create simple policies for all tables - authenticated users can do everything
CREATE POLICY "Authenticated users can view agencies" ON agencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert agencies" ON agencies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update agencies" ON agencies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete agencies" ON agencies FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view clients" ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clients" ON clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clients" ON clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete clients" ON clients FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view client_onboarding" ON client_onboarding FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert client_onboarding" ON client_onboarding FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update client_onboarding" ON client_onboarding FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete client_onboarding" ON client_onboarding FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view campaigners" ON campaigners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert campaigners" ON campaigners FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update campaigners" ON campaigners FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete campaigners" ON campaigners FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view campaigner_agencies" ON campaigner_agencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert campaigner_agencies" ON campaigner_agencies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update campaigner_agencies" ON campaigner_agencies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete campaigner_agencies" ON campaigner_agencies FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view client_team" ON client_team FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert client_team" ON client_team FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update client_team" ON client_team FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete client_team" ON client_team FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view client_suppliers" ON client_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert client_suppliers" ON client_suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update client_suppliers" ON client_suppliers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete client_suppliers" ON client_suppliers FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view finance" ON finance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert finance" ON finance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update finance" ON finance FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete finance" ON finance FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view suppliers" ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert suppliers" ON suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update suppliers" ON suppliers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete suppliers" ON suppliers FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view tasks" ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert tasks" ON tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tasks" ON tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete tasks" ON tasks FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update profiles" ON profiles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete profiles" ON profiles FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view time_entries" ON time_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert time_entries" ON time_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update time_entries" ON time_entries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete time_entries" ON time_entries FOR DELETE TO authenticated USING (true);
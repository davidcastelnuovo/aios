-- INCIDENT FIX: zoom_recordings had RLS ENABLED but ZERO policies in prod —
-- the tenant-scoped policies from 20260305104631 were dropped out-of-band at
-- some point, which silently blocked ALL authenticated reads/writes
-- ("recordings disappeared", extension inserts failing with RLS violations).
-- This restores the exact documented policies from 20260305104631.

DROP POLICY IF EXISTS "Users can view zoom recordings in their tenant" ON zoom_recordings;
DROP POLICY IF EXISTS "Users can insert zoom recordings in their tenant" ON zoom_recordings;
DROP POLICY IF EXISTS "Users can update zoom recordings in their tenant" ON zoom_recordings;
DROP POLICY IF EXISTS "Users can delete zoom recordings in their tenant" ON zoom_recordings;

CREATE POLICY "Users can view zoom recordings in their tenant" ON zoom_recordings
  FOR SELECT USING (
    tenant_id = get_user_tenant_id(auth.uid())
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Users can insert zoom recordings in their tenant" ON zoom_recordings
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Users can update zoom recordings in their tenant" ON zoom_recordings
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id(auth.uid())
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Users can delete zoom recordings in their tenant" ON zoom_recordings
  FOR DELETE USING (
    tenant_id = get_user_tenant_id(auth.uid())
    OR is_super_admin(auth.uid())
  );


-- ========================================
-- SIMPLIFY TASKS RLS WITH HELPER FUNCTION
-- ========================================

-- Create helper function to check if user can access an agency
CREATE OR REPLACE FUNCTION public.can_access_agency(_user_id uuid, _agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Super admin
    is_super_admin(_user_id)
    OR
    -- Agency is in user's tenant
    EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = _agency_id
      AND a.tenant_id = get_user_tenant_id(_user_id)
    )
    OR
    -- Agency is shared with user's tenant
    EXISTS (
      SELECT 1 FROM agency_tenant_access ata
      WHERE ata.agency_id = _agency_id
      AND ata.accessing_tenant_id = get_user_tenant_id(_user_id)
    )
$$;

-- Drop and recreate simplified SELECT policy for tasks
DROP POLICY IF EXISTS "Users can view tasks from accessible agencies" ON public.tasks;

CREATE POLICY "Users can view tasks from accessible agencies"
ON public.tasks FOR SELECT
USING (
  is_super_admin(auth.uid())
  OR
  can_access_agency(auth.uid(), agency_id)
);

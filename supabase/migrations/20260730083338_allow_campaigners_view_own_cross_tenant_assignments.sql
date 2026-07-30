-- A restricted campaigner must be able to read every assignment that belongs
-- to their own campaigner record, including assignments to clients owned by a
-- different tenant through a shared agency. Client visibility remains governed
-- separately by the clients RLS policies.
CREATE POLICY "Campaigners can view own client_team assignments"
ON public.client_team
FOR SELECT
TO authenticated
USING (
  has_role((SELECT auth.uid()), 'campaigner'::app_role)
  AND campaigner_id = get_user_campaigner_id((SELECT auth.uid()))
);

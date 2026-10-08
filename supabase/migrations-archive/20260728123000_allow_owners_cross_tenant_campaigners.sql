-- Owners and team managers who can access a client through a shared agency
-- must also be able to read the campaigner assigned to that client.
DROP POLICY IF EXISTS "Team managers and owners can view cross-tenant campaigners on their client"
  ON public.campaigners;

DROP POLICY IF EXISTS "Team managers can view cross-tenant campaigners on their client"
  ON public.campaigners;

CREATE POLICY "Team managers and owners can view cross-tenant campaigners on their client"
  ON public.campaigners
  FOR SELECT
  TO authenticated
  USING (
    (
      public.has_role((SELECT auth.uid()), 'team_manager'::public.app_role)
      OR public.has_role((SELECT auth.uid()), 'owner'::public.app_role)
    )
    AND id = ANY (
      COALESCE(
        public.get_cross_tenant_campaigner_ids((SELECT auth.uid())),
        ARRAY[]::uuid[]
      )
    )
  );

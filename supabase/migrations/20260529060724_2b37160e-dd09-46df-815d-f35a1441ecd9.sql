
CREATE TABLE IF NOT EXISTS public.automation_shared_tenants (
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shared_by uuid,
  shared_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (automation_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_ast_tenant ON public.automation_shared_tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ast_automation ON public.automation_shared_tenants(automation_id);

GRANT SELECT, INSERT, DELETE ON public.automation_shared_tenants TO authenticated;
GRANT ALL ON public.automation_shared_tenants TO service_role;

ALTER TABLE public.automation_shared_tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ast_select_members"
ON public.automation_shared_tenants
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid() AND tu.tenant_id = automation_shared_tenants.tenant_id
  )
  OR EXISTS (
    SELECT 1 FROM public.automations a
    JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
    WHERE a.id = automation_shared_tenants.automation_id AND tu.user_id = auth.uid()
  )
);

CREATE POLICY "ast_insert_source_admin"
ON public.automation_shared_tenants
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.automations a
    JOIN public.user_roles ur ON ur.tenant_id = a.tenant_id AND ur.user_id = auth.uid()
    WHERE a.id = automation_shared_tenants.automation_id
      AND ur.role IN ('owner'::app_role, 'team_manager'::app_role, 'agency_owner'::app_role)
  )
);

CREATE POLICY "ast_delete_source_admin"
ON public.automation_shared_tenants
FOR DELETE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.automations a
    JOIN public.user_roles ur ON ur.tenant_id = a.tenant_id AND ur.user_id = auth.uid()
    WHERE a.id = automation_shared_tenants.automation_id
      AND ur.role IN ('owner'::app_role, 'team_manager'::app_role, 'agency_owner'::app_role)
  )
);

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT clone.id AS clone_id, clone.tenant_id AS clone_tenant,
           src.id AS source_id, src.tenant_id AS source_tenant
    FROM public.automations clone
    JOIN public.automations src ON src.id = clone.source_automation_id
    WHERE clone.source_automation_id IS NOT NULL
  LOOP
    IF c.clone_tenant = c.source_tenant THEN CONTINUE; END IF;

    INSERT INTO public.automation_shared_tenants (automation_id, tenant_id, shared_by, shared_at)
    VALUES (c.source_id, c.clone_tenant, NULL, now())
    ON CONFLICT (automation_id, tenant_id) DO NOTHING;

    DELETE FROM public.automations WHERE id = c.clone_id;
  END LOOP;
END $$;

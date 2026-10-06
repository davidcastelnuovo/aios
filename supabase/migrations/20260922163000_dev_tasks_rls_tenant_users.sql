-- dev_tasks RLS: production uses tenant_users (tenant_members was never deployed).

DO $$
BEGIN
  IF to_regclass('public.dev_tasks') IS NOT NULL THEN
    DROP POLICY IF EXISTS dev_tasks_tenant_rw ON public.dev_tasks;
    CREATE POLICY dev_tasks_tenant_rw ON public.dev_tasks
      FOR ALL
      USING (
        tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid())
      )
      WITH CHECK (
        tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid())
      );
  END IF;
  IF to_regclass('public.dev_task_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS dev_task_events_tenant_read ON public.dev_task_events;
    CREATE POLICY dev_task_events_tenant_read ON public.dev_task_events
      FOR SELECT
      USING (
        tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid())
      );
  END IF;
END $$;

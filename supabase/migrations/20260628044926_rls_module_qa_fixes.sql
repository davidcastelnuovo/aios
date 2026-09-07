-- RLS QA Fixes: campaigner access isolation
-- Fixes:
-- 1. Drop legacy over-permissive policies on clients/agencies
-- 2. Fix tasks UPDATE to restrict campaigners to their own tasks
-- 3. Fix ahrefs_reports SELECT to restrict campaigners to assigned clients
-- 4. Add missing policies for campaign_alerts, campaign_schedules, report_alerts, seo_monthly_updates

---------------------------------------------------------------------------
-- 1. CLIENTS: drop legacy Lovable-era over-permissive policies
---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON public.clients;

---------------------------------------------------------------------------
-- 2. AGENCIES: drop legacy over-permissive policies
---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can update agencies" ON public.agencies;
DROP POLICY IF EXISTS "Authenticated users can delete agencies" ON public.agencies;
DROP POLICY IF EXISTS "Authenticated users can insert agencies" ON public.agencies;

---------------------------------------------------------------------------
-- 3. TASKS UPDATE: restrict campaigners to their own tasks only
---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update tasks in accessible agencies" ON public.tasks;

CREATE POLICY "Users can update tasks in accessible agencies"
  ON public.tasks FOR UPDATE
  USING (
    is_super_admin(auth.uid())
    OR (
      (tenant_id = get_effective_tenant_id())
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
        OR (
          has_role(auth.uid(), 'campaigner'::app_role)
          AND campaigner_id = get_user_campaigner_id(auth.uid())
        )
      )
    )
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR (
      (tenant_id = get_effective_tenant_id())
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
        OR (
          has_role(auth.uid(), 'campaigner'::app_role)
          AND campaigner_id = get_user_campaigner_id(auth.uid())
        )
      )
    )
  );

---------------------------------------------------------------------------
-- 4. AHREFS_REPORTS: restrict campaigners to their assigned clients
---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenant members view ahrefs_reports" ON public.ahrefs_reports;

CREATE POLICY "Tenant members view ahrefs_reports"
  ON public.ahrefs_reports FOR SELECT
  USING (
    is_super_admin(auth.uid())
    OR (
      -- Owners and team managers see all reports in their tenant
      (EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.tenant_id = ahrefs_reports.tenant_id
          AND ur.role IN ('owner', 'team_manager')
      ))
    )
    OR (
      -- Cross-tenant agency access
      agency_id IS NOT NULL
      AND user_has_cross_tenant_agency_access(auth.uid(), agency_id)
    )
    OR (
      -- Campaigners/SEO: only their assigned clients
      (has_role(auth.uid(), 'campaigner'::app_role) OR has_role(auth.uid(), 'seo'::app_role))
      AND client_id IS NOT NULL
      AND client_id = ANY(get_user_client_ids(auth.uid()))
    )
  );

---------------------------------------------------------------------------
-- 5. CAMPAIGN_ALERTS: add missing policies (RLS enabled, zero policies)
---------------------------------------------------------------------------
CREATE POLICY "campaign_alerts_select"
  ON public.campaign_alerts FOR SELECT
  USING (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        -- Owners/managers see all
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
        OR (
          -- Campaigners see only their assigned clients
          has_role(auth.uid(), 'campaigner'::app_role)
          AND client_id IS NOT NULL
          AND client_id = ANY(get_user_client_ids(auth.uid()))
        )
      )
    )
  );

CREATE POLICY "campaign_alerts_write"
  ON public.campaign_alerts FOR INSERT
  WITH CHECK (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
        OR has_role(auth.uid(), 'campaigner'::app_role)
      )
    )
  );

CREATE POLICY "campaign_alerts_update"
  ON public.campaign_alerts FOR UPDATE
  USING (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
        OR (
          has_role(auth.uid(), 'campaigner'::app_role)
          AND client_id IS NOT NULL
          AND client_id = ANY(get_user_client_ids(auth.uid()))
        )
      )
    )
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
        OR (
          has_role(auth.uid(), 'campaigner'::app_role)
          AND client_id IS NOT NULL
          AND client_id = ANY(get_user_client_ids(auth.uid()))
        )
      )
    )
  );

CREATE POLICY "campaign_alerts_delete"
  ON public.campaign_alerts FOR DELETE
  USING (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
      )
    )
  );

---------------------------------------------------------------------------
-- 6. CAMPAIGN_SCHEDULES: add missing policies (RLS enabled, zero policies)
---------------------------------------------------------------------------
CREATE POLICY "campaign_schedules_select"
  ON public.campaign_schedules FOR SELECT
  USING (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
        OR (
          has_role(auth.uid(), 'campaigner'::app_role)
          AND client_id IS NOT NULL
          AND client_id = ANY(get_user_client_ids(auth.uid()))
        )
      )
    )
  );

CREATE POLICY "campaign_schedules_write"
  ON public.campaign_schedules FOR INSERT
  WITH CHECK (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
        OR has_role(auth.uid(), 'campaigner'::app_role)
      )
    )
  );

CREATE POLICY "campaign_schedules_update"
  ON public.campaign_schedules FOR UPDATE
  USING (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
        OR (
          has_role(auth.uid(), 'campaigner'::app_role)
          AND client_id IS NOT NULL
          AND client_id = ANY(get_user_client_ids(auth.uid()))
        )
      )
    )
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
        OR (
          has_role(auth.uid(), 'campaigner'::app_role)
          AND client_id IS NOT NULL
          AND client_id = ANY(get_user_client_ids(auth.uid()))
        )
      )
    )
  );

CREATE POLICY "campaign_schedules_delete"
  ON public.campaign_schedules FOR DELETE
  USING (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
      )
    )
  );

---------------------------------------------------------------------------
-- 7. REPORT_ALERTS: add missing policies (RLS enabled, zero policies)
--    No client_id — scoped by tenant only, owners/managers manage
---------------------------------------------------------------------------
CREATE POLICY "report_alerts_select"
  ON public.report_alerts FOR SELECT
  USING (
    is_super_admin(auth.uid())
    OR tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "report_alerts_write"
  ON public.report_alerts FOR INSERT
  WITH CHECK (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
      )
    )
  );

CREATE POLICY "report_alerts_update"
  ON public.report_alerts FOR UPDATE
  USING (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
      )
    )
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
      )
    )
  );

CREATE POLICY "report_alerts_delete"
  ON public.report_alerts FOR DELETE
  USING (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
      )
    )
  );

---------------------------------------------------------------------------
-- 8. SEO_MONTHLY_UPDATES: add missing policies (RLS enabled, zero policies)
---------------------------------------------------------------------------
CREATE POLICY "seo_monthly_updates_select"
  ON public.seo_monthly_updates FOR SELECT
  USING (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
        OR (
          (has_role(auth.uid(), 'campaigner'::app_role) OR has_role(auth.uid(), 'seo'::app_role))
          AND client_id IS NOT NULL
          AND client_id = ANY(get_user_client_ids(auth.uid()))
        )
      )
    )
  );

CREATE POLICY "seo_monthly_updates_write"
  ON public.seo_monthly_updates FOR INSERT
  WITH CHECK (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
        OR has_role(auth.uid(), 'seo'::app_role)
      )
    )
  );

CREATE POLICY "seo_monthly_updates_update"
  ON public.seo_monthly_updates FOR UPDATE
  USING (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
        OR (
          has_role(auth.uid(), 'seo'::app_role)
          AND client_id IS NOT NULL
          AND client_id = ANY(get_user_client_ids(auth.uid()))
        )
      )
    )
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
        OR (
          has_role(auth.uid(), 'seo'::app_role)
          AND client_id IS NOT NULL
          AND client_id = ANY(get_user_client_ids(auth.uid()))
        )
      )
    )
  );

CREATE POLICY "seo_monthly_updates_delete"
  ON public.seo_monthly_updates FOR DELETE
  USING (
    is_super_admin(auth.uid())
    OR (
      tenant_id = get_effective_tenant_id()
      AND (
        has_role(auth.uid(), 'owner'::app_role)
        OR has_role(auth.uid(), 'team_manager'::app_role)
      )
    )
  );

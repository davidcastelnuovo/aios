-- Fix INSERT RLS policies for all marketing tables — add WITH CHECK so users
-- can only insert rows into tenants they belong to.

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'marketing_pipelines',
    'marketing_pipeline_stages',
    'marketing_work_items',
    'marketing_runs',
    'marketing_assets',
    'marketing_item_transitions',
    'marketing_media_library',
    'marketing_stage_templates',
    'marketing_triggers'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_write', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()))',
      tbl || '_write', tbl
    );
  END LOOP;
END $$;

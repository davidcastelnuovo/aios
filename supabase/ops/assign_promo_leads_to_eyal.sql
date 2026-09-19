-- Promo: assign all leads to Eyal Horn + auto-assign new Facebook leads via form_mappings.
-- Root cause: lead_sales_people junction empty (sales people RLS requires it);
-- facebook_lead_ads form 1669762850892162 had no sales_person_id configured.

DO $$
DECLARE
  v_tenant uuid := '571dbdde-62b9-4c14-b536-30ae7a4fef81';
  v_agency uuid := '13147295-9bdd-49ac-a9d5-4a7bae2f3620';
  v_eyal uuid := 'fcc854d0-f7bf-45cb-9056-376cacc06943';
  v_integration uuid := '0c2681ab-7560-42e0-92f5-fd9d7bad2c0d';
  v_form_id text := '1669762850892162';
  v_updated_leads int;
  v_inserted_junction int;
BEGIN
  UPDATE public.leads
  SET sales_person_id = v_eyal,
      updated_at = now()
  WHERE tenant_id = v_tenant
    AND archived_at IS NULL
    AND (sales_person_id IS DISTINCT FROM v_eyal);
  GET DIAGNOSTICS v_updated_leads = ROW_COUNT;

  INSERT INTO public.lead_sales_people (lead_id, sales_person_id, tenant_id)
  SELECT l.id, v_eyal, l.tenant_id
  FROM public.leads l
  WHERE l.tenant_id = v_tenant
    AND l.archived_at IS NULL
  ON CONFLICT (lead_id, sales_person_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted_junction = ROW_COUNT;

  UPDATE public.tenant_integrations
  SET settings = jsonb_set(
        jsonb_set(
          jsonb_set(
            settings,
            ARRAY['form_mappings', v_form_id, 'sales_person_id'],
            to_jsonb(v_eyal::text),
            true
          ),
          ARRAY['form_mappings', v_form_id, 'sales_person_ids'],
          jsonb_build_array(v_eyal::text),
          true
        ),
        ARRAY['form_mappings', v_form_id, 'agency_id'],
        to_jsonb(v_agency::text),
        true
      ),
      updated_at = now()
  WHERE id = v_integration;

  INSERT INTO public.claude_carmen_audit (actor, action, target, details)
  VALUES (
    'claude',
    'assign_promo_leads_to_sales_person',
    'promo / eyal horn',
    jsonb_build_object(
      'tenant_id', v_tenant,
      'sales_person_id', v_eyal,
      'agency_id', v_agency,
      'facebook_integration_id', v_integration,
      'facebook_form_id', v_form_id,
      'leads_sales_person_updated', v_updated_leads,
      'lead_sales_people_inserted', v_inserted_junction
    )
  );
END $$;

-- Verification (run separately after apply):
-- SELECT count(*) FILTER (WHERE sales_person_id = 'fcc854d0-f7bf-45cb-9056-376cacc06943') AS assigned,
--        count(*) AS total
-- FROM leads WHERE tenant_id = '571dbdde-62b9-4c14-b536-30ae7a4fef81' AND archived_at IS NULL;
-- SELECT count(*) FROM lead_sales_people lsp
-- JOIN leads l ON l.id = lsp.lead_id
-- WHERE l.tenant_id = '571dbdde-62b9-4c14-b536-30ae7a4fef81' AND l.archived_at IS NULL
--   AND lsp.sales_person_id = 'fcc854d0-f7bf-45cb-9056-376cacc06943';

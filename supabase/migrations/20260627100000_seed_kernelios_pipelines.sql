-- Seed marketing pipelines for KERNELIOS client (tenant: MarketingCaptain)
-- client_id: a946c3e4-7180-48f9-a997-7c285639497e
-- tenant_id: 2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019

DO $$
DECLARE
  v_client_id uuid := 'a946c3e4-7180-48f9-a997-7c285639497e';
  v_tenant_id uuid := '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019';
  v_pipeline_id uuid;
BEGIN

  -- ========== CAMPAIGNS TRACK ==========
  IF NOT EXISTS (
    SELECT 1 FROM marketing_pipelines
    WHERE client_id = v_client_id AND track = 'campaigns'
  ) THEN
    INSERT INTO marketing_pipelines (client_id, tenant_id, track)
    VALUES (v_client_id, v_tenant_id, 'campaigns')
    RETURNING id INTO v_pipeline_id;

    INSERT INTO marketing_pipeline_stages (pipeline_id, tenant_id, stage_type, name, position_x, position_y, sort_order, approval_mode)
    VALUES
      (v_pipeline_id, v_tenant_id, 'strategy',    'בריף',           1120, 200, 0, 'manual'),
      (v_pipeline_id, v_tenant_id, 'copy',         'כתיבת תוכן',    840,  200, 1, 'manual'),
      (v_pipeline_id, v_tenant_id, 'creative',     'קריאייטיב',     560,  200, 2, 'manual'),
      (v_pipeline_id, v_tenant_id, 'target_paid',  'קמפיין ממומן',  280,  200, 3, 'manual'),
      (v_pipeline_id, v_tenant_id, 'measurement',  'מדידה',         0,    200, 4, 'manual');
  END IF;

  -- ========== SEO/GEO TRACK ==========
  IF NOT EXISTS (
    SELECT 1 FROM marketing_pipelines
    WHERE client_id = v_client_id AND track = 'seo_geo'
  ) THEN
    INSERT INTO marketing_pipelines (client_id, tenant_id, track)
    VALUES (v_client_id, v_tenant_id, 'seo_geo')
    RETURNING id INTO v_pipeline_id;

    INSERT INTO marketing_pipeline_stages (pipeline_id, tenant_id, stage_type, name, position_x, position_y, sort_order, approval_mode)
    VALUES
      (v_pipeline_id, v_tenant_id, 'strategy',   'בריף',          1120, 200, 0, 'manual'),
      (v_pipeline_id, v_tenant_id, 'copy',        'כתיבת תוכן',   840,  200, 1, 'manual'),
      (v_pipeline_id, v_tenant_id, 'creative',    'קריאייטיב',    560,  200, 2, 'manual'),
      (v_pipeline_id, v_tenant_id, 'target_seo',  'SEO / GEO',    280,  200, 3, 'manual'),
      (v_pipeline_id, v_tenant_id, 'measurement', 'מדידה',        0,    200, 4, 'manual');
  END IF;

  -- ========== SOCIAL ORGANIC TRACK ==========
  IF NOT EXISTS (
    SELECT 1 FROM marketing_pipelines
    WHERE client_id = v_client_id AND track = 'social_organic'
  ) THEN
    INSERT INTO marketing_pipelines (client_id, tenant_id, track)
    VALUES (v_client_id, v_tenant_id, 'social_organic')
    RETURNING id INTO v_pipeline_id;

    INSERT INTO marketing_pipeline_stages (pipeline_id, tenant_id, stage_type, name, position_x, position_y, sort_order, approval_mode)
    VALUES
      (v_pipeline_id, v_tenant_id, 'strategy',       'בריף',           1120, 200, 0, 'manual'),
      (v_pipeline_id, v_tenant_id, 'copy',            'כתיבת תוכן',    840,  200, 1, 'manual'),
      (v_pipeline_id, v_tenant_id, 'creative',        'קריאייטיב',     560,  200, 2, 'manual'),
      (v_pipeline_id, v_tenant_id, 'target_organic',  'סושיאל אורגני', 280,  200, 3, 'manual'),
      (v_pipeline_id, v_tenant_id, 'measurement',     'מדידה',         0,    200, 4, 'manual');
  END IF;

END $$;

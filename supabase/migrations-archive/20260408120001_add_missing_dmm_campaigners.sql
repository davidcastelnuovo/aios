-- Add missing campaigners to DMM tenant
-- This script adds: שי דניאל, אריאל, דנה בויום, דוד
-- and associates them with the relevant DMM agencies (DMM-LTD and/or DMM-MC)

DO $$
DECLARE
  v_tenant_id uuid;
  v_agency_ltd_id uuid;
  v_agency_mc_id uuid;
  v_campaigner_id uuid;
BEGIN
  -- Get DMM tenant ID
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'dmm' LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'DMM tenant not found, skipping';
    RETURN;
  END IF;

  -- Get agency IDs
  SELECT id INTO v_agency_ltd_id FROM public.agencies WHERE tenant_id = v_tenant_id AND (name ILIKE '%DMM-LTD%' OR name ILIKE '%DMM LTD%') LIMIT 1;
  SELECT id INTO v_agency_mc_id  FROM public.agencies WHERE tenant_id = v_tenant_id AND (name ILIKE '%DMM-MC%'  OR name ILIKE '%DMM MC%')  LIMIT 1;

  RAISE NOTICE 'Tenant: %, Agency LTD: %, Agency MC: %', v_tenant_id, v_agency_ltd_id, v_agency_mc_id;

  -- ── שי דניאל ──────────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.campaigners
    WHERE tenant_id = v_tenant_id AND full_name = 'שי דניאל'
  ) THEN
    INSERT INTO public.campaigners (tenant_id, full_name, role, active)
    VALUES (v_tenant_id, 'שי דניאל', ARRAY['campaigner'], true)
    RETURNING id INTO v_campaigner_id;

    IF v_agency_ltd_id IS NOT NULL THEN
      INSERT INTO public.campaigner_agencies (campaigner_id, agency_id)
      VALUES (v_campaigner_id, v_agency_ltd_id)
      ON CONFLICT DO NOTHING;
    END IF;
    RAISE NOTICE 'Added שי דניאל (id: %)', v_campaigner_id;
  ELSE
    RAISE NOTICE 'שי דניאל already exists, skipping';
  END IF;

  -- ── אריאל ─────────────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.campaigners
    WHERE tenant_id = v_tenant_id AND full_name = 'אריאל'
  ) THEN
    INSERT INTO public.campaigners (tenant_id, full_name, role, active)
    VALUES (v_tenant_id, 'אריאל', ARRAY['campaigner'], true)
    RETURNING id INTO v_campaigner_id;

    IF v_agency_ltd_id IS NOT NULL THEN
      INSERT INTO public.campaigner_agencies (campaigner_id, agency_id)
      VALUES (v_campaigner_id, v_agency_ltd_id)
      ON CONFLICT DO NOTHING;
    END IF;
    RAISE NOTICE 'Added אריאל (id: %)', v_campaigner_id;
  ELSE
    RAISE NOTICE 'אריאל already exists, skipping';
  END IF;

  -- ── דנה בויום ─────────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.campaigners
    WHERE tenant_id = v_tenant_id AND full_name = 'דנה בויום'
  ) THEN
    INSERT INTO public.campaigners (tenant_id, full_name, role, active)
    VALUES (v_tenant_id, 'דנה בויום', ARRAY['campaigner'], true)
    RETURNING id INTO v_campaigner_id;

    IF v_agency_ltd_id IS NOT NULL THEN
      INSERT INTO public.campaigner_agencies (campaigner_id, agency_id)
      VALUES (v_campaigner_id, v_agency_ltd_id)
      ON CONFLICT DO NOTHING;
    END IF;
    RAISE NOTICE 'Added דנה בויום (id: %)', v_campaigner_id;
  ELSE
    RAISE NOTICE 'דנה בויום already exists, skipping';
  END IF;

  -- ── דוד ───────────────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.campaigners
    WHERE tenant_id = v_tenant_id AND full_name = 'דוד'
  ) THEN
    INSERT INTO public.campaigners (tenant_id, full_name, role, active)
    VALUES (v_tenant_id, 'דוד', ARRAY['campaigner'], true)
    RETURNING id INTO v_campaigner_id;

    -- דוד מופיע גם ב-DMM-MC (דוד ואנה = DMM-MC)
    IF v_agency_ltd_id IS NOT NULL THEN
      INSERT INTO public.campaigner_agencies (campaigner_id, agency_id)
      VALUES (v_campaigner_id, v_agency_ltd_id)
      ON CONFLICT DO NOTHING;
    END IF;
    IF v_agency_mc_id IS NOT NULL THEN
      INSERT INTO public.campaigner_agencies (campaigner_id, agency_id)
      VALUES (v_campaigner_id, v_agency_mc_id)
      ON CONFLICT DO NOTHING;
    END IF;
    RAISE NOTICE 'Added דוד (id: %)', v_campaigner_id;
  ELSE
    RAISE NOTICE 'דוד already exists, skipping';
  END IF;

END $$;


-- Create RPC that lets a campaigner add a client and auto-assigns themselves to client_team
-- so they (and managers/owners) immediately see it. Owners/managers/sales also use this RPC.
CREATE OR REPLACE FUNCTION public.create_client_with_assignment(
  p_tenant_id uuid,
  p_agency_id uuid,
  p_name text,
  p_contact_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_folder_link text DEFAULT NULL,
  p_retainer numeric DEFAULT NULL,
  p_monthly_budget numeric DEFAULT NULL,
  p_website text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_is_seo_client boolean DEFAULT false,
  p_services text[] DEFAULT ARRAY[]::text[],
  p_meta_ads_account_id text DEFAULT NULL,
  p_google_ads_account_id text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_campaigner_id uuid;
  v_allowed boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Authorization: super_admin OR (tenant match AND has one of the allowed roles)
  v_allowed :=
    public.is_super_admin(v_user_id)
    OR (
      p_tenant_id = public.get_user_tenant_id(v_user_id)
      AND (
        public.has_role(v_user_id, 'owner'::app_role)
        OR public.has_role(v_user_id, 'team_manager'::app_role)
        OR public.has_role(v_user_id, 'sales_person'::app_role)
        OR public.has_role(v_user_id, 'campaigner'::app_role)
      )
    );

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not authorized to create clients in this tenant';
  END IF;

  -- Verify the agency belongs to the tenant (or is shared into it)
  IF NOT EXISTS (
    SELECT 1 FROM agencies a
    WHERE a.id = p_agency_id
      AND (
        a.tenant_id = p_tenant_id
        OR EXISTS (
          SELECT 1 FROM agency_tenant_access ata
          WHERE ata.agency_id = a.id
            AND ata.accessing_tenant_id = p_tenant_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'Agency does not belong to this tenant';
  END IF;

  INSERT INTO public.clients (
    name, contact_name, agency_id, tenant_id, phone, email, folder_link,
    retainer, monthly_budget, website, notes, is_seo_client, services,
    meta_ads_account_id, google_ads_account_id
  ) VALUES (
    p_name, p_contact_name, p_agency_id, p_tenant_id, p_phone, p_email, p_folder_link,
    p_retainer, p_monthly_budget, p_website, p_notes, p_is_seo_client, p_services,
    p_meta_ads_account_id, p_google_ads_account_id
  ) RETURNING id INTO v_client_id;

  -- Auto-assign creator as a team member if they are a campaigner.
  -- Owners/team_managers don't need this — their SELECT policy already covers all
  -- clients in the tenant / managed agencies.
  v_campaigner_id := public.get_user_campaigner_id(v_user_id);
  IF v_campaigner_id IS NOT NULL THEN
    INSERT INTO public.client_team (client_id, campaigner_id)
    VALUES (v_client_id, v_campaigner_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_client_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_client_with_assignment(
  uuid, uuid, text, text, text, text, text, numeric, numeric, text, text,
  boolean, text[], text, text
) TO authenticated;

-- clients.services was migrated from text[] to jsonb, but create_client_with_assignment
-- still inserted the text[] param directly into the jsonb column:
--   ERROR: column "services" is of type jsonb but expression is of type text[]
-- This broke every client insert (AddClientForm). Cast the param to jsonb; signature
-- is unchanged so the frontend RPC call stays the same.
CREATE OR REPLACE FUNCTION public.create_client_with_assignment(
  p_tenant_id uuid, p_agency_id uuid, p_name text,
  p_contact_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text, p_folder_link text DEFAULT NULL::text,
  p_retainer numeric DEFAULT NULL::numeric, p_monthly_budget numeric DEFAULT NULL::numeric,
  p_website text DEFAULT NULL::text, p_notes text DEFAULT NULL::text,
  p_is_seo_client boolean DEFAULT false, p_services text[] DEFAULT ARRAY[]::text[],
  p_meta_ads_account_id text DEFAULT NULL::text, p_google_ads_account_id text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_campaigner_id uuid;
  v_allowed boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

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
    p_retainer, p_monthly_budget, p_website, p_notes, p_is_seo_client, to_jsonb(p_services),
    p_meta_ads_account_id, p_google_ads_account_id
  ) RETURNING id INTO v_client_id;

  v_campaigner_id := public.get_user_campaigner_id(v_user_id);
  IF v_campaigner_id IS NOT NULL THEN
    INSERT INTO public.client_team (client_id, campaigner_id)
    VALUES (v_client_id, v_campaigner_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_client_id;
END;
$function$;

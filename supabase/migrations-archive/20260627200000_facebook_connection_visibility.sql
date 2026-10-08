-- Migration: Add connection_visibility to tenant_integrations
-- Allows each user's integration connection to be:
--   'private'  — only the owner can use it
--   'org'      — all members of the tenant can use it
--   'shared'   — specific users granted via integration_user_permissions

ALTER TABLE public.tenant_integrations
  ADD COLUMN IF NOT EXISTS connection_visibility text NOT NULL DEFAULT 'private'
    CHECK (connection_visibility IN ('private', 'org', 'shared'));

-- Existing org-level integrations (user_id IS NULL) stay as 'org'
UPDATE public.tenant_integrations
  SET connection_visibility = 'org'
  WHERE user_id IS NULL AND connection_visibility = 'private';

-- Existing integrations that already have permission rows → mark as 'shared'
UPDATE public.tenant_integrations ti
  SET connection_visibility = 'shared'
  WHERE ti.user_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.integration_user_permissions iup
      WHERE iup.integration_id = ti.id
    );

-- Update the user_has_integration_permission function to respect visibility
CREATE OR REPLACE FUNCTION public.user_has_integration_permission(p_user_id uuid, p_integration_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_integration RECORD;
BEGIN
  SELECT * INTO v_integration
  FROM tenant_integrations
  WHERE id = p_integration_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Super admin always has access
  IF is_super_admin(p_user_id) THEN
    RETURN TRUE;
  END IF;

  -- Owner always has access
  IF v_integration.user_id = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- Org-level integration (user_id IS NULL) or visibility = 'org'
  IF v_integration.user_id IS NULL OR v_integration.connection_visibility = 'org' THEN
    RETURN EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_id = v_integration.tenant_id
        AND user_id = p_user_id
    );
  END IF;

  -- Visibility = 'shared' — check explicit permission
  IF v_integration.connection_visibility = 'shared' THEN
    RETURN EXISTS (
      SELECT 1 FROM integration_user_permissions
      WHERE integration_id = p_integration_id
        AND user_id = p_user_id
    );
  END IF;

  -- Visibility = 'private' — only owner (already handled above)
  RETURN FALSE;
END;
$function$;

-- Update the simpler user_has_integration_access function (used in RLS) similarly
CREATE OR REPLACE FUNCTION public.user_has_integration_access(p_integration_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_integration RECORD;
BEGIN
  SELECT * INTO v_integration
  FROM tenant_integrations
  WHERE id = p_integration_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Owner always has access
  IF v_integration.user_id = auth.uid() THEN
    RETURN TRUE;
  END IF;

  -- Org-level or visibility = 'org'
  IF v_integration.user_id IS NULL OR v_integration.connection_visibility = 'org' THEN
    RETURN EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_id = v_integration.tenant_id
        AND user_id = auth.uid()
    );
  END IF;

  -- Visibility = 'shared' — check explicit permission
  IF v_integration.connection_visibility = 'shared' THEN
    RETURN EXISTS (
      SELECT 1 FROM integration_user_permissions
      WHERE integration_id = p_integration_id
        AND user_id = auth.uid()
    );
  END IF;

  -- Private — only owner
  RETURN FALSE;
END;
$function$;

-- Index for fast visibility lookups
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_visibility
  ON public.tenant_integrations (tenant_id, integration_type, connection_visibility)
  WHERE is_active = true;

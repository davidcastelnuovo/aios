-- ================================================
-- שלב 1: יצירת טבלת agency_tenant_access
-- ================================================
CREATE TABLE IF NOT EXISTS public.agency_tenant_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  accessing_tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  access_level text DEFAULT 'read_write' CHECK (access_level IN ('read_only', 'read_write')),
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  notes text,
  UNIQUE(source_tenant_id, agency_id, accessing_tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_tenant_access_accessing ON public.agency_tenant_access(accessing_tenant_id, agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_tenant_access_source ON public.agency_tenant_access(source_tenant_id, agency_id);

ALTER TABLE public.agency_tenant_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all agency_tenant_access"
ON public.agency_tenant_access FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Owners can manage their tenant agency access"
ON public.agency_tenant_access FOR ALL
USING (
  has_role(auth.uid(), 'owner'::app_role) 
  AND (source_tenant_id = get_user_tenant_id(auth.uid()) OR accessing_tenant_id = get_user_tenant_id(auth.uid()))
)
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role) 
  AND (source_tenant_id = get_user_tenant_id(auth.uid()) OR accessing_tenant_id = get_user_tenant_id(auth.uid()))
);

CREATE POLICY "Users can view their tenant agency access"
ON public.agency_tenant_access FOR SELECT
USING (source_tenant_id = get_user_tenant_id(auth.uid()) OR accessing_tenant_id = get_user_tenant_id(auth.uid()));

-- ================================================
-- שלב 2: יצירת פונקציות עזר
-- ================================================

CREATE OR REPLACE FUNCTION public.user_has_cross_tenant_agency_access(_user_id uuid, _agency_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agency_tenant_access ata
    WHERE ata.agency_id = _agency_id AND ata.accessing_tenant_id = public.get_user_tenant_id(_user_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.user_owns_agency(_user_id uuid, _agency_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agencies a
    WHERE a.id = _agency_id AND a.tenant_id = public.get_user_tenant_id(_user_id)
  )
$$;
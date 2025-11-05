-- Enable RLS on agencies (if not already enabled)
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Super admins can manage all agencies" ON public.agencies;
DROP POLICY IF EXISTS "Owners can view all agencies in their tenant" ON public.agencies;
DROP POLICY IF EXISTS "Team managers can view their managed agencies" ON public.agencies;
DROP POLICY IF EXISTS "Campaigners can view their assigned agencies" ON public.agencies;
DROP POLICY IF EXISTS "Owners can manage agencies in their tenant" ON public.agencies;

-- Policy: Super admins can do everything
CREATE POLICY "Super admins can manage all agencies"
ON public.agencies
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Policy: Owners can view all agencies in their tenant
CREATE POLICY "Owners can view all agencies in their tenant"
ON public.agencies
FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  AND has_role(auth.uid(), 'owner'::app_role)
);

-- Policy: Team managers can view agencies they manage
CREATE POLICY "Team managers can view their managed agencies"
ON public.agencies
FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND user_manages_agency(auth.uid(), id)
);

-- Policy: Campaigners can view agencies they're assigned to
CREATE POLICY "Campaigners can view their assigned agencies"
ON public.agencies
FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND user_has_agency_access(auth.uid(), id)
);

-- Policy: Owners can insert/update/delete agencies in their tenant
CREATE POLICY "Owners can manage agencies in their tenant"
ON public.agencies
FOR ALL
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'owner'::app_role)
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'owner'::app_role)
);

-- Create or replace function to auto-set tenant_id on insert
CREATE OR REPLACE FUNCTION public.set_agency_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id 
    FROM public.tenant_users 
    WHERE user_id = auth.uid() 
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS set_agency_tenant_id_trigger ON public.agencies;
CREATE TRIGGER set_agency_tenant_id_trigger
BEFORE INSERT ON public.agencies
FOR EACH ROW
EXECUTE FUNCTION public.set_agency_tenant_id();
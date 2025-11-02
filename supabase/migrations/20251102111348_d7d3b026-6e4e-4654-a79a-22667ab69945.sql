-- 1) Backfill tenant_id for existing campaigners based on their agencies
UPDATE public.campaigners c
SET tenant_id = a.tenant_id
FROM public.campaigner_agencies ca
JOIN public.agencies a ON a.id = ca.agency_id
WHERE c.id = ca.campaigner_id 
  AND c.tenant_id IS NULL
  AND a.tenant_id IS NOT NULL;

-- 2) Create trigger to auto-set tenant_id for new campaigners based on the user who created them
CREATE OR REPLACE FUNCTION public.set_campaigner_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Try to get tenant_id from the current user
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id 
    FROM public.tenant_users 
    WHERE user_id = auth.uid() 
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_campaigner_tenant_id ON public.campaigners;
CREATE TRIGGER trg_set_campaigner_tenant_id
BEFORE INSERT ON public.campaigners
FOR EACH ROW
EXECUTE FUNCTION public.set_campaigner_tenant_id();

-- 3) Make tenant_id NOT NULL to enforce it going forward
ALTER TABLE public.campaigners
ALTER COLUMN tenant_id SET NOT NULL;
-- Add agency_id to products table
ALTER TABLE public.products
ADD COLUMN agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_products_agency_id ON public.products(agency_id);

-- Update RLS policy to allow access to products from shared agencies
DROP POLICY IF EXISTS "Users can view products in their tenant" ON public.products;

CREATE POLICY "Users can view products in their tenant"
  ON public.products
  FOR SELECT
  USING (
    tenant_id = get_user_tenant_id(auth.uid()) 
    OR is_super_admin(auth.uid())
    OR (agency_id IS NOT NULL AND user_has_cross_tenant_agency_access(auth.uid(), agency_id))
  );

COMMENT ON COLUMN public.products.agency_id IS 'Optional agency association for sharing products with connected tenants';
-- Update RLS policies for remaining tables to respect allow_super_admin_access

-- For sales_people
DROP POLICY IF EXISTS "Super admins can view all sales_people" ON public.sales_people;
DROP POLICY IF EXISTS "Super admins can manage all sales_people" ON public.sales_people;

CREATE POLICY "Super admins can view sales_people with permission"
ON public.sales_people
FOR SELECT
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = sales_people.tenant_id
  ) = true
);

CREATE POLICY "Super admins can manage sales_people with permission"
ON public.sales_people
FOR ALL
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = sales_people.tenant_id
  ) = true
)
WITH CHECK (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = sales_people.tenant_id
  ) = true
);

-- For suppliers
DROP POLICY IF EXISTS "Super admins can view all suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Super admins can manage all suppliers" ON public.suppliers;

CREATE POLICY "Super admins can view suppliers with permission"
ON public.suppliers
FOR SELECT
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = suppliers.tenant_id
  ) = true
);

CREATE POLICY "Super admins can manage suppliers with permission"
ON public.suppliers
FOR ALL
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = suppliers.tenant_id
  ) = true
)
WITH CHECK (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = suppliers.tenant_id
  ) = true
);

-- For products
DROP POLICY IF EXISTS "Super admins can view all products" ON public.products;
DROP POLICY IF EXISTS "Super admins can manage all products" ON public.products;

CREATE POLICY "Super admins can view products with permission"
ON public.products
FOR SELECT
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = products.tenant_id
  ) = true
);

CREATE POLICY "Super admins can manage products with permission"
ON public.products
FOR ALL
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = products.tenant_id
  ) = true
)
WITH CHECK (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = products.tenant_id
  ) = true
);

-- For automations
DROP POLICY IF EXISTS "Super admins can view all automations" ON public.automations;
DROP POLICY IF EXISTS "Super admins can manage all automations" ON public.automations;

CREATE POLICY "Super admins can view automations with permission"
ON public.automations
FOR SELECT
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = automations.tenant_id
  ) = true
);

CREATE POLICY "Super admins can manage automations with permission"
ON public.automations
FOR ALL
USING (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = automations.tenant_id
  ) = true
)
WITH CHECK (
  is_super_admin(auth.uid()) AND (
    SELECT allow_super_admin_access 
    FROM public.tenants 
    WHERE id = automations.tenant_id
  ) = true
);
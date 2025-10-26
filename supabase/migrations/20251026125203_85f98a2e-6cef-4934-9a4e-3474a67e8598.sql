-- Create tenant status enum
CREATE TYPE tenant_status AS ENUM ('active', 'inactive', 'suspended', 'trial');

-- Create tenants table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE,
  status tenant_status NOT NULL DEFAULT 'active',
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  settings JSONB DEFAULT '{}'::jsonb,
  contact_email TEXT,
  contact_name TEXT,
  notes TEXT
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Create tenant_users junction table
CREATE TABLE public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- Create global_settings table
CREATE TABLE public.global_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- Create tenant_settings for overrides
CREATE TABLE public.tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, setting_key)
);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- Add super_admin to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Add tenant_id to existing tables
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.campaigners ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.sales_people ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.finance ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.client_onboarding ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Create helper function to get user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.tenant_users
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Create helper function to check if user is super admin (using text comparison to avoid enum issues)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = 'super_admin'
  )
$$;

-- Create function to get effective setting (tenant override or global)
CREATE OR REPLACE FUNCTION public.get_effective_setting(_tenant_id uuid, _setting_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT setting_value FROM public.tenant_settings 
     WHERE tenant_id = _tenant_id AND setting_key = _setting_key),
    (SELECT setting_value FROM public.global_settings 
     WHERE setting_key = _setting_key)
  )
$$;

-- RLS Policies for tenants table
CREATE POLICY "Super admins can view all tenants"
  ON public.tenants FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own tenant"
  ON public.tenants FOR SELECT
  USING (id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Super admins can insert tenants"
  ON public.tenants FOR INSERT
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update tenants"
  ON public.tenants FOR UPDATE
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete tenants"
  ON public.tenants FOR DELETE
  USING (is_super_admin(auth.uid()));

-- RLS Policies for tenant_users table
CREATE POLICY "Super admins can view all tenant_users"
  ON public.tenant_users FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own tenant users"
  ON public.tenant_users FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Super admins can insert tenant_users"
  ON public.tenant_users FOR INSERT
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update tenant_users"
  ON public.tenant_users FOR UPDATE
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete tenant_users"
  ON public.tenant_users FOR DELETE
  USING (is_super_admin(auth.uid()));

-- RLS Policies for global_settings
CREATE POLICY "Super admins can manage global_settings"
  ON public.global_settings FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can view global_settings"
  ON public.global_settings FOR SELECT
  USING (true);

-- RLS Policies for tenant_settings
CREATE POLICY "Super admins can manage all tenant_settings"
  ON public.tenant_settings FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Tenant owners can view their tenant_settings"
  ON public.tenant_settings FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant owners can update their tenant_settings"
  ON public.tenant_settings FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.tenant_users 
      WHERE user_id = auth.uid() 
      AND tenant_id = tenant_settings.tenant_id 
      AND role = 'owner'
    )
  );

-- Update existing RLS policies to include tenant_id checks
-- Update agencies policies
DROP POLICY IF EXISTS "Campaigners can view their agencies" ON public.agencies;
CREATE POLICY "Campaigners can view their agencies"
  ON public.agencies FOR SELECT
  USING (
    is_super_admin(auth.uid()) OR
    (tenant_id = get_user_tenant_id(auth.uid()) AND id = ANY (get_user_agency_ids(auth.uid())))
  );

DROP POLICY IF EXISTS "Owners can view all agencies" ON public.agencies;
CREATE POLICY "Owners can view all agencies"
  ON public.agencies FOR SELECT
  USING (
    is_super_admin(auth.uid()) OR
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  );

DROP POLICY IF EXISTS "Sales people can view their agencies" ON public.agencies;
CREATE POLICY "Sales people can view their agencies"
  ON public.agencies FOR SELECT
  USING (
    is_super_admin(auth.uid()) OR
    (tenant_id = get_user_tenant_id(auth.uid()) AND id = ANY (get_user_sales_person_agency_ids(auth.uid())))
  );

DROP POLICY IF EXISTS "Team managers can view managed agencies" ON public.agencies;
CREATE POLICY "Team managers can view managed agencies"
  ON public.agencies FOR SELECT
  USING (
    is_super_admin(auth.uid()) OR
    (tenant_id = get_user_tenant_id(auth.uid()) AND user_manages_agency(auth.uid(), id))
  );

DROP POLICY IF EXISTS "Authenticated users can insert agencies" ON public.agencies;
CREATE POLICY "Authenticated users can insert agencies"
  ON public.agencies FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update agencies" ON public.agencies;
CREATE POLICY "Authenticated users can update agencies"
  ON public.agencies FOR UPDATE
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can delete agencies" ON public.agencies;
CREATE POLICY "Authenticated users can delete agencies"
  ON public.agencies FOR DELETE
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Update clients policies
DROP POLICY IF EXISTS "Campaigners can view clients from their agencies" ON public.clients;
CREATE POLICY "Campaigners can view clients from their agencies"
  ON public.clients FOR SELECT
  USING (
    is_super_admin(auth.uid()) OR
    (tenant_id = get_user_tenant_id(auth.uid()) AND agency_id = ANY (get_user_agency_ids(auth.uid())))
  );

DROP POLICY IF EXISTS "Owners can view all clients" ON public.clients;
CREATE POLICY "Owners can view all clients"
  ON public.clients FOR SELECT
  USING (
    is_super_admin(auth.uid()) OR
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  );

DROP POLICY IF EXISTS "Sales people can view clients from their agencies" ON public.clients;
CREATE POLICY "Sales people can view clients from their agencies"
  ON public.clients FOR SELECT
  USING (
    is_super_admin(auth.uid()) OR
    (tenant_id = get_user_tenant_id(auth.uid()) AND agency_id = ANY (get_user_sales_person_agency_ids(auth.uid())))
  );

DROP POLICY IF EXISTS "Team managers can view clients they manage" ON public.clients;
CREATE POLICY "Team managers can view clients they manage"
  ON public.clients FOR SELECT
  USING (
    is_super_admin(auth.uid()) OR
    (tenant_id = get_user_tenant_id(auth.uid()) AND user_manages_agency(auth.uid(), agency_id))
  );

DROP POLICY IF EXISTS "Authenticated users can insert clients" ON public.clients;
CREATE POLICY "Authenticated users can insert clients"
  ON public.clients FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
CREATE POLICY "Authenticated users can update clients"
  ON public.clients FOR UPDATE
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can delete clients" ON public.clients;
CREATE POLICY "Authenticated users can delete clients"
  ON public.clients FOR DELETE
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Update leads policies
DROP POLICY IF EXISTS "Campaigners can view leads from their agencies" ON public.leads;
CREATE POLICY "Campaigners can view leads from their agencies"
  ON public.leads FOR SELECT
  USING (
    is_super_admin(auth.uid()) OR
    (tenant_id = get_user_tenant_id(auth.uid()) AND agency_id = ANY (get_user_agency_ids(auth.uid())))
  );

DROP POLICY IF EXISTS "Owners can view all leads" ON public.leads;
CREATE POLICY "Owners can view all leads"
  ON public.leads FOR SELECT
  USING (
    is_super_admin(auth.uid()) OR
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  );

DROP POLICY IF EXISTS "Sales people can view leads from their agencies" ON public.leads;
CREATE POLICY "Sales people can view leads from their agencies"
  ON public.leads FOR SELECT
  USING (
    is_super_admin(auth.uid()) OR
    (tenant_id = get_user_tenant_id(auth.uid()) AND ((sales_person_id = get_user_sales_person_id(auth.uid())) OR (agency_id = ANY (get_user_sales_person_agency_ids(auth.uid())))))
  );

DROP POLICY IF EXISTS "Campaigners can insert leads for their agencies" ON public.leads;
CREATE POLICY "Campaigners can insert leads for their agencies"
  ON public.leads FOR INSERT
  WITH CHECK (
    is_super_admin(auth.uid()) OR
    (tenant_id = get_user_tenant_id(auth.uid()) AND agency_id = ANY (get_user_agency_ids(auth.uid())))
  );

DROP POLICY IF EXISTS "Sales people can insert leads for their agencies" ON public.leads;
CREATE POLICY "Sales people can insert leads for their agencies"
  ON public.leads FOR INSERT
  WITH CHECK (
    is_super_admin(auth.uid()) OR
    (tenant_id = get_user_tenant_id(auth.uid()) AND ((sales_person_id = get_user_sales_person_id(auth.uid())) OR (agency_id = ANY (get_user_sales_person_agency_ids(auth.uid())))))
  );

DROP POLICY IF EXISTS "Owners can insert all leads" ON public.leads;
CREATE POLICY "Owners can insert all leads"
  ON public.leads FOR INSERT
  WITH CHECK (
    is_super_admin(auth.uid()) OR
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  );

DROP POLICY IF EXISTS "Campaigners can update leads from their agencies" ON public.leads;
CREATE POLICY "Campaigners can update leads from their agencies"
  ON public.leads FOR UPDATE
  USING (
    is_super_admin(auth.uid()) OR
    (tenant_id = get_user_tenant_id(auth.uid()) AND agency_id = ANY (get_user_agency_ids(auth.uid())))
  );

DROP POLICY IF EXISTS "Sales people can update leads from their agencies" ON public.leads;
CREATE POLICY "Sales people can update leads from their agencies"
  ON public.leads FOR UPDATE
  USING (
    is_super_admin(auth.uid()) OR
    (tenant_id = get_user_tenant_id(auth.uid()) AND ((sales_person_id = get_user_sales_person_id(auth.uid())) OR (agency_id = ANY (get_user_sales_person_agency_ids(auth.uid())))))
  );

DROP POLICY IF EXISTS "Owners can update all leads" ON public.leads;
CREATE POLICY "Owners can update all leads"
  ON public.leads FOR UPDATE
  USING (
    is_super_admin(auth.uid()) OR
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  );

DROP POLICY IF EXISTS "Owners can delete leads" ON public.leads;
CREATE POLICY "Owners can delete leads"
  ON public.leads FOR DELETE
  USING (
    is_super_admin(auth.uid()) OR
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  );

-- Add trigger for updated_at on new tables
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_global_settings_updated_at
  BEFORE UPDATE ON public.global_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_settings_updated_at
  BEFORE UPDATE ON public.tenant_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
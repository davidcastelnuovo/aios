
CREATE TABLE public.team_channel_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT '📁',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_channel_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view categories in their tenant"
  ON public.team_channel_categories FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can manage categories in their tenant"
  ON public.team_channel_categories FOR ALL
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Change category column on team_channels to reference the new table (nullable)
ALTER TABLE public.team_channels 
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.team_channel_categories(id) ON DELETE SET NULL;

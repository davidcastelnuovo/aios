
CREATE TABLE public.maskyoo_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  phone_last9 text NOT NULL,
  display_number text NOT NULL,
  label text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  category text CHECK (category IN ('organic','paid','general')) DEFAULT 'general',
  is_ignored boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone_last9)
);

CREATE INDEX idx_maskyoo_numbers_tenant ON public.maskyoo_numbers(tenant_id);
CREATE INDEX idx_maskyoo_numbers_client ON public.maskyoo_numbers(client_id);

ALTER TABLE public.maskyoo_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read maskyoo_numbers"
ON public.maskyoo_numbers FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "tenant members insert maskyoo_numbers"
ON public.maskyoo_numbers FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "tenant members update maskyoo_numbers"
ON public.maskyoo_numbers FOR UPDATE TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "tenant members delete maskyoo_numbers"
ON public.maskyoo_numbers FOR DELETE TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER maskyoo_numbers_updated_at
BEFORE UPDATE ON public.maskyoo_numbers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

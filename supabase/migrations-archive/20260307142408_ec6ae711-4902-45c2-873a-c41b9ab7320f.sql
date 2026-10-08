
CREATE TABLE public.gmail_category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES public.gmail_categories(id) ON DELETE CASCADE,
  subject_pattern TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, subject_pattern)
);

ALTER TABLE public.gmail_category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own rules"
  ON public.gmail_category_rules
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

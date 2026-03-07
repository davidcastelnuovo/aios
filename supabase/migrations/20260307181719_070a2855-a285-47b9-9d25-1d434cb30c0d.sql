
CREATE TABLE public.gmail_allowed_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label_id text NOT NULL,
  label_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, label_id)
);

ALTER TABLE public.gmail_allowed_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own allowed labels"
ON public.gmail_allowed_labels
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

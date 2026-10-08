
-- Gmail tokens table (per user, like calendar_tokens)
CREATE TABLE public.gmail_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  google_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gmail tokens"
  ON public.gmail_tokens FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own gmail tokens"
  ON public.gmail_tokens FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own gmail tokens"
  ON public.gmail_tokens FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own gmail tokens"
  ON public.gmail_tokens FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Gmail categories (per tenant)
CREATE TABLE public.gmail_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view gmail categories"
  ON public.gmail_categories FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can manage gmail categories"
  ON public.gmail_categories FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Gmail message categories (per user)
CREATE TABLE public.gmail_message_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  category_id uuid NOT NULL REFERENCES public.gmail_categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id, category_id)
);

ALTER TABLE public.gmail_message_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own message categories"
  ON public.gmail_message_categories FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Gmail blocked senders (per user)
CREATE TABLE public.gmail_blocked_senders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address text NOT NULL,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, email_address)
);

ALTER TABLE public.gmail_blocked_senders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own blocked senders"
  ON public.gmail_blocked_senders FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

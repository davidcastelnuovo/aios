
-- WooCommerce data tables linked to social_media_wordpress_sites
CREATE TABLE IF NOT EXISTS public.woocommerce_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.social_media_wordpress_sites(id) ON DELETE CASCADE,
  woo_order_id bigint NOT NULL,
  order_number text,
  status text,
  currency text,
  total numeric DEFAULT 0,
  subtotal numeric DEFAULT 0,
  total_tax numeric DEFAULT 0,
  shipping_total numeric DEFAULT 0,
  discount_total numeric DEFAULT 0,
  customer_id bigint,
  customer_email text,
  customer_first_name text,
  customer_last_name text,
  customer_phone text,
  billing jsonb DEFAULT '{}'::jsonb,
  shipping jsonb DEFAULT '{}'::jsonb,
  line_items jsonb DEFAULT '[]'::jsonb,
  payment_method text,
  payment_method_title text,
  date_created timestamptz,
  date_modified timestamptz,
  date_completed timestamptz,
  date_paid timestamptz,
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(site_id, woo_order_id)
);

CREATE TABLE IF NOT EXISTS public.woocommerce_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.social_media_wordpress_sites(id) ON DELETE CASCADE,
  woo_product_id bigint NOT NULL,
  name text,
  slug text,
  status text,
  type text,
  sku text,
  price numeric,
  regular_price numeric,
  sale_price numeric,
  stock_quantity integer,
  stock_status text,
  total_sales integer DEFAULT 0,
  categories jsonb DEFAULT '[]'::jsonb,
  images jsonb DEFAULT '[]'::jsonb,
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(site_id, woo_product_id)
);

CREATE TABLE IF NOT EXISTS public.woocommerce_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.social_media_wordpress_sites(id) ON DELETE CASCADE,
  woo_customer_id bigint NOT NULL,
  email text,
  first_name text,
  last_name text,
  username text,
  role text,
  orders_count integer DEFAULT 0,
  total_spent numeric DEFAULT 0,
  avatar_url text,
  billing jsonb DEFAULT '{}'::jsonb,
  shipping jsonb DEFAULT '{}'::jsonb,
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(site_id, woo_customer_id)
);

CREATE TABLE IF NOT EXISTS public.woocommerce_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.social_media_wordpress_sites(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  orders_synced integer DEFAULT 0,
  products_synced integer DEFAULT 0,
  customers_synced integer DEFAULT 0,
  error_message text,
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_woo_orders_site ON public.woocommerce_orders(site_id);
CREATE INDEX IF NOT EXISTS idx_woo_orders_tenant ON public.woocommerce_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_woo_orders_date ON public.woocommerce_orders(date_created DESC);
CREATE INDEX IF NOT EXISTS idx_woo_products_site ON public.woocommerce_products(site_id);
CREATE INDEX IF NOT EXISTS idx_woo_customers_site ON public.woocommerce_customers(site_id);
CREATE INDEX IF NOT EXISTS idx_woo_sync_log_site ON public.woocommerce_sync_log(site_id, started_at DESC);

ALTER TABLE public.woocommerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.woocommerce_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.woocommerce_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.woocommerce_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS: tenant members can read; super admins read all
CREATE POLICY "tenant_read_woo_orders" ON public.woocommerce_orders FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "tenant_read_woo_products" ON public.woocommerce_products FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "tenant_read_woo_customers" ON public.woocommerce_customers FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "tenant_read_woo_sync_log" ON public.woocommerce_sync_log FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Service role / edge functions write through (no policy needed; service role bypasses RLS)

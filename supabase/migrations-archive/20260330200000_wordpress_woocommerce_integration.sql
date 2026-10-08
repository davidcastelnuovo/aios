-- ============================================================
-- WordPress & WooCommerce Integration
-- ============================================================
-- Extends social_media_wordpress_sites with WooCommerce credentials
-- and adds tables for synced WooCommerce data (orders, products, customers)

-- 1. Add WooCommerce columns to existing wordpress sites table
ALTER TABLE public.social_media_wordpress_sites
  ADD COLUMN IF NOT EXISTS woocommerce_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS woo_consumer_key text,
  ADD COLUMN IF NOT EXISTS woo_consumer_secret text,
  ADD COLUMN IF NOT EXISTS woo_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS woo_sync_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;

-- 2. WooCommerce Orders
CREATE TABLE IF NOT EXISTS public.woocommerce_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.social_media_wordpress_sites(id) ON DELETE CASCADE,
  woo_order_id integer NOT NULL,
  order_number text,
  status text,
  currency text,
  total numeric(12,2),
  subtotal numeric(12,2),
  total_tax numeric(12,2),
  shipping_total numeric(12,2),
  discount_total numeric(12,2),
  customer_id integer,
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
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, woo_order_id)
);

-- 3. WooCommerce Products
CREATE TABLE IF NOT EXISTS public.woocommerce_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.social_media_wordpress_sites(id) ON DELETE CASCADE,
  woo_product_id integer NOT NULL,
  name text,
  slug text,
  status text,
  type text,
  sku text,
  price numeric(12,2),
  regular_price numeric(12,2),
  sale_price numeric(12,2),
  stock_quantity integer,
  stock_status text,
  total_sales integer DEFAULT 0,
  categories jsonb DEFAULT '[]'::jsonb,
  images jsonb DEFAULT '[]'::jsonb,
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, woo_product_id)
);

-- 4. WooCommerce Customers
CREATE TABLE IF NOT EXISTS public.woocommerce_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.social_media_wordpress_sites(id) ON DELETE CASCADE,
  woo_customer_id integer NOT NULL,
  email text,
  first_name text,
  last_name text,
  username text,
  role text,
  orders_count integer DEFAULT 0,
  total_spent numeric(12,2) DEFAULT 0,
  avatar_url text,
  billing jsonb DEFAULT '{}'::jsonb,
  shipping jsonb DEFAULT '{}'::jsonb,
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, woo_customer_id)
);

-- 5. WooCommerce Sync Log (per-site sync history)
CREATE TABLE IF NOT EXISTS public.woocommerce_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.social_media_wordpress_sites(id) ON DELETE CASCADE,
  sync_type text NOT NULL DEFAULT 'full', -- 'full' | 'incremental'
  status text NOT NULL DEFAULT 'running', -- 'running' | 'success' | 'error'
  orders_synced integer DEFAULT 0,
  products_synced integer DEFAULT 0,
  customers_synced integer DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Enable RLS on all new tables
ALTER TABLE public.woocommerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.woocommerce_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.woocommerce_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.woocommerce_sync_log ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
CREATE POLICY "tenant_isolation" ON public.woocommerce_orders
  FOR ALL USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "tenant_isolation" ON public.woocommerce_products
  FOR ALL USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "tenant_isolation" ON public.woocommerce_customers
  FOR ALL USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "tenant_isolation" ON public.woocommerce_sync_log
  FOR ALL USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

-- 8. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_woo_orders_tenant ON public.woocommerce_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_woo_orders_site ON public.woocommerce_orders(site_id);
CREATE INDEX IF NOT EXISTS idx_woo_orders_date ON public.woocommerce_orders(date_created DESC);
CREATE INDEX IF NOT EXISTS idx_woo_orders_status ON public.woocommerce_orders(status);
CREATE INDEX IF NOT EXISTS idx_woo_orders_customer_email ON public.woocommerce_orders(customer_email);

CREATE INDEX IF NOT EXISTS idx_woo_products_tenant ON public.woocommerce_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_woo_products_site ON public.woocommerce_products(site_id);

CREATE INDEX IF NOT EXISTS idx_woo_customers_tenant ON public.woocommerce_customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_woo_customers_site ON public.woocommerce_customers(site_id);
CREATE INDEX IF NOT EXISTS idx_woo_customers_email ON public.woocommerce_customers(email);

CREATE INDEX IF NOT EXISTS idx_woo_sync_log_site ON public.woocommerce_sync_log(site_id);
CREATE INDEX IF NOT EXISTS idx_woo_sync_log_tenant ON public.woocommerce_sync_log(tenant_id);

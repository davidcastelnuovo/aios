-- SEO/GEO workflow: keywords, unified content gantt, approval, WordPress scheduling.

create table public.seo_geo_programs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  work_item_id uuid not null unique references public.marketing_work_items(id) on delete cascade,
  wordpress_site_id uuid references public.social_media_wordpress_sites(id) on delete set null,
  auto_approve boolean not null default false,
  horizon_months integer not null default 3 check (horizon_months between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.seo_geo_keywords (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  work_item_id uuid not null references public.marketing_work_items(id) on delete cascade,
  keyword text not null,
  intent text,
  priority text,
  source text not null default 'plan',
  promoted boolean not null default true,
  evidence text,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_item_id, keyword)
);

create table public.seo_geo_calendar_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  work_item_id uuid not null references public.marketing_work_items(id) on delete cascade,
  scheduled_date date not null,
  title text not null,
  primary_keyword text,
  content_type text,
  cluster text,
  intent text,
  angle text,
  geo_questions jsonb not null default '[]'::jsonb,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'auto_approved')),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_by_carmen boolean not null default false,
  generation_status text not null default 'planned'
    check (generation_status in ('planned', 'generating', 'draft', 'published', 'failed')),
  title_draft text,
  excerpt text,
  content_html text,
  meta_description text,
  live_url text,
  published_at timestamptz,
  publish_error text,
  wordpress_post_id text,
  plan_index integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index seo_geo_programs_tenant_client_idx on public.seo_geo_programs (tenant_id, client_id);
create index seo_geo_keywords_work_item_idx on public.seo_geo_keywords (work_item_id, promoted, sort_order);
create index seo_geo_calendar_work_item_date_idx on public.seo_geo_calendar_entries (work_item_id, scheduled_date);
create index seo_geo_calendar_publish_idx on public.seo_geo_calendar_entries (tenant_id, scheduled_date, approval_status, generation_status);

alter table public.seo_geo_programs enable row level security;
alter table public.seo_geo_keywords enable row level security;
alter table public.seo_geo_calendar_entries enable row level security;

grant select, insert, update, delete on public.seo_geo_programs to authenticated, service_role;
grant select, insert, update, delete on public.seo_geo_keywords to authenticated, service_role;
grant select, insert, update, delete on public.seo_geo_calendar_entries to authenticated, service_role;

create policy seo_geo_programs_tenant on public.seo_geo_programs for all to authenticated
  using (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())))
  with check (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())));

create policy seo_geo_keywords_tenant on public.seo_geo_keywords for all to authenticated
  using (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())))
  with check (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())));

create policy seo_geo_calendar_tenant on public.seo_geo_calendar_entries for all to authenticated
  using (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())))
  with check (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())));

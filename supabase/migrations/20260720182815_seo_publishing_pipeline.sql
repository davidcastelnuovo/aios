-- AIOS publishing pipeline: tenant-managed sites, spreadsheet imports and articles.

create table public.publishing_sites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_key text not null,
  name text not null,
  destination_type text not null default 'pbn' check (destination_type in ('pbn', 'wordpress', 'custom_api')),
  client_id uuid references public.clients(id) on delete set null,
  connection_id uuid,
  base_url text,
  categories jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, site_key)
);

create table public.publishing_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  file_name text not null,
  sheet_count integer not null default 1 check (sheet_count > 0),
  row_count integer not null default 0 check (row_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  error_message text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.publishing_articles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  site_id uuid references public.publishing_sites(id) on delete set null,
  import_id uuid references public.publishing_imports(id) on delete set null,
  customer_name text,
  primary_keyword text not null,
  proposed_topic text,
  target_url text,
  anchor_text text,
  category text,
  slug text,
  title text,
  excerpt text,
  content jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  internal_links jsonb not null default '[]'::jsonb,
  status text not null default 'imported' check (status in ('imported', 'draft', 'review', 'approved', 'published', 'failed')),
  published_at timestamptz,
  live_url text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, target_url, primary_keyword, proposed_topic)
);

create index publishing_sites_tenant_status_idx on public.publishing_sites (tenant_id, status);
create index publishing_imports_tenant_created_idx on public.publishing_imports (tenant_id, created_at desc);
create index publishing_articles_tenant_status_idx on public.publishing_articles (tenant_id, status, updated_at desc);
create index publishing_articles_site_status_idx on public.publishing_articles (site_id, status, published_at desc);

alter table public.publishing_sites enable row level security;
alter table public.publishing_imports enable row level security;
alter table public.publishing_articles enable row level security;

grant select, insert, update, delete on public.publishing_sites to authenticated;
grant select, insert, update, delete on public.publishing_imports to authenticated;
grant select, insert, update, delete on public.publishing_articles to authenticated;
grant select, insert, update, delete on public.publishing_sites to service_role;
grant select, insert, update, delete on public.publishing_imports to service_role;
grant select, insert, update, delete on public.publishing_articles to service_role;

create policy publishing_sites_select on public.publishing_sites for select to authenticated
  using (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())));
create policy publishing_sites_insert on public.publishing_sites for insert to authenticated
  with check (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())));
create policy publishing_sites_update on public.publishing_sites for update to authenticated
  using (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())))
  with check (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())));
create policy publishing_sites_delete on public.publishing_sites for delete to authenticated
  using (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())));

create policy publishing_imports_select on public.publishing_imports for select to authenticated
  using (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())));
create policy publishing_imports_insert on public.publishing_imports for insert to authenticated
  with check (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())));
create policy publishing_imports_update on public.publishing_imports for update to authenticated
  using (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())))
  with check (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())));
create policy publishing_imports_delete on public.publishing_imports for delete to authenticated
  using (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())));

create policy publishing_articles_select on public.publishing_articles for select to authenticated
  using (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())));
create policy publishing_articles_insert on public.publishing_articles for insert to authenticated
  with check (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())));
create policy publishing_articles_update on public.publishing_articles for update to authenticated
  using (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())))
  with check (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())));
create policy publishing_articles_delete on public.publishing_articles for delete to authenticated
  using (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())));

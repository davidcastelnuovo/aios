-- Correlate tenant publishing destinations with external Vercel projects.
alter table public.publishing_sites
  alter column connection_id type text using connection_id::text;

alter table public.publishing_sites
  add column if not exists is_hidden boolean not null default false;

comment on column public.publishing_sites.connection_id is
  'External destination identifier, for example a Vercel project ID or WordPress connection UUID.';

comment on column public.publishing_sites.is_hidden is
  'Hides destinations that are not relevant to the tenant publishing workflow.';

create index if not exists publishing_sites_tenant_visible_idx
  on public.publishing_sites (tenant_id, is_hidden, destination_type);

-- Preserve the editorial assignment month from the source spreadsheet separately
-- from the actual publication timestamp.

alter table public.publishing_articles
  add column if not exists source_month date,
  add column if not exists source_sheet text,
  add column if not exists source_row integer,
  add column if not exists row_fingerprint text;

create unique index if not exists publishing_articles_tenant_fingerprint_uidx
  on public.publishing_articles (tenant_id, row_fingerprint)
  where row_fingerprint is not null;

create index if not exists publishing_articles_tenant_source_month_idx
  on public.publishing_articles (tenant_id, source_month desc, customer_name);

comment on column public.publishing_articles.source_month is
  'Assignment date derived from the Excel sheet month; used as the public article date.';
comment on column public.publishing_articles.published_at is
  'Actual timestamp at which the article was published by the system.';

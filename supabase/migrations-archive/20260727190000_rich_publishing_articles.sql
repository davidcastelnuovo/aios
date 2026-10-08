-- Rich editorial fields for PBN articles.
alter table public.publishing_articles
  add column if not exists hero_image_url text,
  add column if not exists inline_image_url text,
  add column if not exists image_alt text,
  add column if not exists faq jsonb not null default '[]'::jsonb,
  add column if not exists infographic jsonb not null default '{"title":"","items":[]}'::jsonb;

comment on column public.publishing_articles.faq is
  'Structured FAQ entries rendered on article pages and exposed as FAQPage JSON-LD.';
comment on column public.publishing_articles.infographic is
  'Structured, fact-safe visual summary rendered as accessible HTML.';

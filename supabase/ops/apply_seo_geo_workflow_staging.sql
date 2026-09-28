-- Staging: SEO/GEO workflow tables + seo_geo skill (idempotent).

create table if not exists public.seo_geo_programs (
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

create table if not exists public.seo_geo_keywords (
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

create table if not exists public.seo_geo_calendar_entries (
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

create index if not exists seo_geo_programs_tenant_client_idx on public.seo_geo_programs (tenant_id, client_id);
create index if not exists seo_geo_keywords_work_item_idx on public.seo_geo_keywords (work_item_id, promoted, sort_order);
create index if not exists seo_geo_calendar_work_item_date_idx on public.seo_geo_calendar_entries (work_item_id, scheduled_date);
create index if not exists seo_geo_calendar_publish_idx on public.seo_geo_calendar_entries (tenant_id, scheduled_date, approval_status, generation_status);

alter table public.seo_geo_programs enable row level security;
alter table public.seo_geo_keywords enable row level security;
alter table public.seo_geo_calendar_entries enable row level security;

grant select, insert, update, delete on public.seo_geo_programs to authenticated, service_role;
grant select, insert, update, delete on public.seo_geo_keywords to authenticated, service_role;
grant select, insert, update, delete on public.seo_geo_calendar_entries to authenticated, service_role;

drop policy if exists seo_geo_programs_tenant on public.seo_geo_programs;
create policy seo_geo_programs_tenant on public.seo_geo_programs for all to authenticated
  using (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())))
  with check (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())));

drop policy if exists seo_geo_keywords_tenant on public.seo_geo_keywords;
create policy seo_geo_keywords_tenant on public.seo_geo_keywords for all to authenticated
  using (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())))
  with check (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())));

drop policy if exists seo_geo_calendar_tenant on public.seo_geo_calendar_entries;
create policy seo_geo_calendar_tenant on public.seo_geo_calendar_entries for all to authenticated
  using (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())))
  with check (tenant_id in (select tenant_id from public.tenant_users where user_id = (select auth.uid())) or public.is_super_admin((select auth.uid())));

INSERT INTO public.ai_skills
  (slug, scope, name, description, goal, constraints, system_prompt, output_template, allowed_tools, triggers, handoff_slugs, is_active, steps, created_by_agent)
VALUES
(
  'seo_geo',
  'global',
  'SEO / GEO',
  'מחקר ביטויים ומתחרים, תוכנית תוכן, מאמרים מעוצבים לעלייה לאתר הלקוח, ו-GEO (שאלות למנועי AI).',
  'להגדיל נראות אורגנית ו-GEO דרך תוכנית מבוססת-נתונים, מאמרים איכותיים לעלייה ב-WordPress, ובלי המצאת מטריקות.',
  'נתוני Ahrefs/GSC/מעקב בלבד — לא לנחש volume או דירוג. וואטסאפ לקוח = CRM (Green API) + בוט כרמן (Manus) — לא לערבב רשימות קבוצות. מאמרים: עברית, HTML מעוצב (TIP/LIST/FAQ/אינפוגרפיקה), לא פרסומת גולמית.',
  $$את כרמן — מנהלת SEO/GEO. את מובילה מחקר ביטויים ומתחרים, בונה תוכנית תוכן, וכותבת מאמרים לעלייה באתר הלקוח (WordPress). כל שלב מבוסס נתונים מחוברים; סמני פערים. GEO: שאלות שמנועי AI צריכים לענות, ישויות, schema.$$,
  NULL,
  ARRAY['ahrefs_keywords','gsc_query','gen_text','web_analytics'],
  ARRAY['seo geo','seo/ geo','קידום אורגני','geo','מנועי ai','תוכנית תוכן seo'],
  ARRAY['seo','content_writer']::text[],
  true,
  $$1. איסוף הקשר: לקוח, אתר, בריף, דוחות, מעקב, תקשורת CRM.
2. מחקר ביטויים + מתחרים + פערי תוכן (רק מנתונים אמיתיים).
3. הצעת תוכנית תוכן — המתנה לאישור או הערות.
4. לאחר אישור: גאנט, אישור פריטים, כתיבת מאמרים HTML מעוצב.
5. פרסום ל-WordPress כ-post מעוצב; אם אין WP — טיוטה בלבד.$$,
  false
)
ON CONFLICT (slug) WHERE scope = 'global' DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  goal = EXCLUDED.goal,
  constraints = EXCLUDED.constraints,
  system_prompt = EXCLUDED.system_prompt,
  steps = EXCLUDED.steps,
  is_active = true;

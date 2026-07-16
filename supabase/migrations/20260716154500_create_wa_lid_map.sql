-- Auto-learned WhatsApp LID → real phone mappings (see manus-wa-webhook).
-- Written by the webhook when a LID is resolved via a payload real-phone field
-- or a Green-API pairing; read on every private @lid event for zero-config resolution.
create table if not exists public.wa_lid_map (
  lid text primary key,
  phone text not null,
  connection_user_id uuid,
  source text,
  updated_at timestamptz not null default now()
);

alter table public.wa_lid_map enable row level security;
-- Service-role only (edge functions); no anon/authenticated policies on purpose.

create or replace function public.wa_lid_map_touch_updated_at()
returns trigger language plpgsql
security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_wa_lid_map_touch on public.wa_lid_map;
create trigger trg_wa_lid_map_touch
before update on public.wa_lid_map
for each row execute function public.wa_lid_map_touch_updated_at();

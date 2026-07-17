-- Source identity for Carmen WhatsApp sessions.
-- Each session records WHICH channel (tenant_integrations row) opened it, and
-- whether it was opened via open-member-groups mode — where Carmen answers in a
-- group her own WhatsApp number is a member of, but ONLY to direct addresses
-- ("כרמן ..."), on every message, for the whole session lifetime.
alter table public.carmen_whatsapp_sessions
  add column if not exists integration_id uuid,
  add column if not exists open_group boolean not null default false;

comment on column public.carmen_whatsapp_sessions.integration_id is
  'tenant_integrations.id of the channel that opened this session (manus_wa / green_api). NULL for pre-migration sessions.';
comment on column public.carmen_whatsapp_sessions.open_group is
  'True when the session was opened via open-member-groups mode: group not in any allow-list, replies require a direct address on every message.';

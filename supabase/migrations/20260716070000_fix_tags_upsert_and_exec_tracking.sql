-- Two more silent-failure fixes surfaced by the Postgres error flood:
--
-- 1. green-api-webhook upserts chat_contact_tags with
--    onConflict: 'tag_id,user_id,client_id,lead_id,group_id,sender_phone',
--    but no unique index on that column set existed — every upsert failed
--    ("no unique or exclusion constraint matching the ON CONFLICT
--    specification", error swallowed), so unread tags from WhatsApp were
--    never saved. Exactly one of client_id/lead_id/group_id/sender_phone
--    is set per row, so the index must treat NULLs as equal
--    (NULLS NOT DISTINCT, PG15+). No duplicate rows existed at creation.
--
-- 2. trigger-automation inserts automation_executions with
--    automation_id = null for generic triggers (whatsapp_message_received),
--    but the column was NOT NULL — every insert failed silently, which also
--    disabled the 30s cooldown/anti-double-fire guard that queries this
--    table. The code intent is explicit (`automationId || null`), so relax
--    the constraint.
--
-- Applied to prod via MCP apply_migration on 2026-07-16.

CREATE UNIQUE INDEX IF NOT EXISTS chat_contact_tags_target_unique
ON public.chat_contact_tags (tag_id, user_id, client_id, lead_id, group_id, sender_phone)
NULLS NOT DISTINCT;

ALTER TABLE public.automation_executions
ALTER COLUMN automation_id DROP NOT NULL;

-- broadcast_wa_groups — allow sending a broadcast to one or more WhatsApp groups.
-- Changes:
--   1. broadcast_recipients: add entity_type 'wa_group' + group_chat_id column
--   2. broadcasts: allow audience_filter.source = 'wa_groups'
-- No schema changes needed to broadcasts itself — audience_filter is JSONB.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend broadcast_recipients to support WhatsApp group targets
-- ─────────────────────────────────────────────────────────────────────────────

-- Add group_chat_id column (stores the @g.us chatId for group sends)
ALTER TABLE public.broadcast_recipients
  ADD COLUMN IF NOT EXISTS group_chat_id TEXT;

-- Extend the entity_type check to include 'wa_group'
ALTER TABLE public.broadcast_recipients
  DROP CONSTRAINT IF EXISTS broadcast_recipients_entity_type_check;

ALTER TABLE public.broadcast_recipients
  ADD CONSTRAINT broadcast_recipients_entity_type_check
    CHECK (entity_type IN ('client', 'lead', 'campaigner', 'manual', 'wa_group'));

-- Index for fast lookup by group_chat_id within a broadcast
CREATE INDEX IF NOT EXISTS idx_br_group_chat_id
  ON public.broadcast_recipients(broadcast_id, group_chat_id)
  WHERE group_chat_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Unique constraint: one row per group per broadcast
--    (mirrors the existing uq_br_broadcast_phone for individual contacts)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_br_broadcast_group
  ON public.broadcast_recipients(broadcast_id, group_chat_id)
  WHERE group_chat_id IS NOT NULL;

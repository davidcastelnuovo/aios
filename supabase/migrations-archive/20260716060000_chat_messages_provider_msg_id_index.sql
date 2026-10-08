-- Fix: system-wide slowdown/freeze caused by the WhatsApp webhook dedup query.
--
-- green-api-webhook checks every inbound message for duplicates with:
--   select id from chat_messages
--   where tenant_id = ... and connection_user_id = ...
--     and raw_provider_data->>'idMessage' = ...
--
-- There was no index on the JSONB expression, so each check scanned the
-- 359MB chat_messages table (~2.3s mean, 24k+ calls — ~15 hours of
-- accumulated DB time), saturating Postgres and pushing user-facing
-- queries into statement timeouts (the "frozen system" symptom).
--
-- Applied to prod live with CREATE INDEX CONCURRENTLY on 2026-07-16;
-- IF NOT EXISTS makes this a no-op there. After the index, the same
-- lookup runs in ~3ms.

CREATE INDEX IF NOT EXISTS idx_chat_messages_provider_msg_id
ON public.chat_messages ((raw_provider_data->>'idMessage'))
WHERE (raw_provider_data->>'idMessage') IS NOT NULL;

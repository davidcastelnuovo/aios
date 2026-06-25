-- Prevent duplicate active Carmen WhatsApp sessions for the same chat.
--
-- Root cause of the duplicates: findActiveCarmenSession used to filter on `phone`
-- (derived from the chat id) while the session row stored the individual sender's
-- phone — in groups these never matched, so every inbound message opened a fresh
-- "active" session. The lookup is now keyed on chat_id only; this index is the
-- database-level backstop that makes a duplicate physically impossible even under
-- concurrent webhook invocations (the create path catches 23505 and defers to the
-- existing session).
--
-- Scope: one active session per (tenant, connection user, chat). Ended/expired
-- rows are unconstrained, so history is preserved.

CREATE UNIQUE INDEX IF NOT EXISTS carmen_sessions_one_active_per_chat
  ON public.carmen_whatsapp_sessions (tenant_id, connection_user_id, chat_id)
  WHERE status = 'active';

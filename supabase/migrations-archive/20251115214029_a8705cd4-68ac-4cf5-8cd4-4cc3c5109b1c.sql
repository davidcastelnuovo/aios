-- Allow client_id to be NULL so we can send messages to leads
ALTER TABLE chat_messages 
ALTER COLUMN client_id DROP NOT NULL;

-- Verify RLS policies allow INSERT with NULL client_id
-- The existing policies should already handle this correctly since they check for lead_id OR client_id
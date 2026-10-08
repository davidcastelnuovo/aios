-- Add manychat_subscriber_id to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS manychat_subscriber_id TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_leads_manychat_subscriber 
ON leads(manychat_subscriber_id);

-- Add comment
COMMENT ON COLUMN leads.manychat_subscriber_id IS 'ManyChat subscriber ID for WhatsApp integration';

-- Add lead_id to chat_messages table
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE CASCADE;

-- Add constraint: must have either client_id OR lead_id
ALTER TABLE chat_messages 
ADD CONSTRAINT chat_messages_contact_check 
CHECK (
  (client_id IS NOT NULL AND lead_id IS NULL) OR 
  (client_id IS NULL AND lead_id IS NOT NULL)
);

-- Add index
CREATE INDEX IF NOT EXISTS idx_chat_messages_lead_id 
ON chat_messages(lead_id);

COMMENT ON COLUMN chat_messages.lead_id IS 'Lead ID if message is associated with a lead';
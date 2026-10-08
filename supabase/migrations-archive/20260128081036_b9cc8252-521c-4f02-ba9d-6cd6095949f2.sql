-- Add new trigger type: inbound_webhook_lead
ALTER TYPE automation_trigger ADD VALUE IF NOT EXISTS 'inbound_webhook_lead';

-- Add new action type: create_lead
ALTER TYPE automation_action ADD VALUE IF NOT EXISTS 'create_lead';
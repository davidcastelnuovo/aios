-- Add new action types to automation_action enum
ALTER TYPE automation_action ADD VALUE IF NOT EXISTS 'send_greenapi_message';
ALTER TYPE automation_action ADD VALUE IF NOT EXISTS 'add_lead_update';
ALTER TYPE automation_action ADD VALUE IF NOT EXISTS 'add_client_update';
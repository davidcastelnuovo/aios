-- Add new trigger type and action type to enums
ALTER TYPE automation_trigger ADD VALUE IF NOT EXISTS 'meeting_created';
ALTER TYPE automation_action ADD VALUE IF NOT EXISTS 'send_whatsapp';
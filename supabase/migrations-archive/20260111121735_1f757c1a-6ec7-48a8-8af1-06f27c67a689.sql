-- Add new trigger type for inbound task webhook
ALTER TYPE automation_trigger ADD VALUE IF NOT EXISTS 'inbound_webhook_task';

-- Add new action type for creating a task
ALTER TYPE automation_action ADD VALUE IF NOT EXISTS 'create_task';
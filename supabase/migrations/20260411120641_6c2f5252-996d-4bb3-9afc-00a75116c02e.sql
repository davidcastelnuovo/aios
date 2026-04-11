ALTER TYPE public.automation_action ADD VALUE IF NOT EXISTS 'send_telegram';
ALTER TYPE public.automation_trigger ADD VALUE IF NOT EXISTS 'telegram_message_received';
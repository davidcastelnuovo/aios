-- Allow automations to send through the official Meta WhatsApp Cloud API connection.
ALTER TYPE public.automation_action ADD VALUE IF NOT EXISTS 'send_meta_whatsapp_message';

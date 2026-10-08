-- Add new automation action type for sending WhatsApp to campaigner
ALTER TYPE automation_action ADD VALUE IF NOT EXISTS 'send_greenapi_to_campaigner';
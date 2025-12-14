-- Add missing values to lead_status enum
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'meeting_scheduled';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'negotiation';
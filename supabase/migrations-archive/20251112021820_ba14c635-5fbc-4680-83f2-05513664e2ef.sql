-- Add "in_progress" value to lead_response_status enum
ALTER TYPE lead_response_status ADD VALUE IF NOT EXISTS 'in_progress';
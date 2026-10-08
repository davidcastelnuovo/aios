-- Update lead_status enum to match new pipeline stages
ALTER TYPE lead_status RENAME TO lead_status_old;

CREATE TYPE lead_status AS ENUM (
  'new',
  'contacted',
  'follow_up',
  'proposal_sent',
  'closed'
);

-- Update existing leads table to use new enum
ALTER TABLE leads 
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE leads 
  ALTER COLUMN status TYPE lead_status 
  USING (
    CASE status::text
      WHEN 'new' THEN 'new'::lead_status
      WHEN 'contacted' THEN 'contacted'::lead_status
      WHEN 'meeting_scheduled' THEN 'follow_up'::lead_status
      WHEN 'proposal_sent' THEN 'proposal_sent'::lead_status
      WHEN 'negotiation' THEN 'proposal_sent'::lead_status
      WHEN 'won' THEN 'closed'::lead_status
      WHEN 'lost' THEN 'closed'::lead_status
      ELSE 'new'::lead_status
    END
  );

ALTER TABLE leads 
  ALTER COLUMN status SET DEFAULT 'new'::lead_status;

DROP TYPE lead_status_old;
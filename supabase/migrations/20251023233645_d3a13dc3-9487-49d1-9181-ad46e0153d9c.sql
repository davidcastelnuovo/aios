-- Create enum for lead response status
CREATE TYPE lead_response_status AS ENUM (
  'no_answer_1',
  'no_answer_2', 
  'no_answer_3',
  'no_answer_4',
  'denies_contact',
  'not_relevant'
);

-- Add new response_status column
ALTER TABLE leads ADD COLUMN response_status lead_response_status;

-- Add comment to clarify the distinction
COMMENT ON COLUMN leads.status IS 'Pipeline stage (שלב במשפך)';
COMMENT ON COLUMN leads.response_status IS 'Lead response status (סטטוס תגובה)';
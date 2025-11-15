-- Add automation_trigger_name column to manychat_templates
ALTER TABLE public.manychat_templates 
ADD COLUMN automation_trigger_name text;

-- Add comment for documentation
COMMENT ON COLUMN public.manychat_templates.automation_trigger_name IS 'The trigger name of the ManyChat automation that sends this template';
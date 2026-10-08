-- Add payment field to client_team for tracking payments to campaigners
ALTER TABLE public.client_team
ADD COLUMN campaigner_payment numeric DEFAULT 0;
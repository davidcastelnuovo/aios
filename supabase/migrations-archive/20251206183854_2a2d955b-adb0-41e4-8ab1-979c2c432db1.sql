-- Create enum for client mood status
CREATE TYPE public.client_mood_status AS ENUM ('happy', 'wavering', 'churn_risk');

-- Add mood_status column to clients table
ALTER TABLE public.clients 
ADD COLUMN mood_status public.client_mood_status DEFAULT 'happy';
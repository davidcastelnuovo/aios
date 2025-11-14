-- Add is_premium field to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

-- Set marketingcaptain as premium
UPDATE public.tenants SET is_premium = true WHERE slug = 'marketingcaptain';
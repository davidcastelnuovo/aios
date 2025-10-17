-- Add 'owner' role to the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
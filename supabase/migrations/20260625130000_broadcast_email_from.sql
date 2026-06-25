-- Broadcast email: optional custom From identity + Reply-To.
-- from_email MUST be on a Resend-verified domain; reply_to can be any address.
-- When null, send-resend-email falls back to its default (noreply@aios.co.il).
ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS from_email TEXT,
  ADD COLUMN IF NOT EXISTS from_name TEXT,
  ADD COLUMN IF NOT EXISTS reply_to TEXT;

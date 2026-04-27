-- Close the stuck Carmen session that's been active for 12 days
UPDATE public.carmen_whatsapp_sessions
SET status = 'ended',
    ended_at = now()
WHERE id = '08951205-9681-46df-9e5b-57300ddbb94f'
  AND status = 'active';

-- Also auto-end any other Carmen sessions that have been inactive for over 60 minutes
UPDATE public.carmen_whatsapp_sessions
SET status = 'expired',
    ended_at = now()
WHERE status = 'active'
  AND COALESCE(last_message_at, created_at) < now() - interval '60 minutes';
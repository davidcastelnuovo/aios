-- Emergency: clear stuck ManyChat send locks after a failed deploy or crash mid-send.
-- Safe to run anytime — only removes in-flight lock rows (no lead data).

DELETE FROM public.manychat_destination_send_locks;

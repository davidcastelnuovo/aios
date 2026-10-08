-- Enable realtime for user_permissions table
ALTER TABLE public.user_permissions REPLICA IDENTITY FULL;

-- Add user_permissions to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_permissions;
-- Enable realtime for profile-related tables
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.client_team REPLICA IDENTITY FULL;
ALTER TABLE public.campaigner_agencies REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_team;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigner_agencies;
-- Enable realtime for dashboard tables
ALTER TABLE public.clients REPLICA IDENTITY FULL;
ALTER TABLE public.agencies REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.finance REPLICA IDENTITY FULL;
ALTER TABLE public.campaigners REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agencies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.finance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigners;
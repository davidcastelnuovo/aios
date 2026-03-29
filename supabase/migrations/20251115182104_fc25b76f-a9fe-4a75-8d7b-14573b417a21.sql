-- Create function to call auto-sync edge function for new leads
CREATE OR REPLACE FUNCTION public.trigger_auto_sync_new_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process if manychat_subscriber_id is NULL and phone is present
  IF NEW.manychat_subscriber_id IS NULL AND NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    -- Call the edge function asynchronously using pg_net
    -- Using the project's Supabase URL and anon key directly
    PERFORM net.http_post(
      url := 'https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/auto-sync-new-lead',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impuemd1aXNha2R0Y29sbHhtZ3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTcxNTcsImV4cCI6MjA3NjEzMzE1N30.VrxuppQtj-cByA2ml2krzwoM1rHwelXIr0f5D3eP4KM'
      ),
      body := jsonb_build_object('lead_id', NEW.id)
    );
    
    RAISE LOG 'Auto-sync triggered for lead: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on leads table
DROP TRIGGER IF EXISTS auto_sync_new_lead_trigger ON public.leads;

CREATE TRIGGER auto_sync_new_lead_trigger
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_sync_new_lead();
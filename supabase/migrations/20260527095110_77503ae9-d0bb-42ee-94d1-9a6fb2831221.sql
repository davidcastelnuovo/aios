-- Function to fire automation trigger when an integration becomes disconnected
CREATE OR REPLACE FUNCTION public.trigger_integration_disconnected()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_needs_reauth boolean;
  new_needs_reauth boolean;
  last_trigger_at timestamptz;
  integration_label text;
  payload_body jsonb;
BEGIN
  -- Extract needs_reauth flags from old + new settings
  old_needs_reauth := COALESCE((OLD.settings->>'needs_reauth')::boolean, false);
  new_needs_reauth := COALESCE((NEW.settings->>'needs_reauth')::boolean, false);

  -- Only fire on transition false -> true
  IF NOT (new_needs_reauth = true AND old_needs_reauth = false) THEN
    RETURN NEW;
  END IF;

  -- Anti-spam: skip if a disconnect was already announced in the last 24h
  last_trigger_at := (NEW.settings->>'last_disconnect_trigger_at')::timestamptz;
  IF last_trigger_at IS NOT NULL AND last_trigger_at > now() - interval '24 hours' THEN
    RETURN NEW;
  END IF;

  -- Friendly label per integration type
  integration_label := CASE NEW.integration_type
    WHEN 'google_analytics' THEN 'Google Analytics'
    WHEN 'google_search_console' THEN 'Google Search Console'
    WHEN 'google_ads' THEN 'Google Ads'
    WHEN 'google_calendar' THEN 'Google Calendar'
    WHEN 'gmail' THEN 'Gmail'
    WHEN 'facebook' THEN 'Facebook'
    WHEN 'meta_ads' THEN 'Meta Ads'
    WHEN 'ahrefs' THEN 'Ahrefs'
    WHEN 'green_api' THEN 'WhatsApp (Green API)'
    WHEN 'manychat' THEN 'ManyChat'
    WHEN 'telegram' THEN 'Telegram'
    ELSE COALESCE(NEW.integration_type, 'אינטגרציה')
  END;

  payload_body := jsonb_build_object(
    'trigger_type', 'integration_disconnected',
    'tenant_id', NEW.tenant_id,
    'data', jsonb_build_object(
      'integration_id', NEW.id,
      'integration_type', NEW.integration_type,
      'integration_name', integration_label,
      'last_error', NEW.settings->>'last_auth_error',
      'last_error_at', NEW.settings->>'last_auth_error_at',
      'disconnected_at', now()
    )
  );

  -- Fire trigger-automation edge function asynchronously
  PERFORM net.http_post(
    url := 'https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/trigger-automation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impuemd1aXNha2R0Y29sbHhtZ3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTcxNTcsImV4cCI6MjA3NjEzMzE1N30.VrxuppQtj-cByA2ml2krzwoM1rHwelXIr0f5D3eP4KM'
    ),
    body := payload_body
  );

  -- Stamp the trigger time to prevent spam
  NEW.settings := COALESCE(NEW.settings, '{}'::jsonb)
    || jsonb_build_object('last_disconnect_trigger_at', now());

  RAISE LOG 'Integration disconnect trigger fired: tenant=% integration=%', NEW.tenant_id, NEW.integration_type;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_integration_disconnected ON public.tenant_integrations;

CREATE TRIGGER on_integration_disconnected
  BEFORE UPDATE ON public.tenant_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_integration_disconnected();
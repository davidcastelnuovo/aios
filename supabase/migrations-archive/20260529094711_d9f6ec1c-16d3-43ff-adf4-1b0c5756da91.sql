-- Trigger: fire 'ad_account_blocked' automation when Facebook ad account becomes blocked
-- account_status values written by sync-facebook-insights:
--   active, disabled, unsettled, pending_risk_review, pending_settlement, closed, unknown_*

CREATE OR REPLACE FUNCTION public.trigger_ad_account_blocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_status text;
  new_status text;
  last_trigger_at timestamptz;
  payload_body jsonb;
  blocked_statuses text[] := ARRAY['disabled','unsettled','pending_risk_review','pending_settlement','closed'];
BEGIN
  old_status := OLD.integration_settings->>'account_status';
  new_status := NEW.integration_settings->>'account_status';

  -- Only fire when new status is a blocked one AND it changed
  IF new_status IS NULL OR NOT (new_status = ANY(blocked_statuses)) THEN
    RETURN NEW;
  END IF;

  IF old_status IS NOT DISTINCT FROM new_status THEN
    RETURN NEW;
  END IF;

  -- Anti-spam: 24h cooldown per table
  last_trigger_at := (NEW.integration_settings->>'last_blocked_trigger_at')::timestamptz;
  IF last_trigger_at IS NOT NULL AND last_trigger_at > now() - interval '24 hours' THEN
    RETURN NEW;
  END IF;

  payload_body := jsonb_build_object(
    'trigger_type', 'ad_account_blocked',
    'tenant_id', NEW.tenant_id,
    'data', jsonb_build_object(
      'table_id', NEW.id,
      'table_name', NEW.name,
      'integration_type', NEW.integration_type,
      'ad_account_id', NEW.integration_settings->>'ad_account_id',
      'account_status', new_status,
      'previous_status', old_status,
      'disable_reason', NEW.integration_settings->>'account_disable_reason',
      'blocked_at', now()
    )
  );

  PERFORM net.http_post(
    url := 'https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/trigger-automation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impuemd1aXNha2R0Y29sbHhtZ3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTcxNTcsImV4cCI6MjA3NjEzMzE1N30.VrxuppQtj-cByA2ml2krzwoM1rHwelXIr0f5D3eP4KM'
    ),
    body := payload_body
  );

  NEW.integration_settings := COALESCE(NEW.integration_settings, '{}'::jsonb)
    || jsonb_build_object('last_blocked_trigger_at', now());

  RAISE LOG 'Ad account blocked trigger fired: tenant=% table=% status=%', NEW.tenant_id, NEW.id, new_status;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_ad_account_blocked ON public.crm_tables;

CREATE TRIGGER on_ad_account_blocked
  BEFORE UPDATE ON public.crm_tables
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_ad_account_blocked();
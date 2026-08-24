-- Persist client mood / satisfaction changes in client_updates history.
-- The Updates tab reads client_updates; mood_status was only written to clients
-- (and best-effort communication_logs), so changes from the client card, edit
-- dialog, CRM chat, or bulk actions left no audit trail in the history feed.

CREATE OR REPLACE FUNCTION public.format_client_mood_status_label(status public.client_mood_status)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN status IS NULL THEN 'לא הוגדר'
    WHEN status = 'happy'::public.client_mood_status THEN '😊 מבסוט / תקין'
    WHEN status = 'wavering'::public.client_mood_status THEN '😐 מתנדנד / רגיש'
    WHEN status = 'churn_risk'::public.client_mood_status THEN '😟 סכנת נטישה / תלונה'
    WHEN status = 'not_progressing'::public.client_mood_status THEN '😔 לא מתקדם'
    ELSE status::text
  END;
$$;

CREATE OR REPLACE FUNCTION public.log_client_mood_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  actor uuid := auth.uid();
  old_label text;
  new_label text;
  body text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.mood_status IS NOT DISTINCT FROM OLD.mood_status THEN
    RETURN NEW;
  END IF;

  -- Skip system/service-role writes with no authenticated actor.
  IF actor IS NULL THEN
    RETURN NEW;
  END IF;

  old_label := public.format_client_mood_status_label(OLD.mood_status);
  new_label := public.format_client_mood_status_label(NEW.mood_status);

  IF OLD.mood_status IS NULL THEN
    body := 'עודכנה שביעות רצון: ' || new_label;
  ELSE
    body := 'שביעות רצון: ' || old_label || ' → ' || new_label;
  END IF;

  INSERT INTO public.client_updates (
    client_id,
    tenant_id,
    user_id,
    content,
    update_type
  ) VALUES (
    NEW.id,
    NEW.tenant_id,
    actor,
    body,
    'mood_status'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_client_mood_status_change ON public.clients;
CREATE TRIGGER trg_log_client_mood_status_change
  AFTER UPDATE OF mood_status ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.log_client_mood_status_change();

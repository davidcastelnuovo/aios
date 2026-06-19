CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_campaigner record;
  v_client_name text;
  v_payload jsonb;
  v_actor_user_id uuid;
  v_actor_campaigner_id uuid;
BEGIN
  IF NEW.campaigner_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.campaigner_id IS NOT DISTINCT FROM NEW.campaigner_id THEN
    RETURN NEW;
  END IF;

  -- Skip self-assignment: if the actor (auth.uid or created_by) maps to the same campaigner
  v_actor_user_id := COALESCE(auth.uid(), NEW.created_by);
  IF v_actor_user_id IS NOT NULL THEN
    v_actor_campaigner_id := public.get_user_campaigner_id(v_actor_user_id);
    IF v_actor_campaigner_id IS NOT NULL
       AND v_actor_campaigner_id = NEW.campaigner_id THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT full_name, phone, whatsapp_group_id
    INTO v_campaigner
    FROM public.campaigners
    WHERE id = NEW.campaigner_id;

  IF NEW.client_id IS NOT NULL THEN
    SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
  END IF;

  v_url := 'https://jnzguisakdtcollxmgzd.supabase.co';

  v_payload := jsonb_build_object(
    'trigger_type', 'task_assigned',
    'tenant_id', NEW.tenant_id,
    'data', jsonb_build_object(
      'task_id', NEW.id,
      'task_title', NEW.title,
      'task_notes', COALESCE(NEW.notes, ''),
      'campaigner_id', NEW.campaigner_id,
      'campaigner_name', COALESCE(v_campaigner.full_name, ''),
      'campaigner_phone', COALESCE(v_campaigner.phone, ''),
      'campaigner_whatsapp_group_id', COALESCE(v_campaigner.whatsapp_group_id, ''),
      'client_name', COALESCE(v_client_name, ''),
      'priority', NEW.priority,
      'status', NEW.status,
      'due_date', COALESCE(NEW.due_date::text, ''),
      'tasks_link', 'https://after-lead.com/tasks'
    )
  );

  PERFORM net.http_post(
    url := v_url || '/functions/v1/trigger-automation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impuemd1aXNha2R0Y29sbHhtZ3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTcxNTcsImV4cCI6MjA3NjEzMzE1N30.VrxuppQtj-cByA2ml2krzwoM1rHwelXIr0f5D3eP4KM'
    ),
    body := v_payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_task_assigned failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
-- Human tasks can repeat after completion while preserving each completed occurrence.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_frequency text,
  ADD COLUMN IF NOT EXISTS recurrence_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_series_id uuid,
  ADD COLUMN IF NOT EXISTS recurrence_previous_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_recurrence_frequency_check,
  ADD CONSTRAINT tasks_recurrence_frequency_check
    CHECK (recurrence_frequency IS NULL OR recurrence_frequency IN ('daily', 'weekly', 'monthly')),
  DROP CONSTRAINT IF EXISTS tasks_recurrence_interval_check,
  ADD CONSTRAINT tasks_recurrence_interval_check
    CHECK (recurrence_interval > 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_recurrence_previous_unique
  ON public.tasks (recurrence_previous_task_id)
  WHERE recurrence_previous_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_series
  ON public.tasks (recurrence_series_id)
  WHERE recurrence_series_id IS NOT NULL;

COMMENT ON COLUMN public.tasks.recurrence_frequency IS
  'Completion-based recurrence: daily, weekly, monthly, or null for a one-time task.';
COMMENT ON COLUMN public.tasks.recurrence_interval IS
  'Number of recurrence periods between task occurrences.';
COMMENT ON COLUMN public.tasks.recurrence_series_id IS
  'Stable identifier shared by all occurrences in a recurring task series.';
COMMENT ON COLUMN public.tasks.recurrence_previous_task_id IS
  'The completed occurrence that generated this task; unique to make generation idempotent.';

CREATE OR REPLACE FUNCTION public.next_task_recurrence_date(
  base_date date,
  frequency text,
  frequency_interval integer,
  as_of_date date DEFAULT CURRENT_DATE
)
RETURNS date
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  candidate date := COALESCE(base_date, as_of_date);
  step_interval interval;
BEGIN
  step_interval := CASE frequency
    WHEN 'daily' THEN make_interval(days => frequency_interval)
    WHEN 'weekly' THEN make_interval(days => 7 * frequency_interval)
    WHEN 'monthly' THEN make_interval(months => frequency_interval)
    ELSE NULL
  END;

  IF step_interval IS NULL THEN
    RETURN NULL;
  END IF;

  candidate := (candidate + step_interval)::date;
  WHILE candidate <= as_of_date LOOP
    candidate := (candidate + step_interval)::date;
  END LOOP;

  RETURN candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.next_task_recurrence_date(date, text, integer, date)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_next_recurring_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_task_id uuid;
  next_due_date date;
  next_target_date date;
  series_id uuid;
BEGIN
  IF OLD.status IS DISTINCT FROM 'done'
     AND NEW.status = 'done'
     AND NEW.recurrence_frequency IS NOT NULL THEN
    next_due_date := public.next_task_recurrence_date(
      NEW.due_date,
      NEW.recurrence_frequency,
      NEW.recurrence_interval
    );
    next_target_date := CASE
      WHEN NEW.target_date IS NULL THEN NULL
      ELSE public.next_task_recurrence_date(
        NEW.target_date,
        NEW.recurrence_frequency,
        NEW.recurrence_interval
      )
    END;
    series_id := COALESCE(NEW.recurrence_series_id, NEW.id);

    INSERT INTO public.tasks (
      title,
      task_type,
      agency_id,
      client_id,
      lead_id,
      campaigner_id,
      sales_person_id,
      due_date,
      due_time,
      target_date,
      status,
      priority,
      notes,
      tenant_id,
      created_by,
      duration_minutes,
      sort_order,
      attachments,
      goal_id,
      assigned_agent,
      recurrence_frequency,
      recurrence_interval,
      recurrence_series_id,
      recurrence_previous_task_id
    )
    VALUES (
      NEW.title,
      NEW.task_type,
      NEW.agency_id,
      NEW.client_id,
      NEW.lead_id,
      NEW.campaigner_id,
      NEW.sales_person_id,
      next_due_date,
      NEW.due_time,
      next_target_date,
      'open',
      NEW.priority,
      NEW.notes,
      NEW.tenant_id,
      NEW.created_by,
      NEW.duration_minutes,
      NEW.sort_order,
      NEW.attachments,
      NEW.goal_id,
      NEW.assigned_agent,
      NEW.recurrence_frequency,
      NEW.recurrence_interval,
      series_id,
      NEW.id
    )
    ON CONFLICT (recurrence_previous_task_id) WHERE recurrence_previous_task_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO next_task_id;

    IF next_task_id IS NOT NULL THEN
      INSERT INTO public.task_collaborators (
        task_id,
        campaigner_id,
        tenant_id,
        added_by
      )
      SELECT
        next_task_id,
        campaigner_id,
        tenant_id,
        added_by
      FROM public.task_collaborators
      WHERE task_id = NEW.id
      ON CONFLICT (task_id, campaigner_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_next_recurring_task()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_create_next_recurring_task ON public.tasks;
CREATE TRIGGER trg_create_next_recurring_task
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.create_next_recurring_task();

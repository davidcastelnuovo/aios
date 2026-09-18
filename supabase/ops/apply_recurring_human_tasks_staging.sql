-- Staging apply for recurring human tasks + checklist subtasks.
-- Mirrors supabase/migrations/20260918093000_add_recurring_tasks.sql and
-- supabase/migrations/20260918100000_recurring_day_time_and_checklist.sql.
-- Idempotent: safe to re-run.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_frequency text,
  ADD COLUMN IF NOT EXISTS recurrence_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_series_id uuid,
  ADD COLUMN IF NOT EXISTS recurrence_previous_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurrence_weekday integer,
  ADD COLUMN IF NOT EXISTS recurrence_monthday integer;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_recurrence_frequency_check,
  ADD CONSTRAINT tasks_recurrence_frequency_check
    CHECK (recurrence_frequency IS NULL OR recurrence_frequency IN ('daily', 'weekly', 'monthly')),
  DROP CONSTRAINT IF EXISTS tasks_recurrence_interval_check,
  ADD CONSTRAINT tasks_recurrence_interval_check
    CHECK (recurrence_interval > 0),
  DROP CONSTRAINT IF EXISTS tasks_recurrence_weekday_check,
  ADD CONSTRAINT tasks_recurrence_weekday_check
    CHECK (recurrence_weekday IS NULL OR recurrence_weekday BETWEEN 0 AND 6),
  DROP CONSTRAINT IF EXISTS tasks_recurrence_monthday_check,
  ADD CONSTRAINT tasks_recurrence_monthday_check
    CHECK (recurrence_monthday IS NULL OR recurrence_monthday BETWEEN 1 AND 31);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_recurrence_previous_unique
  ON public.tasks (recurrence_previous_task_id)
  WHERE recurrence_previous_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_series
  ON public.tasks (recurrence_series_id)
  WHERE recurrence_series_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.next_task_recurrence_date(date, text, integer, date);

CREATE OR REPLACE FUNCTION public.next_task_recurrence_date(
  base_date date,
  frequency text,
  frequency_interval integer,
  as_of_date date DEFAULT CURRENT_DATE,
  weekday integer DEFAULT NULL,
  monthday integer DEFAULT NULL
)
RETURNS date
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  candidate date := COALESCE(base_date, as_of_date);
  step_days integer;
  target_weekday integer;
  target_monthday integer;
  last_day integer;
BEGIN
  IF frequency IS NULL OR frequency_interval IS NULL OR frequency_interval < 1 THEN
    RETURN NULL;
  END IF;

  IF frequency = 'daily' THEN
    candidate := (candidate + make_interval(days => frequency_interval))::date;
    WHILE candidate <= as_of_date LOOP
      candidate := (candidate + make_interval(days => frequency_interval))::date;
    END LOOP;
    RETURN candidate;
  END IF;

  IF frequency = 'weekly' THEN
    target_weekday := COALESCE(weekday, EXTRACT(DOW FROM candidate)::integer);
    candidate := (candidate + make_interval(days => 7 * frequency_interval))::date;
    step_days := ((target_weekday - EXTRACT(DOW FROM candidate)::integer) + 7) % 7;
    candidate := (candidate + make_interval(days => step_days))::date;
    WHILE candidate <= as_of_date LOOP
      candidate := (candidate + make_interval(days => 7 * frequency_interval))::date;
    END LOOP;
    RETURN candidate;
  END IF;

  IF frequency = 'monthly' THEN
    target_monthday := COALESCE(monthday, EXTRACT(DAY FROM candidate)::integer);
    candidate := (date_trunc('month', candidate) + make_interval(months => frequency_interval))::date;
    last_day := EXTRACT(DAY FROM (date_trunc('month', candidate) + INTERVAL '1 month - 1 day'))::integer;
    candidate := (date_trunc('month', candidate) + make_interval(days => LEAST(target_monthday, last_day) - 1))::date;
    WHILE candidate <= as_of_date LOOP
      candidate := (date_trunc('month', candidate) + make_interval(months => frequency_interval))::date;
      last_day := EXTRACT(DAY FROM (date_trunc('month', candidate) + INTERVAL '1 month - 1 day'))::integer;
      candidate := (date_trunc('month', candidate) + make_interval(days => LEAST(target_monthday, last_day) - 1))::date;
    END LOOP;
    RETURN candidate;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.next_task_recurrence_date(date, text, integer, date, integer, integer)
  FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_task_checklist_items_task_id
  ON public.task_checklist_items (task_id, sort_order);

ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view checklist items in their tenant" ON public.task_checklist_items;
CREATE POLICY "Users can view checklist items in their tenant"
  ON public.task_checklist_items FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert checklist items in their tenant" ON public.task_checklist_items;
CREATE POLICY "Users can insert checklist items in their tenant"
  ON public.task_checklist_items FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update checklist items in their tenant" ON public.task_checklist_items;
CREATE POLICY "Users can update checklist items in their tenant"
  ON public.task_checklist_items FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete checklist items in their tenant" ON public.task_checklist_items;
CREATE POLICY "Users can delete checklist items in their tenant"
  ON public.task_checklist_items FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

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
      NEW.recurrence_interval,
      CURRENT_DATE,
      NEW.recurrence_weekday,
      NEW.recurrence_monthday
    );
    next_target_date := CASE
      WHEN NEW.target_date IS NULL THEN NULL
      ELSE public.next_task_recurrence_date(
        NEW.target_date,
        NEW.recurrence_frequency,
        NEW.recurrence_interval,
        CURRENT_DATE,
        NEW.recurrence_weekday,
        NEW.recurrence_monthday
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
      recurrence_weekday,
      recurrence_monthday,
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
      NEW.recurrence_weekday,
      NEW.recurrence_monthday,
      series_id,
      NEW.id
    )
    ON CONFLICT (recurrence_previous_task_id) WHERE recurrence_previous_task_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO next_task_id;

    IF next_task_id IS NOT NULL THEN
      INSERT INTO public.task_checklist_items (
        task_id,
        tenant_id,
        title,
        is_done,
        sort_order,
        created_by
      )
      SELECT
        next_task_id,
        tenant_id,
        title,
        false,
        sort_order,
        created_by
      FROM public.task_checklist_items
      WHERE task_id = NEW.id;
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

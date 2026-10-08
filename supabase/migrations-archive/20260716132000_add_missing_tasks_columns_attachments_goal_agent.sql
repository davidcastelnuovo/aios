-- Applied live to prod on 2026-07-16 (MCP migration: add_missing_tasks_columns_attachments_goal_agent).
--
-- Repo migrations 20260513135134 (tasks.attachments) and 20260408013942
-- (tasks.goal_id / tasks.assigned_agent, task_updates.update_type) were never
-- applied to the production DB. TaskDetailDialog sends `attachments` in every
-- task UPDATE, so any save from the task dialog — including changing the due
-- date — failed with PGRST204 (column not found in schema cache).
--
-- goals existed on prod without a primary key, so the goal_id FK could not
-- attach; the table was empty, so the PK is added directly.

ALTER TABLE public.goals ADD CONSTRAINT goals_pkey PRIMARY KEY (id);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_agent TEXT;

ALTER TABLE public.task_updates ADD COLUMN IF NOT EXISTS update_type TEXT NOT NULL DEFAULT 'comment';

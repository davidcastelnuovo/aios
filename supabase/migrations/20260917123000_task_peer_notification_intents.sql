-- Carmen task peer notifications: adding a campaigner to a task, and posting
-- an update on someone else's task, are first-class automation intents.
ALTER TYPE public.automation_trigger ADD VALUE IF NOT EXISTS 'task_collaborator_added';
ALTER TYPE public.automation_trigger ADD VALUE IF NOT EXISTS 'task_update_added';

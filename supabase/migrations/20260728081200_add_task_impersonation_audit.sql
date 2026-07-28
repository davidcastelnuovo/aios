ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS impersonated_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.tasks.impersonated_by IS
  'Authenticated super-admin who created the task while viewing as another user. created_by remains the effective business actor.';


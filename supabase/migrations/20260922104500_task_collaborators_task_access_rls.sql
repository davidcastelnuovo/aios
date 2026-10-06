-- Align task_collaborators RLS with task visibility (cross-tenant agency / assignee access).
-- Fixes hidden collaborator rows and failed adds when tenant_id on rows did not match the parent task.

DROP POLICY IF EXISTS "Users can view collaborators in their tenant" ON public.task_collaborators;
DROP POLICY IF EXISTS "Users can add collaborators in their tenant" ON public.task_collaborators;
DROP POLICY IF EXISTS "Users can remove collaborators in their tenant" ON public.task_collaborators;

CREATE POLICY "Users can view collaborators for accessible tasks"
ON public.task_collaborators
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_collaborators.task_id
  )
);

CREATE POLICY "Users can add collaborators on accessible tasks"
ON public.task_collaborators
FOR INSERT
WITH CHECK (
  tenant_id = (SELECT t.tenant_id FROM public.tasks t WHERE t.id = task_id)
  AND EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_id
  )
);

CREATE POLICY "Users can remove collaborators on accessible tasks"
ON public.task_collaborators
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_collaborators.task_id
  )
);

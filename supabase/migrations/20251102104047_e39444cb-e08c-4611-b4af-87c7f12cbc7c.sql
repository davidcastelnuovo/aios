-- Drop existing team manager policies for tasks
DROP POLICY IF EXISTS "Team managers can manage tasks from managed agencies" ON public.tasks;
DROP POLICY IF EXISTS "Team managers can view tasks from managed agencies" ON public.tasks;

-- Create new policies that check BOTH task agency_id AND client's agency_id
CREATE POLICY "Team managers can view tasks from managed agencies"
ON public.tasks
FOR SELECT
USING (
  is_super_admin(auth.uid()) OR (
    (tenant_id = get_user_tenant_id(auth.uid())) 
    AND has_role(auth.uid(), 'team_manager'::app_role) 
    AND (
      -- Check if task's agency is managed by user
      user_manages_agency(auth.uid(), agency_id)
      OR
      -- OR check if client's agency is managed by user (when client exists)
      (
        client_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.clients c 
          WHERE c.id = tasks.client_id 
          AND user_manages_agency(auth.uid(), c.agency_id)
        )
      )
    )
  )
);

CREATE POLICY "Team managers can manage tasks from managed agencies"
ON public.tasks
FOR ALL
USING (
  is_super_admin(auth.uid()) OR (
    (tenant_id = get_user_tenant_id(auth.uid())) 
    AND has_role(auth.uid(), 'team_manager'::app_role) 
    AND (
      -- Check if task's agency is managed by user
      user_manages_agency(auth.uid(), agency_id)
      OR
      -- OR check if client's agency is managed by user (when client exists)
      (
        client_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.clients c 
          WHERE c.id = tasks.client_id 
          AND user_manages_agency(auth.uid(), c.agency_id)
        )
      )
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid()) OR (
    (tenant_id = get_user_tenant_id(auth.uid())) 
    AND has_role(auth.uid(), 'team_manager'::app_role) 
    AND (
      -- Check if task's agency is managed by user
      user_manages_agency(auth.uid(), agency_id)
      OR
      -- OR check if client's agency is managed by user (when client exists)
      (
        client_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.clients c 
          WHERE c.id = tasks.client_id 
          AND user_manages_agency(auth.uid(), c.agency_id)
        )
      )
    )
  )
);
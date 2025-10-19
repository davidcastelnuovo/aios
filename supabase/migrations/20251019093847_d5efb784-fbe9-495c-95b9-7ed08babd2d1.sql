-- Add RLS policies for owners to manage clients

-- Allow owners to insert clients
CREATE POLICY "Owners can insert clients" ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

-- Allow owners to delete clients
CREATE POLICY "Owners can delete clients" ON public.clients
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));

-- Allow owners to update clients
CREATE POLICY "Owners can update clients" ON public.clients
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));
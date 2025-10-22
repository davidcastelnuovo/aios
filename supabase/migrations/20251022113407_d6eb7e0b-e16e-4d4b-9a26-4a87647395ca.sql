-- Add RLS policies for user_managed_agencies table
CREATE POLICY "Owners can view all managed agencies" 
ON public.user_managed_agencies 
FOR SELECT 
USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Users can view their own managed agencies" 
ON public.user_managed_agencies 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Owners can insert managed agencies" 
ON public.user_managed_agencies 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can update managed agencies" 
ON public.user_managed_agencies 
FOR UPDATE 
USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can delete managed agencies" 
ON public.user_managed_agencies 
FOR DELETE 
USING (has_role(auth.uid(), 'owner'::app_role));
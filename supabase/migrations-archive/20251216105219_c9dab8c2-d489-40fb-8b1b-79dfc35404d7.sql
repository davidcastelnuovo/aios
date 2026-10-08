-- Add sales_person_id column to tasks table
ALTER TABLE public.tasks
ADD COLUMN sales_person_id uuid REFERENCES public.sales_people(id);

-- Create index for performance
CREATE INDEX idx_tasks_sales_person_id ON public.tasks(sales_person_id);
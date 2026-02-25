
ALTER TABLE public.one_time_incomes
ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
ADD COLUMN expense_amount NUMERIC NOT NULL DEFAULT 0;

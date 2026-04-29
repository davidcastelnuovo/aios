ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS monthly_fixed_expense numeric NOT NULL DEFAULT 0;

UPDATE public.clients SET monthly_fixed_expense = 850 WHERE is_seo_client = true AND monthly_fixed_expense = 0;

DELETE FROM public.finance 
WHERE category = 'הוצאות SEO' 
  AND notes LIKE '%רטרואקטיבי%';
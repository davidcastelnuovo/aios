-- Change role column from text to text array to support multiple roles
ALTER TABLE public.campaigners 
  ALTER COLUMN role TYPE text[] USING 
    CASE 
      WHEN role IS NULL THEN NULL
      WHEN role = '' THEN NULL
      ELSE ARRAY[role]
    END;
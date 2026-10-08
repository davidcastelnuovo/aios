-- מחיקת לידים כפולים לפי טלפון ושם חברה
-- השארת רק הליד המוקדם ביותר מכל קבוצה

WITH duplicates AS (
  SELECT 
    id,
    company_name,
    phone,
    ROW_NUMBER() OVER (
      PARTITION BY company_name, phone 
      ORDER BY created_at ASC, id ASC
    ) as row_num
  FROM leads
  WHERE phone IS NOT NULL 
    AND phone != '' 
    AND company_name IS NOT NULL 
    AND company_name != ''
)
DELETE FROM leads
WHERE id IN (
  SELECT id 
  FROM duplicates 
  WHERE row_num > 1
);
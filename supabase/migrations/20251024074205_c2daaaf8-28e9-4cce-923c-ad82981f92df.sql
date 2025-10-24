-- מחיקת לידים כפולים לפי מספר טלפון בלבד
-- השארת רק הליד המוקדם ביותר מכל מספר טלפון

WITH duplicates AS (
  SELECT 
    id,
    phone,
    ROW_NUMBER() OVER (
      PARTITION BY phone 
      ORDER BY created_at ASC, id ASC
    ) as row_num
  FROM leads
  WHERE phone IS NOT NULL 
    AND phone != ''
)
DELETE FROM leads
WHERE id IN (
  SELECT id 
  FROM duplicates 
  WHERE row_num > 1
);
-- העברת נתונים שאינם אימיילים מעמודת email לעמודת notes
-- ניקוי עמודת email מנתונים לא רלוונטיים

-- עדכון רשומות שבהן האימייל לא מכיל @ (לא אימייל אמיתי)
UPDATE leads
SET 
  notes = CASE 
    WHEN notes IS NULL OR notes = '' THEN 'ניסיון פרסום קודם: ' || email
    ELSE notes || E'\n' || 'ניסיון פרסום קודם: ' || email
  END,
  email = NULL
WHERE email IS NOT NULL 
  AND email != '' 
  AND email NOT LIKE '%@%';
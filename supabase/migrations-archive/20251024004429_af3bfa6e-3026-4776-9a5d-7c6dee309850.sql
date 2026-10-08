-- החלפת תאריכים בשדה company_name ב"לא צוין"
UPDATE leads 
SET company_name = 'לא צוין'
WHERE company_name ~ '^\d{4}-\d{2}-\d{2}' 
   OR company_name ~ '^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$';
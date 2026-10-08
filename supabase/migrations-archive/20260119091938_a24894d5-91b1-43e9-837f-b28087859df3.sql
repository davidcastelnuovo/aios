-- תיקון: קישור התפקיד owner של רחלי לארגון RealEasy
UPDATE user_roles 
SET tenant_id = '8a38496c-c000-44a0-848f-9833778faf70'
WHERE user_id = 'd40081ed-0ea3-4a47-b8c4-177d94f9b4b7' 
AND role = 'owner' 
AND tenant_id IS NULL;
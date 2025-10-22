-- Step 1: Reassign client_onboarding records from orphaned campaigners to a valid one
-- We'll reassign to the first valid campaigner (the one with id from profiles)
UPDATE client_onboarding
SET campaigner_id = (
  SELECT c.id 
  FROM campaigners c
  INNER JOIN profiles p ON p.campaigner_id = c.id
  LIMIT 1
)
WHERE campaigner_id IN (
  SELECT c.id 
  FROM campaigners c
  LEFT JOIN profiles p ON p.campaigner_id = c.id
  WHERE p.id IS NULL
);

-- Step 2: Delete campaigners that have no linked users
DELETE FROM campaigners 
WHERE id IN (
  SELECT c.id 
  FROM campaigners c
  LEFT JOIN profiles p ON p.campaigner_id = c.id
  WHERE p.id IS NULL
);
-- Change priority from enum to integer scale (1-10)
-- First, add a new temporary column
ALTER TABLE tasks ADD COLUMN priority_value integer;

-- Migrate existing data: high=8, medium=5, low=2
UPDATE tasks 
SET priority_value = CASE 
  WHEN priority = 'high' THEN 8
  WHEN priority = 'medium' THEN 5
  WHEN priority = 'low' THEN 2
  ELSE 5
END;

-- Make the new column not null with default of 5
ALTER TABLE tasks ALTER COLUMN priority_value SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN priority_value SET DEFAULT 5;

-- Add constraint to ensure values are between 1-10
ALTER TABLE tasks ADD CONSTRAINT priority_value_range CHECK (priority_value >= 1 AND priority_value <= 10);

-- Drop the old priority column
ALTER TABLE tasks DROP COLUMN priority;

-- Rename the new column to priority
ALTER TABLE tasks RENAME COLUMN priority_value TO priority;
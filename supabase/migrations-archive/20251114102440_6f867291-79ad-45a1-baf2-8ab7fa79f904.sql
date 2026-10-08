-- Force types refresh by temporarily adding and removing a column
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS _force_refresh boolean DEFAULT false;
ALTER TABLE user_roles DROP COLUMN IF EXISTS _force_refresh;
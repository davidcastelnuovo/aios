-- Make tracking_id nullable with a default so insert works without providing it
ALTER TABLE site_tracking_configs ALTER COLUMN tracking_id DROP NOT NULL;
ALTER TABLE site_tracking_configs ALTER COLUMN tracking_id SET DEFAULT '';
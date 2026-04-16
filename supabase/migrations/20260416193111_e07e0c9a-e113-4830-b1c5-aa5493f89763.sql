-- Remove duplicate facebook_ecommerce records for לידר table from 2026-04-16
-- Keep only one record per (date, campaign_id) combination
DELETE FROM crm_records
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY table_id, data->>'date', data->>'campaign_id'
      ORDER BY created_at ASC
    ) AS rn
    FROM crm_records
    WHERE table_id = 'bbbb71c3-30cd-4fcc-ab5e-70d925a566de'
  ) ranked
  WHERE rn > 1
);
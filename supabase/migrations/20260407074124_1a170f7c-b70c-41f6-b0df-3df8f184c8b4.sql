
-- Step 1: Delete duplicate ahrefs_reports, keeping the best one per (domain, report_date, report_type)
DELETE FROM ahrefs_reports 
WHERE id NOT IN (
  SELECT DISTINCT ON (domain, COALESCE(report_date, '1900-01-01'::date), report_type) id
  FROM ahrefs_reports
  ORDER BY domain, COALESCE(report_date, '1900-01-01'::date), report_type, client_id NULLS LAST, received_at DESC
);

-- Step 2: Create unique index for non-null report_date rows
CREATE UNIQUE INDEX idx_ahrefs_reports_unique_domain_date_type 
ON ahrefs_reports (domain, report_date, report_type) 
WHERE report_date IS NOT NULL;

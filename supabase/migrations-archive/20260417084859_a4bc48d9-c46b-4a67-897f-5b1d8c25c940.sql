UPDATE crm_tables ct
SET agency_id = c.agency_id,
    updated_at = now()
FROM clients c
WHERE ct.client_id = c.id
  AND ct.integration_type = 'google_ads'
  AND c.agency_id = '38cf0e62-1913-45cb-b917-88e421974fb1'
  AND (ct.agency_id IS NULL OR ct.agency_id != c.agency_id);
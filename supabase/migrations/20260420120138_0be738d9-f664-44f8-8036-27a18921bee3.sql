UPDATE crm_tables
SET integration_settings = jsonb_set(integration_settings, '{clientId}', '"15664961-dda4-4d23-b61e-a0341c7ab81b"')
WHERE id = 'ac94f064-b964-4714-876a-180692bca24b';
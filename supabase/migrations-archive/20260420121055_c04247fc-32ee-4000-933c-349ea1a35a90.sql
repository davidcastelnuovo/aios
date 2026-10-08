
UPDATE crm_tables
SET integration_settings = jsonb_set(integration_settings, '{clientId}', '"ff148805-6b5e-4223-927d-1ef8fd7a5e75"')
WHERE id = '9416e40c-b7b8-4a3b-8c86-a77f7b74b3f3';

UPDATE crm_tables
SET integration_settings = jsonb_set(integration_settings, '{clientId}', '"6a253765-1636-4cd0-b543-966bbd0b2a38"')
WHERE id = '320600fe-e24d-42fa-af3d-49239385b544';

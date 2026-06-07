UPDATE public.crm_tables
SET integration_settings = jsonb_set(integration_settings::jsonb, '{clientId}', '"cb3d38ec-325f-44e3-8db4-b7d641f83ec4"'::jsonb)
WHERE id = '653654fa-a0aa-4736-a9a7-edd6ce843d18';
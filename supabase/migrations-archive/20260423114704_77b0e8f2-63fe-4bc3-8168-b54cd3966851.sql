UPDATE automation_flow_steps
SET configuration = jsonb_set(configuration, '{telegram_chat_id}', '"6267185334"')
WHERE id = '35c48d26-6fb8-4709-8447-905cac9a1177';
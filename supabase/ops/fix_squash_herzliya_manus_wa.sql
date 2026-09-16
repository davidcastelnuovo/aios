-- סקווש הרצליה: send via David Castelnuovo Manus WA (same as Make lead alerts),
-- not the orphan green_api integration 50d3c86e / instance 7103954455.
UPDATE public.automation_flow_steps
SET
  action_type = 'send_manus_message',
  configuration = jsonb_build_object(
    'recipients', jsonb_build_array(
      jsonb_build_object('type', 'phone_manual', 'phone', '972546684466')
    ),
    'message_template', 'ליד חדש סקווש:' || E'\n' || 'שם:{{fb_full_name}}' || E'\n' || 'טלפון:{{fb_phone_number}}',
    'wa_provider', 'manus_wa',
    'green_api_mode', 'tenant',
    'green_api_integration_id', 'd3542d3d-4193-46de-b4f4-2dfd6707e68c'
  ),
  updated_at = now()
WHERE automation_id = '82858e4b-3daa-41ed-9b50-5045769b2115'
  AND step_type = 'action'
  AND action_type IN ('send_greenapi_message', 'send_manus_message');

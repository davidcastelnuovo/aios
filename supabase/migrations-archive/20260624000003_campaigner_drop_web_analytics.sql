-- The campaigner skin listed `web_analytics` in allowed_tools, but no such tool
-- exists in run-ai-agent (no tool def, no executor case). Skin allowed_tools is
-- surfaced to the model as "tools you may use", so a phantom name invites failed
-- tool calls. Drop it; the remaining six are all real, live campaigner tools.
UPDATE public.ai_skills
SET allowed_tools = ARRAY[
  'analyze_campaign_performance',
  'get_facebook_campaign_data',
  'list_facebook_campaigns',
  'toggle_facebook_campaign',
  'update_facebook_budget',
  'check_ad_accounts_health'
]
WHERE slug = 'campaigner'
  AND 'web_analytics' = ANY(allowed_tools);

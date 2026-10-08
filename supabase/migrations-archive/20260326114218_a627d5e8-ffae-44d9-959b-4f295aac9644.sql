
-- Add default prompts for existing brands that have no prompts
INSERT INTO ai_detection_prompts (tenant_id, brand_id, prompt, category, is_active)
SELECT 
  b.tenant_id,
  b.id,
  unnest(ARRAY[
    'מה הכלי הכי טוב ל' || COALESCE(b.keywords[1], b.brand_name) || '?',
    'השווה בין ' || b.brand_name || ' ל-' || COALESCE(b.competitor_names[1], 'מתחרים בשוק'),
    'מה דעתך על ' || b.brand_name || '? האם כדאי להשתמש בהם?'
  ]),
  unnest(ARRAY['recommendation', 'comparison', 'review']),
  true
FROM ai_detection_brands b
WHERE NOT EXISTS (
  SELECT 1 FROM ai_detection_prompts p WHERE p.brand_id = b.id
);

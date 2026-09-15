-- STAGING ONLY. Current creative code writes storyboard assets. Extend only
-- the exact legacy constraint observed in Staging; preserve newer/custom rules.
DO $asset_types$
DECLARE current_definition text;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO current_definition FROM pg_constraint
 WHERE conrelid='public.marketing_assets'::regclass AND conname='marketing_assets_type_check';
 IF current_definition=$legacy$CHECK ((type = ANY (ARRAY['copy'::text, 'image'::text, 'video'::text, 'brief'::text, 'data'::text])))$legacy$ THEN
  ALTER TABLE public.marketing_assets DROP CONSTRAINT marketing_assets_type_check;
  ALTER TABLE public.marketing_assets ADD CONSTRAINT marketing_assets_type_check
   CHECK(type IN ('copy','image','video','brief','data','storyboard'));
 END IF;
END $asset_types$;

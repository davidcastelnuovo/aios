
ALTER TABLE public.marketing_pipelines
  ADD COLUMN IF NOT EXISTS track text NOT NULL DEFAULT 'campaigns';

ALTER TABLE public.marketing_pipelines
  DROP CONSTRAINT IF EXISTS marketing_pipelines_client_id_key;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marketing_pipelines_client_track_unique'
  ) THEN
    ALTER TABLE public.marketing_pipelines
      ADD CONSTRAINT marketing_pipelines_client_track_unique UNIQUE (client_id, track);
  END IF;
END $$;

UPDATE public.marketing_pipeline_stages
  SET name = 'בריף'
  WHERE stage_type = 'strategy' AND name = 'אסטרטגיה';

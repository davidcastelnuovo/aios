DELETE FROM marketing_pipeline_stages s
USING marketing_pipelines p
WHERE s.pipeline_id = p.id
  AND p.track = 'campaigns'
  AND s.stage_type IN ('target_seo','target_organic');
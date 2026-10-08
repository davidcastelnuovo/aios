
ALTER TABLE public.ai_skills
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION public.ai_skills_update_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('simple',
      coalesce(NEW.name,'') || ' ' ||
      coalesce(NEW.description,'') || ' ' ||
      coalesce(array_to_string(NEW.trigger_phrases, ' '), '')
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS ai_skills_search_vector_trg ON public.ai_skills;
CREATE TRIGGER ai_skills_search_vector_trg
  BEFORE INSERT OR UPDATE ON public.ai_skills
  FOR EACH ROW EXECUTE FUNCTION public.ai_skills_update_search_vector();

UPDATE public.ai_skills SET search_vector =
  to_tsvector('simple',
    coalesce(name,'') || ' ' ||
    coalesce(description,'') || ' ' ||
    coalesce(array_to_string(trigger_phrases, ' '), '')
  );

CREATE INDEX IF NOT EXISTS ai_skills_search_vector_idx
  ON public.ai_skills USING gin (search_vector);

-- bump_skill_usage_by_slug — usage signal for Carmen's skins.
-- run-ai-agent calls this (fire-and-forget) whenever a skin is trigger-matched
-- into the prompt, so ai_skills.usage_count/last_used_at reflect real usage.
-- Before this, usage_count was 0 for every skin — no data for ranking/cleanup.

create or replace function public.bump_skill_usage_by_slug(p_slugs text[], p_tenant_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_skills
  set usage_count = coalesce(usage_count, 0) + 1,
      last_used_at = now()
  where slug = any(coalesce(p_slugs, '{}'::text[]))
    and (scope = 'global' or tenant_id = p_tenant_id);
$$;

comment on function public.bump_skill_usage_by_slug(text[], uuid) is
  'Increment usage_count/last_used_at for trigger-matched skins (called by run-ai-agent, fire-and-forget).';

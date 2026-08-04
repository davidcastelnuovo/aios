-- Apply the agent tool router store that was declared in
-- supabase/migrations/20260724190000_agent_tool_router.sql but never landed
-- on production. Without this table + RPC, run-ai-agent falls back to the full
-- ~176-tool set and OpenAI's 128-tool cap silently drops late tools
-- (including inspect_facebook_ad / fb_duplicate_ad_variants).

create extension if not exists vector;

create table if not exists public.agent_tool_embeddings (
  tool_name  text primary key,
  sig        text not null,
  embedding  vector(1536) not null,
  updated_at timestamptz not null default now()
);

alter table public.agent_tool_embeddings enable row level security;
-- No policies → service role only (edge functions). Intentional.

create or replace function public.match_agent_tools(
  query_embedding vector(1536),
  match_count int default 50
)
returns table(tool_name text, similarity float)
language sql
stable
as $$
  select
    e.tool_name,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.agent_tool_embeddings e
  order by e.embedding <=> query_embedding
  limit greatest(match_count, 1)
$$;

grant execute on function public.match_agent_tools(vector, int) to service_role;

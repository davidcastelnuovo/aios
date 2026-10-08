-- Agent tool router: embedding-backed store so Carmen sends only the tools
-- relevant to the current message, instead of all ~140 every request.
-- Solves the OpenAI 128-tool cap at the root (fewer tools = fewer tokens,
-- better tool selection) rather than just truncating.
--
-- One embedding row per built-in tool (name + description), refreshed lazily by
-- run-ai-agent when a tool's signature changes. Locked to service-role access
-- (edge functions) — RLS on, no public policies.

create extension if not exists vector;

create table if not exists public.agent_tool_embeddings (
  tool_name  text primary key,
  sig        text not null,               -- hash of the tool description; refresh trigger
  embedding  vector(1536) not null,       -- text-embedding-3-small, 1536 dims (matches carmen_memory_pointers)
  updated_at timestamptz not null default now()
);

alter table public.agent_tool_embeddings enable row level security;
-- No policies → only the service role (edge functions) can read/write. Intentional.

-- Rank the stored tools by cosine similarity to a query embedding.
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

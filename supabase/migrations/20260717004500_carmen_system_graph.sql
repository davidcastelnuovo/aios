-- Read-only AIOS architecture graph for Carmen.
-- Graph versions are loaded as staging and activated atomically after count checks.

create table if not exists public.aios_graph_versions (
  version text primary key,
  commit_sha text,
  status text not null default 'staging' check (status in ('staging', 'active', 'archived', 'failed')),
  node_count integer not null default 0,
  edge_count integer not null default 0,
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

create unique index if not exists aios_graph_one_active_version
  on public.aios_graph_versions ((status)) where status = 'active';

create table if not exists public.aios_graph_nodes (
  version text not null references public.aios_graph_versions(version) on delete cascade,
  id text not null,
  label text not null,
  file_type text,
  source_file text,
  source_location text,
  community integer,
  community_name text,
  search_document tsvector generated always as (
    to_tsvector('simple', coalesce(label, '') || ' ' || coalesce(source_file, '') || ' ' || coalesce(community_name, ''))
  ) stored,
  primary key (version, id)
);

create index if not exists aios_graph_nodes_search_idx
  on public.aios_graph_nodes using gin (search_document);
create index if not exists aios_graph_nodes_version_community_idx
  on public.aios_graph_nodes (version, community);

create table if not exists public.aios_graph_edges (
  version text not null references public.aios_graph_versions(version) on delete cascade,
  edge_key text not null,
  source_id text not null,
  target_id text not null,
  relation text not null,
  confidence text,
  confidence_score double precision,
  source_file text,
  source_location text,
  weight double precision,
  primary key (version, edge_key),
  foreign key (version, source_id) references public.aios_graph_nodes(version, id) on delete cascade,
  foreign key (version, target_id) references public.aios_graph_nodes(version, id) on delete cascade
);

create index if not exists aios_graph_edges_source_idx on public.aios_graph_edges (version, source_id);
create index if not exists aios_graph_edges_target_idx on public.aios_graph_edges (version, target_id);

alter table public.aios_graph_versions enable row level security;
alter table public.aios_graph_nodes enable row level security;
alter table public.aios_graph_edges enable row level security;

revoke all on public.aios_graph_versions from anon, authenticated;
revoke all on public.aios_graph_nodes from anon, authenticated;
revoke all on public.aios_graph_edges from anon, authenticated;
grant all on public.aios_graph_versions to service_role;
grant all on public.aios_graph_nodes to service_role;
grant all on public.aios_graph_edges to service_role;

create or replace function public.carmen_activate_system_graph(
  p_version text,
  p_expected_nodes integer,
  p_expected_edges integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nodes integer;
  v_edges integer;
begin
  select count(*) into v_nodes from public.aios_graph_nodes where version = p_version;
  select count(*) into v_edges from public.aios_graph_edges where version = p_version;

  if v_nodes <> p_expected_nodes or v_edges <> p_expected_edges then
    update public.aios_graph_versions set status = 'failed' where version = p_version;
    raise exception 'Graph count mismatch: nodes %/%, edges %/%', v_nodes, p_expected_nodes, v_edges, p_expected_edges;
  end if;

  update public.aios_graph_versions set status = 'archived' where status = 'active';
  update public.aios_graph_versions
    set status = 'active', node_count = v_nodes, edge_count = v_edges, activated_at = now()
    where version = p_version and status = 'staging';

  if not found then
    raise exception 'Graph version % is not in staging state', p_version;
  end if;

  return jsonb_build_object('version', p_version, 'nodes', v_nodes, 'edges', v_edges, 'active', true);
end;
$$;

revoke all on function public.carmen_activate_system_graph(text, integer, integer) from public, anon, authenticated;
grant execute on function public.carmen_activate_system_graph(text, integer, integer) to service_role;

create or replace function public.carmen_query_system_graph(
  p_query text,
  p_depth integer default 2,
  p_limit integer default 40
) returns table (
  node_id text,
  label text,
  file_type text,
  source_file text,
  source_location text,
  community_name text,
  distance integer,
  connections jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with recursive active as (
    select version from public.aios_graph_versions where status = 'active' limit 1
  ), seeds as (
    select n.id
    from public.aios_graph_nodes n join active a using (version)
    where n.search_document @@ websearch_to_tsquery('simple', p_query)
       or lower(n.label) like '%' || lower(p_query) || '%'
       or lower(coalesce(n.source_file, '')) like '%' || lower(p_query) || '%'
    order by
      ts_rank(n.search_document, websearch_to_tsquery('simple', p_query)) desc,
      case when lower(n.label) = lower(p_query) then 0 else 1 end,
      n.label
    limit 8
  ), walk(node_id, distance) as (
    select id, 0 from seeds
    union
    select case when e.source_id = w.node_id then e.target_id else e.source_id end,
           w.distance + 1
    from walk w
    join active a on true
    join public.aios_graph_edges e
      on e.version = a.version and (e.source_id = w.node_id or e.target_id = w.node_id)
    where w.distance < least(greatest(p_depth, 0), 3)
  ), nearest as (
    select node_id, min(distance) as distance
    from walk group by node_id
    order by min(distance), node_id
    limit least(greatest(p_limit, 1), 80)
  )
  select n.id, n.label, n.file_type, n.source_file, n.source_location, n.community_name,
         nearest.distance,
         coalesce((
           select jsonb_agg(jsonb_build_object('relation', c.relation, 'node_id', c.connected_id) order by c.relation)
           from (
             select e.relation,
                    case when e.source_id = n.id then e.target_id else e.source_id end as connected_id
             from public.aios_graph_edges e
             where e.version = n.version and (e.source_id = n.id or e.target_id = n.id)
             order by e.weight desc nulls last, e.relation
             limit 20
           ) c
         ), '[]'::jsonb)
  from nearest
  join active a on true
  join public.aios_graph_nodes n on n.version = a.version and n.id = nearest.node_id
  order by nearest.distance, n.label;
$$;

revoke all on function public.carmen_query_system_graph(text, integer, integer) from public, anon, authenticated;
grant execute on function public.carmen_query_system_graph(text, integer, integer) to service_role;

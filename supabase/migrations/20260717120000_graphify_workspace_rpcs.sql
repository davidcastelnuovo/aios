-- Read-only Graphify RPCs for the Visual Workspace UI.
-- The underlying aios_graph_* tables stay service_role-only; these wrappers
-- are SECURITY DEFINER and gated to admin / super_admin app roles, mirroring
-- the manager-only gate on Carmen's query_system_graph tool.

create or replace function public.graphify_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin'::app_role)
      or public.has_role(auth.uid(), 'super_admin'::app_role);
$$;

revoke all on function public.graphify_is_admin() from public, anon;
grant execute on function public.graphify_is_admin() to authenticated, service_role;

-- Overview: active version stats + communities with node counts.
create or replace function public.graphify_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_version record;
  v_communities jsonb;
  v_relations jsonb;
begin
  if not public.graphify_is_admin() then
    raise exception 'Graphify access is limited to admins';
  end if;

  select version, commit_sha, node_count, edge_count, activated_at
    into v_version
    from public.aios_graph_versions where status = 'active' limit 1;

  if v_version.version is null then
    return jsonb_build_object('active', false);
  end if;

  select coalesce(jsonb_agg(c order by c->'nodes' desc), '[]'::jsonb) into v_communities
  from (
    select jsonb_build_object(
      'community', n.community,
      'name', coalesce(max(n.community_name), 'ללא שם'),
      'nodes', count(*),
      'file_types', (
        select jsonb_object_agg(ft, cnt) from (
          select coalesce(n2.file_type, 'other') as ft, count(*) as cnt
          from public.aios_graph_nodes n2
          where n2.version = v_version.version and n2.community = n.community
          group by 1 order by 2 desc limit 6
        ) t
      )
    ) as c
    from public.aios_graph_nodes n
    where n.version = v_version.version
    group by n.community
  ) s;

  select coalesce(jsonb_object_agg(relation, cnt), '{}'::jsonb) into v_relations
  from (
    select relation, count(*) as cnt
    from public.aios_graph_edges where version = v_version.version
    group by relation order by cnt desc
  ) r;

  return jsonb_build_object(
    'active', true,
    'version', v_version.version,
    'commit_sha', v_version.commit_sha,
    'node_count', v_version.node_count,
    'edge_count', v_version.edge_count,
    'activated_at', v_version.activated_at,
    'communities', v_communities,
    'relations', v_relations
  );
end;
$$;

revoke all on function public.graphify_overview() from public, anon;
grant execute on function public.graphify_overview() to authenticated, service_role;

-- Subgraph of one community: its nodes and the edges among them.
create or replace function public.graphify_community_subgraph(
  p_community integer,
  p_limit integer default 400
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_version text;
  v_nodes jsonb;
  v_edges jsonb;
begin
  if not public.graphify_is_admin() then
    raise exception 'Graphify access is limited to admins';
  end if;

  select version into v_version from public.aios_graph_versions where status = 'active' limit 1;
  if v_version is null then
    return jsonb_build_object('nodes', '[]'::jsonb, 'edges', '[]'::jsonb);
  end if;

  with picked as (
    select n.id, n.label, n.file_type, n.source_file, n.source_location,
           (select count(*) from public.aios_graph_edges e
             where e.version = v_version and (e.source_id = n.id or e.target_id = n.id)) as degree
    from public.aios_graph_nodes n
    where n.version = v_version and n.community = p_community
    order by degree desc, n.label
    limit least(greatest(p_limit, 1), 800)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'label', label, 'file_type', file_type,
           'source_file', source_file, 'source_location', source_location,
           'degree', degree)), '[]'::jsonb)
    into v_nodes
  from picked;

  with picked as (
    select n.id
    from public.aios_graph_nodes n
    where n.version = v_version and n.community = p_community
    order by (select count(*) from public.aios_graph_edges e
              where e.version = v_version and (e.source_id = n.id or e.target_id = n.id)) desc, n.label
    limit least(greatest(p_limit, 1), 800)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'source', e.source_id, 'target', e.target_id,
           'relation', e.relation, 'weight', e.weight)), '[]'::jsonb)
    into v_edges
  from public.aios_graph_edges e
  where e.version = v_version
    and e.source_id in (select id from picked)
    and e.target_id in (select id from picked);

  return jsonb_build_object('nodes', v_nodes, 'edges', v_edges);
end;
$$;

revoke all on function public.graphify_community_subgraph(integer, integer) from public, anon;
grant execute on function public.graphify_community_subgraph(integer, integer) to authenticated, service_role;

-- Search wrapper over the existing Carmen RPC, gated to admins.
create or replace function public.graphify_search(
  p_query text,
  p_depth integer default 2,
  p_limit integer default 40
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.graphify_is_admin() then
    raise exception 'Graphify access is limited to admins';
  end if;

  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into v_result
  from public.carmen_query_system_graph(p_query, p_depth, p_limit) r;

  return v_result;
end;
$$;

revoke all on function public.graphify_search(text, integer, integer) from public, anon;
grant execute on function public.graphify_search(text, integer, integer) to authenticated, service_role;

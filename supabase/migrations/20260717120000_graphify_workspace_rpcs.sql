-- Read-only Graphify RPCs for the Visual Workspace UI.
-- The underlying aios_graph_* tables stay service_role-only; these wrappers
-- are SECURITY DEFINER and gated to admin / super_admin app roles, mirroring
-- the manager-only gate on Carmen's query_system_graph tool.
--
-- Grouping: the active graph version has no community assignments, so nodes
-- are grouped by top-level source directory (src/components, supabase/functions…).
-- When community_name is populated in a future sync it takes precedence.

-- Manager-tier gate, mirroring run-ai-agent's isManagerRoleCaller
-- (owner / agency_owner / super_admin). The graph holds architecture only —
-- no tenant data — so any manager-tier role may view it.
create or replace function public.graphify_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role in ('owner'::app_role, 'agency_owner'::app_role, 'super_admin'::app_role)
  );
$$;

revoke all on function public.graphify_is_admin() from public, anon;
grant execute on function public.graphify_is_admin() to authenticated, service_role;

-- Derives the display group for a node: community_name if set, else the
-- top one/two path segments of source_file.
create or replace function public.graphify_node_group(p_community_name text, p_source_file text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(p_community_name, ''),
    case
      when p_source_file is null or p_source_file = '' then 'אחר'
      when p_source_file like 'src/%' or p_source_file like 'supabase/%'
        then split_part(p_source_file, '/', 1) || '/' || split_part(p_source_file, '/', 2)
      when position('/' in p_source_file) > 0
        then split_part(p_source_file, '/', 1)
      else 'קבצי תצורה'
    end
  );
$$;

create or replace function public.graphify_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_version record;
  v_groups jsonb;
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

  with base as (
    select public.graphify_node_group(n.community_name, n.source_file) as grp,
           coalesce(n.file_type, 'other') as ft
    from public.aios_graph_nodes n
    where n.version = v_version.version
  ), per_type as (
    select grp, ft, count(*) as cnt from base group by grp, ft
  ), grouped as (
    select grp, sum(cnt)::int as node_cnt, jsonb_object_agg(ft, cnt) as fts
    from per_type group by grp
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'group_key', grp, 'name', grp, 'nodes', node_cnt, 'file_types', fts
         ) order by node_cnt desc), '[]'::jsonb)
    into v_groups
  from grouped;

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
    'communities', v_groups,
    'relations', v_relations
  );
end;
$$;

revoke all on function public.graphify_overview() from public, anon;
grant execute on function public.graphify_overview() to authenticated, service_role;

-- Subgraph of one group: its nodes and the edges among them.
create or replace function public.graphify_group_subgraph(
  p_group text,
  p_limit integer default 400
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_version text;
  v_result jsonb;
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
    where n.version = v_version
      and public.graphify_node_group(n.community_name, n.source_file) = p_group
    order by degree desc, n.label
    limit least(greatest(p_limit, 1), 800)
  )
  select jsonb_build_object(
    'nodes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'label', p.label, 'file_type', p.file_type,
        'source_file', p.source_file, 'source_location', p.source_location,
        'degree', p.degree))
      from picked p), '[]'::jsonb),
    'edges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', e.source_id, 'target', e.target_id,
        'relation', e.relation, 'weight', e.weight))
      from public.aios_graph_edges e
      where e.version = v_version
        and e.source_id in (select id from picked)
        and e.target_id in (select id from picked)), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.graphify_group_subgraph(text, integer) from public, anon;
grant execute on function public.graphify_group_subgraph(text, integer) to authenticated, service_role;

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

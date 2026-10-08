-- The Command Center must be able to show Carmen's real memory size without
-- exposing memory rows from another tenant. Restore the tenant SELECT policies
-- (missing in production) and expose only aggregate counts to the dashboard.

drop policy if exists "cmp_select_tenant" on public.carmen_memory_pointers;
create policy "cmp_select_tenant"
on public.carmen_memory_pointers
for select to authenticated
using (
  tenant_id = public.get_user_tenant_id((select auth.uid()))
  or public.is_super_admin((select auth.uid()))
);

drop policy if exists "cme_select_tenant" on public.carmen_memory_episodes;
create policy "cme_select_tenant"
on public.carmen_memory_episodes
for select to authenticated
using (
  tenant_id = public.get_user_tenant_id((select auth.uid()))
  or public.is_super_admin((select auth.uid()))
);

create or replace function public.get_carmen_memory_counts(p_tenant_id uuid)
returns table(pointer_count bigint, episode_count bigint, total_count bigint)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    (select count(*) from public.carmen_memory_pointers where tenant_id = p_tenant_id),
    (select count(*) from public.carmen_memory_episodes where tenant_id = p_tenant_id),
    (select count(*) from public.carmen_memory_pointers where tenant_id = p_tenant_id)
      + (select count(*) from public.carmen_memory_episodes where tenant_id = p_tenant_id);
$$;

revoke all on function public.get_carmen_memory_counts(uuid) from public, anon;
grant execute on function public.get_carmen_memory_counts(uuid) to authenticated;

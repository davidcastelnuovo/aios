-- Fails the seed if any fragment silently skipped rows (`on conflict do nothing`)
-- or the handle_new_user trigger did not create profiles.
do $$
declare
  failures text[] := '{}';
  c record;
begin
  for c in
    select * from (values
      ('auth users',    (select count(*) from auth.users where email like '%@aios.test'), 5),
      ('auth identities', (select count(*) from auth.identities i join auth.users u on u.id = i.user_id where u.email like '%@aios.test'), 5),
      ('profiles',      (select count(*) from public.profiles where email like '%@aios.test'), 5),
      ('tenants',       (select count(*) from public.tenants where id::text like 'bbbbbbbb-%'), 3),
      ('tenant_users',  (select count(*) from public.tenant_users where tenant_id::text like 'bbbbbbbb-%'), 5),
      ('user_roles',    (select count(*) from public.user_roles where tenant_id::text like 'bbbbbbbb-%'), 7),
      ('agencies',      (select count(*) from public.agencies where id::text like 'cccccccc-%'), 3),
      ('clients',       (select count(*) from public.clients where id::text like 'dddddddd-%'), 4),
      ('leads',         (select count(*) from public.leads where id::text like 'eeeeeeee-%'), 4),
      ('campaigners',  (select count(*) from public.campaigners where id::text like '99999999-%'), 1),
      ('campaigner link', (select count(*) from public.profiles where id::text like 'aaaaaaaa-%' and campaigner_id is not null), 1),
      ('tasks',         (select count(*) from public.tasks where id::text like 'ffffffff-%'), 3),
      ('carmen agents', (select count(*) from public.ai_agents where id::text like '12121212-%'), 3)
    ) as t(name, actual, expected)
    where actual <> expected
  loop
    failures := failures || format('%s: expected %s, found %s', c.name, c.expected, c.actual);
  end loop;

  if cardinality(failures) > 0 then
    raise exception 'seed verification failed: %', array_to_string(failures, '; ');
  end if;
end $$;

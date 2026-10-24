-- Carmen for each demo tenant, so the Carmen session, brains and permissions
-- screen work on dev branches. Brain routes are created on first use by
-- agent-channel-send (ensureDefaultRoutes).
insert into public.ai_agents (id, tenant_id, name, brain_mode, active) values
  ('12121212-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'כרמן', 'internal', true),
  ('12121212-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'כרמן', 'internal', true),
  ('12121212-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000003', 'כרמן', 'internal', true)
on conflict (id) do nothing;

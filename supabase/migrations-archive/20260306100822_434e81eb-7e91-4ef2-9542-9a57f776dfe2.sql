
-- 1. Fix the invite's tenant_id to match the channel's tenant
UPDATE team_channel_invites 
SET tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'
WHERE id = '58b96e1b-2455-4240-bf46-fb6ab6af62e6';

-- 2. Add Felix as tenant_user in MarketingCaptain
INSERT INTO tenant_users (user_id, tenant_id)
VALUES ('953a18d4-cd68-4b1f-b5b4-b8a398495858', '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019')
ON CONFLICT DO NOTHING;

-- 3. Add campaigner role for Felix in MarketingCaptain
INSERT INTO user_roles (user_id, role, tenant_id)
VALUES ('953a18d4-cd68-4b1f-b5b4-b8a398495858', 'campaigner', '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019')
ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

-- 4. Add Felix as member of the channel
INSERT INTO team_channel_members (channel_id, user_id, tenant_id, role)
VALUES ('e0c87972-3737-4803-812f-c31827a8c1f8', '953a18d4-cd68-4b1f-b5b4-b8a398495858', '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 'member')
ON CONFLICT DO NOTHING;

-- 5. Remove David's duplicate member entry with wrong tenant
DELETE FROM team_channel_members 
WHERE id = '24d737fc-a90b-4798-bdf4-3e4d6006db70';

-- 6. Grant team_chat permission for Felix if not exists
INSERT INTO user_permissions (user_id, module, can_access)
VALUES ('953a18d4-cd68-4b1f-b5b4-b8a398495858', 'team_chat', true)
ON CONFLICT DO NOTHING;

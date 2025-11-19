-- Fix user_active_tenant for davidtest680@gmail.com
-- The user is member of MarketingCaptain but user_active_tenant pointed to DMM tenant
UPDATE user_active_tenant 
SET tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', 
    updated_at = now()
WHERE user_id = '8f978177-413e-4547-a2d1-02d76a2cab24';
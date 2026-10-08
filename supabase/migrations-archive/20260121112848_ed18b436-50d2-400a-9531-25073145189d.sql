-- Performance indexes for frequently scanned tables
-- These indexes will dramatically reduce sequential scans

-- Index on user_roles for faster role lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_tenant 
ON public.user_roles(user_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_role 
ON public.user_roles(user_id, role);

-- Index on user_active_tenant for faster tenant resolution
CREATE INDEX IF NOT EXISTS idx_user_active_tenant_user 
ON public.user_active_tenant(user_id);

-- Index on tenant_users for faster user-tenant lookups
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_tenant 
ON public.tenant_users(user_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant 
ON public.tenant_users(tenant_id);

-- Index on profiles for faster profile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_campaigner 
ON public.profiles(campaigner_id) WHERE campaigner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_sales_person 
ON public.profiles(sales_person_id) WHERE sales_person_id IS NOT NULL;

-- Index on campaigner_agencies for faster agency lookups
CREATE INDEX IF NOT EXISTS idx_campaigner_agencies_campaigner 
ON public.campaigner_agencies(campaigner_id);

CREATE INDEX IF NOT EXISTS idx_campaigner_agencies_agency 
ON public.campaigner_agencies(agency_id);

-- Index on tenant_integrations for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_instance 
ON public.tenant_integrations(instance_id) WHERE instance_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant_type_active 
ON public.tenant_integrations(tenant_id, integration_type, is_active);

-- Index on chat_messages for faster message queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_connection_user 
ON public.chat_messages(connection_user_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_client 
ON public.chat_messages(client_id) WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_lead 
ON public.chat_messages(lead_id) WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_group 
ON public.chat_messages(group_id) WHERE group_id IS NOT NULL;

-- Index on leads for faster lead queries
CREATE INDEX IF NOT EXISTS idx_leads_tenant_agency 
ON public.leads(tenant_id, agency_id);

CREATE INDEX IF NOT EXISTS idx_leads_phone 
ON public.leads(phone) WHERE phone IS NOT NULL;

-- Index on clients for faster client queries
CREATE INDEX IF NOT EXISTS idx_clients_tenant_agency 
ON public.clients(tenant_id, agency_id);

CREATE INDEX IF NOT EXISTS idx_clients_phone 
ON public.clients(phone) WHERE phone IS NOT NULL;
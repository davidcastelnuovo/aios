-- Add indexes for frequently filtered/sorted fields to improve query performance

-- Index for leads filtered by tenant_id and sorted by created_at
CREATE INDEX IF NOT EXISTS idx_leads_tenant_created 
ON public.leads (tenant_id, created_at DESC);

-- Index for leads filtered by tenant_id and status
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status 
ON public.leads (tenant_id, status);

-- Index for leads filtered by agency_id
CREATE INDEX IF NOT EXISTS idx_leads_agency 
ON public.leads (agency_id);

-- Index for chat_contact_tags to speed up tag lookups
CREATE INDEX IF NOT EXISTS idx_chat_contact_tags_tenant_lead 
ON public.chat_contact_tags (tenant_id, lead_id);

-- Index for chat_messages to speed up contact lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_lead 
ON public.chat_messages (tenant_id, lead_id);

-- Index for tasks filtered by tenant and status
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status 
ON public.tasks (tenant_id, status);

-- Index for clients filtered by tenant
CREATE INDEX IF NOT EXISTS idx_clients_tenant 
ON public.clients (tenant_id);

-- Index for agencies filtered by tenant
CREATE INDEX IF NOT EXISTS idx_agencies_tenant 
ON public.agencies (tenant_id);
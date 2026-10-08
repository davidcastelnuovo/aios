-- Add performance indexes for leads table
CREATE INDEX IF NOT EXISTS idx_leads_tenant_created 
ON leads (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_tenant_status 
ON leads (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_leads_agency_id 
ON leads (agency_id);

CREATE INDEX IF NOT EXISTS idx_leads_sales_person_id 
ON leads (sales_person_id);

CREATE INDEX IF NOT EXISTS idx_leads_response_status 
ON leads (response_status);

-- Index for chat_contact_tags to speed up tag lookups
CREATE INDEX IF NOT EXISTS idx_chat_contact_tags_lead_id 
ON chat_contact_tags (lead_id) WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_contact_tags_tenant_lead 
ON chat_contact_tags (tenant_id, lead_id) WHERE lead_id IS NOT NULL;
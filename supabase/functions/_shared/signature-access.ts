import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

/** Use the caller's RLS client, including existing shared-agency entity policies, before elevating. */
export async function requireSignatureAccess(client: SupabaseClient, documentId: string,
  links: { clientId?: string; leadId?: string } = {}): Promise<string> {
  const { data: document, error } = await client.from('signature_documents')
    .select('id, tenant_id, client_id, lead_id').eq('id', documentId).maybeSingle();
  if (error || !document) throw new Error('signature_access_denied');
  for (const id of new Set([links.clientId, document.client_id].filter(Boolean))) {
    const result = await client.from('clients').select('id').eq('id', id).maybeSingle();
    if (result.error || !result.data) throw new Error('signature_access_denied');
  }
  for (const id of new Set([links.leadId, document.lead_id].filter(Boolean))) {
    const result = await client.from('leads').select('id').eq('id', id).maybeSingle();
    if (result.error || !result.data) throw new Error('signature_access_denied');
  }
  return document.tenant_id;
}

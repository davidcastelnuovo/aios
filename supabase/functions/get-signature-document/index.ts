import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';
import { signatureStoragePath } from '../_shared/signature-storage.ts';

const headers = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

// Public signer access is limited to the document bound to this unguessable token.
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    const { token } = await request.json();
    if (typeof token !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      return json({ recipient: null, fileUrl: null });
    }
    const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: recipient, error } = await client.rpc('get_signature_by_token', { _token: token });
    if (error) throw error;
    const document = recipient?.signature_documents;
    if (!document || !document.file_url || recipient.status !== 'pending' || !['pending', 'partially_signed'].includes(document.status)) {
      return json({ recipient, fileUrl: null });
    }
    const result = await client.from('signature_documents').select('tenant_id').eq('id', document.id).single();
    if (result.error) throw result.error;
    const path = signatureStoragePath(document.file_url, result.data.tenant_id);
    if (!path) return json({ recipient, fileUrl: document.file_url });
    const signed = await client.storage.from('signature-documents').createSignedUrl(path, 4 * 60 * 60);
    if (signed.error) {
      return json({ recipient, fileUrl: null, fileError: 'לא ניתן לטעון את הקובץ. פנה לשולח המסמך.' });
    }
    return json({ recipient, fileUrl: signed.data.signedUrl });
  } catch (error) {
    console.error('[get-signature-document]', error instanceof Error ? error.message : 'load_failed');
    return json({ error: 'לא ניתן לטעון את המסמך כרגע. נסה שוב.' }, 500);
  }
});

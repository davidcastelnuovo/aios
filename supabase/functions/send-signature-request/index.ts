import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';
import { sendSignatureDocumentEmails } from '../_shared/signature-automation.ts';

interface SendSignatureRequest {
  documentId: string;
  baseUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { documentId, baseUrl }: SendSignatureRequest = await req.json();
    if (!documentId) {
      return new Response(JSON.stringify({ error: 'missing_document_id' }), { status: 400, headers: corsHeaders });
    }

    const { data: tenantId } = await supabase.rpc('get_user_tenant_id', { _user_id: user.id });
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'no_tenant' }), { status: 403, headers: corsHeaders });
    }

    const { data: doc, error: docError } = await supabase
      .from('signature_documents')
      .select('id')
      .eq('id', documentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (docError || !doc) {
      return new Response(JSON.stringify({ error: 'document_not_found' }), { status: 404, headers: corsHeaders });
    }

    let senderName: string | undefined;
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    senderName = profile?.full_name || undefined;

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { sent, results } = await sendSignatureDocumentEmails(serviceClient, {
      documentId,
      tenantId,
      baseUrl,
      senderName,
    });

    const { data: recipients } = await serviceClient
      .from('signature_recipients')
      .select('name, email, sign_token')
      .eq('document_id', documentId);

    const origin = baseUrl?.split('/').slice(0, 3).join('/') || 'https://aios.co.il';

    return new Response(
      JSON.stringify({
        success: sent > 0,
        partial: sent > 0 && sent < results.length,
        emails: results,
        signingLinks: (recipients || []).map((r) => ({
          name: r.name,
          email: r.email,
          url: `${origin}/sign/${r.sign_token}`,
        })),
      }),
      { status: 200, headers: corsHeaders },
    );
  } catch (e: unknown) {
    console.error('[send-signature-request]', e);
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});

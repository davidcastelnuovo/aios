import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';
import {
  cloneSignatureFromTemplate,
  sendSignatureDocumentEmails,
} from '../_shared/signature-automation.ts';

interface SendSignatureFromTemplateBody {
  templateDocumentId: string;
  recipientName: string;
  recipientEmail: string;
  documentTitle?: string;
  baseUrl?: string;
  contactDetails?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    idNumber?: string;
  };
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

    const body: SendSignatureFromTemplateBody = await req.json();
    const {
      templateDocumentId,
      recipientName,
      recipientEmail,
      documentTitle,
      baseUrl,
      contactDetails,
    } = body;

    if (!templateDocumentId || !recipientName?.trim() || !recipientEmail?.trim()) {
      return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400, headers: corsHeaders });
    }

    const { data: tenantId } = await supabase.rpc('get_user_tenant_id', { _user_id: user.id });
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'no_tenant' }), { status: 403, headers: corsHeaders });
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const documentId = await cloneSignatureFromTemplate(serviceClient, {
      templateDocumentId,
      tenantId,
      createdBy: user.id,
      recipientName: recipientName.trim(),
      recipientEmail: recipientEmail.trim(),
      documentTitle: documentTitle?.trim() || undefined,
      contactDetails,
    });

    let senderName: string | undefined;
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    senderName = profile?.full_name || undefined;

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
        documentId,
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
    console.error('[send-signature-from-template]', e);
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});

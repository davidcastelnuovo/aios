import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { requireSignatureAccess } from '../_shared/signature-access.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  cloneSignatureFromTemplate,
  prepareSignatureDocumentForSigning,
  sendSignatureDocumentEmails,
} from '../_shared/signature-automation.ts';

interface SendSignatureFromTemplateBody {
  templateDocumentId: string;
  recipientName: string;
  recipientEmail: string;
  documentTitle?: string;
  baseUrl?: string;
  sendEmail?: boolean;
  contactDetails?: {
    companyName?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    idNumber?: string;
  };
  leadId?: string;
  clientId?: string;
}

const responseHeaders = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: responseHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: responseHeaders });
    }

    const body: SendSignatureFromTemplateBody = await req.json();
    const {
      templateDocumentId,
      recipientName,
      recipientEmail,
      documentTitle,
      baseUrl,
      sendEmail = false,
      contactDetails,
      leadId,
      clientId,
    } = body;

    if (!templateDocumentId || !recipientName?.trim() || !recipientEmail?.trim()) {
      return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400, headers: responseHeaders });
    }

    const tenantId = await requireSignatureAccess(supabase, templateDocumentId, { clientId, leadId });

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
      leadId,
      clientId,
    });

    const { signingLinks } = await prepareSignatureDocumentForSigning(serviceClient, {
      documentId,
      tenantId,
      createdBy: user.id,
      baseUrl,
      recipient: {
        name: recipientName.trim(),
        email: recipientEmail.trim(),
        phone: contactDetails?.phone,
      },
      contactDetails,
      leadId,
      clientId,
    });

    let emails: Array<{ email: string; ok: boolean; error?: string }> = [];
    let sent = 0;

    if (sendEmail) {
      let senderName: string | undefined;
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      senderName = profile?.full_name || undefined;

      const emailResult = await sendSignatureDocumentEmails(serviceClient, {
        documentId,
        tenantId,
        baseUrl,
        senderName,
        sendEmail: true,
        requireEmailSuccess: false,
      });
      emails = emailResult.results;
      sent = emailResult.sent;
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        emails,
        emailSent: sent > 0,
        partial: sendEmail && sent > 0 && sent < emails.length,
        signingLinks,
      }),
      { status: 200, headers: responseHeaders },
    );
  } catch (e: unknown) {
    console.error('[send-signature-from-template]', e);
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), { status: message === 'signature_access_denied' ? 403 : 400, headers: responseHeaders });
  }
});

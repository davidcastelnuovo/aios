import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || null;
}

interface SubmitSignatureBody {
  token: string;
  signatureData?: string;
  fieldValues?: Record<string, string>;
  action?: 'sign' | 'decline';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { token, signatureData, fieldValues, action = 'sign' }: SubmitSignatureBody = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: 'missing_token' }), { status: 400, headers: corsHeaders });
    }

    const ip = clientIp(req);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let result: Record<string, unknown>;

    if (action === 'decline') {
      const { data, error } = await supabase.rpc('decline_signature_by_token', {
        _token: token,
        _ip: ip,
      });
      if (error) throw error;
      result = data as Record<string, unknown>;
    } else {
      if (!signatureData) {
        return new Response(JSON.stringify({ error: 'missing_signature' }), { status: 400, headers: corsHeaders });
      }

      let rpcResult: Record<string, unknown> | null = null;
      const withFields = await supabase.rpc('submit_signature_by_token', {
        _token: token,
        _signature_data: signatureData,
        _ip: ip,
        _field_values: fieldValues ?? {},
      });

      if (withFields.error?.message?.includes('field_values')) {
        const legacy = await supabase.rpc('submit_signature_by_token', {
          _token: token,
          _signature_data: signatureData,
          _ip: ip,
        });
        if (legacy.error) throw legacy.error;
        rpcResult = legacy.data as Record<string, unknown>;
      } else {
        if (withFields.error) throw withFields.error;
        rpcResult = withFields.data as Record<string, unknown>;
      }

      result = rpcResult!;

      if (result.document_status === 'completed' && result.document_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        fetch(`${supabaseUrl}/functions/v1/generate-signed-pdf`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ documentId: result.document_id }),
        }).catch((err) => console.error('[submit-signature] pdf trigger failed', err));
      }
    }

    return new Response(JSON.stringify({ success: true, ...result }), { status: 200, headers: corsHeaders });
  } catch (e: unknown) {
    console.error('[submit-signature]', e);
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});

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

const responseHeaders = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { token, signatureData, fieldValues, action = 'sign' }: SubmitSignatureBody = await req.json();
    if (typeof token !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      return new Response(JSON.stringify({ error: 'missing_token' }), { status: 400, headers: responseHeaders });
    }

    if (!['sign', 'decline'].includes(action)) {
      return new Response(JSON.stringify({ error: 'invalid_action' }), { status: 400, headers: responseHeaders });
    }
    const ip = clientIp(req);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let result: Record<string, unknown>;
    let pdfGenerated = false;
    let pdfError: string | null = null;

    if (action === 'decline') {
      const { data, error } = await supabase.rpc('decline_signature_by_token', {
        _token: token,
        _ip: ip,
      });
      if (error) throw error;
      result = data as Record<string, unknown>;
    } else {
      if (!signatureData) {
        return new Response(JSON.stringify({ error: 'missing_signature' }), { status: 400, headers: responseHeaders });
      }

      const submission = await supabase.rpc('submit_signature_by_token', {
        _token: token, _signature_data: signatureData, _ip: ip, _field_values: fieldValues ?? {},
      });
      if (submission.error) throw submission.error;
      result = submission.data as Record<string, unknown>;

      // Signature is already persisted — never fail the request because PDF generation failed.
      if (result.document_status === 'completed' && result.document_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const runPdf = async () => {
          const pdfRes = await fetch(`${supabaseUrl}/functions/v1/generate-signed-pdf`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ documentId: result.document_id }),
          });
          const pdfBody = await pdfRes.json().catch(() => ({}));
          if (!pdfRes.ok || pdfBody?.error) {
            const errMsg = pdfBody?.error || `pdf_http_${pdfRes.status}`;
            console.error('[submit-signature] pdf generation failed', errMsg);
            return { pdfGenerated: false, pdfError: errMsg as string };
          }
          return { pdfGenerated: true, pdfError: null as string | null };
        };

        try {
          // Prefer background work so the signer gets an immediate success response.
          const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
          if (edgeRuntime?.waitUntil) {
            edgeRuntime.waitUntil(
              runPdf().catch((err) => console.error('[submit-signature] pdf background failed', err)),
            );
            pdfGenerated = false;
            pdfError = null;
          } else {
            const pdfOutcome = await runPdf();
            pdfGenerated = pdfOutcome.pdfGenerated;
            pdfError = pdfOutcome.pdfError;
          }
        } catch (err) {
          pdfError = err instanceof Error ? err.message : String(err);
          console.error('[submit-signature] pdf trigger failed', err);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...result, pdfGenerated, pdfError }),
      { status: 200, headers: responseHeaders },
    );
  } catch (e: unknown) {
    console.error('[submit-signature]', e);
    const message = e instanceof Error ? e.message : (e as { message?: string })?.message || 'submission_failed';
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: responseHeaders });
  }
});

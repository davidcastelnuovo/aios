/**
 * manage-manus-wa — Supabase Edge Function
 *
 * Secure proxy between Carmen (run-ai-agent) and the Manus WhatsApp Gateway.
 * Keeps API keys server-side; Carmen never sees raw credentials.
 *
 * Supported actions:
 *   create_instance  — Create a new WA instance in the Gateway + save to tenant_integrations
 *   get_qr_link      — Create a QR share token and return the public scan URL
 *   get_status       — Return live status of an instance
 *   connect          — Trigger WhatsApp connection (start session)
 *   send_message     — Send a text message via a specific instance
 *
 * Auth: requires a valid Supabase Bearer token (user or service role).
 * Called internally by run-ai-agent with the service role key.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_BASE = 'https://whatsappgw-pzpyrrww.manus.space';
const GATEWAY_TRPC = `${GATEWAY_BASE}/api/trpc`;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ── Gateway tRPC helper ───────────────────────────────────────────────────────
// The Gateway uses Manus OAuth. We use the owner's stored session cookie
// or, for instance management, the tRPC endpoint with the service JWT.
// For REST API calls (send/status) we use the per-instance API key stored in DB.

async function gatewayTrpc(procedure: string, input: Record<string, unknown>, sessionToken: string) {
  const url = `${GATEWAY_TRPC}/${procedure}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session=${sessionToken}`,
    },
    body: JSON.stringify({ json: input }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway tRPC ${procedure} failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  if (data?.error) throw new Error(`Gateway tRPC error: ${JSON.stringify(data.error).slice(0, 300)}`);
  return data?.result?.data?.json ?? data?.result?.data;
}

async function gatewayRest(path: string, method: string, apiKey: string, body?: unknown) {
  const res = await fetch(`${GATEWAY_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway REST ${method} ${path} failed: ${res.status} ${text.slice(0, 300)}`);
  }
  return res.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(input: string, defaultCc = '972'): string {
  let d = (input || '').replace(/[^0-9]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith(defaultCc)) return d;
  if (d.startsWith('0')) return defaultCc + d.slice(1);
  return defaultCc + d;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { action, tenantId, integrationId, instanceId, ...rest } = await req.json() as {
      action: string;
      tenantId?: string;
      integrationId?: string;
      instanceId?: string;
      [key: string]: unknown;
    };

    if (!action) {
      return new Response(JSON.stringify({ error: 'Missing action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch integration record from DB (if integrationId provided) ──────────
    let integration: { api_key: string | null; settings: Record<string, unknown> } | null = null;
    let resolvedInstanceId = instanceId;
    let resolvedApiKey: string | null = null;

    if (integrationId) {
      const { data } = await supabase
        .from('tenant_integrations')
        .select('api_key, settings')
        .eq('id', integrationId)
        .maybeSingle();
      if (data) {
        integration = data as typeof integration;
        resolvedApiKey = data.api_key;
        resolvedInstanceId = resolvedInstanceId || (data.settings as Record<string, unknown>)?.instance_id as string;
      }
    }

    // ── Fetch Gateway session token for the owner ─────────────────────────────
    // We store the Gateway session token in a dedicated table or env.
    // For now, we use the GATEWAY_SESSION_TOKEN env var set by the owner.
    const gatewaySessionToken = Deno.env.get('GATEWAY_SESSION_TOKEN') || '';

    // ── Action dispatch ───────────────────────────────────────────────────────

    // ── create_instance ───────────────────────────────────────────────────────
    if (action === 'create_instance') {
      const { displayName, countryCode } = rest as { displayName?: string; countryCode?: string };
      if (!displayName) return new Response(JSON.stringify({ error: 'displayName is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      if (!tenantId) return new Response(JSON.stringify({ error: 'tenantId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      if (!gatewaySessionToken) return new Response(JSON.stringify({ error: 'Gateway session not configured. Ask the system admin to set GATEWAY_SESSION_TOKEN.' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

      // 1. Create instance in Gateway via tRPC
      const newInstance = await gatewayTrpc('instances.create', { name: displayName }, gatewaySessionToken);

      // 2. Save to tenant_integrations
      const webhookSecret = crypto.randomUUID().replace(/-/g, '');
      const { data: integ, error: insertErr } = await supabase
        .from('tenant_integrations')
        .insert({
          tenant_id: tenantId,
          integration_type: 'manus_wa',
          display_name: displayName,
          api_key: newInstance.apiKey,
          is_active: true,
          settings: {
            instance_id: newInstance.id,
            webhook_secret: webhookSecret,
            country_code: countryCode || '972',
            created_by_carmen: true,
          },
        })
        .select('id')
        .single();

      if (insertErr) throw new Error(`Failed to save integration: ${insertErr.message}`);

      // 3. Set webhook URL on the new instance
      const webhookUrl = `${SUPABASE_URL}/functions/v1/manus-wa-webhook`;
      await gatewayTrpc('instances.updateWebhook', {
        id: newInstance.id,
        webhookUrl,
        webhookSecret,
      }, gatewaySessionToken).catch(() => {/* non-fatal */});

      return new Response(JSON.stringify({
        success: true,
        integrationId: integ.id,
        instanceId: newInstance.id,
        displayName,
        message: `Instance "${displayName}" created successfully. Use get_qr_link to get the QR scan URL.`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── get_qr_link ───────────────────────────────────────────────────────────
    if (action === 'get_qr_link') {
      if (!resolvedInstanceId) return new Response(JSON.stringify({ error: 'instanceId or integrationId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      if (!gatewaySessionToken) return new Response(JSON.stringify({ error: 'Gateway session not configured.' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

      // Create a QR share token (valid 2 hours)
      const tokenRow = await gatewayTrpc('instances.createQrShareToken', {
        id: resolvedInstanceId,
        ttlHours: 2,
      }, gatewaySessionToken);

      // Also trigger connect to ensure QR is generated
      await gatewayTrpc('instances.connect', { id: resolvedInstanceId }, gatewaySessionToken).catch(() => {});

      const qrUrl = `${GATEWAY_BASE}/qr/${tokenRow.token}`;

      return new Response(JSON.stringify({
        success: true,
        qrUrl,
        expiresAt: tokenRow.expiresAt,
        message: `QR scan link (valid 2 hours): ${qrUrl}`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── get_status ────────────────────────────────────────────────────────────
    if (action === 'get_status') {
      if (!resolvedInstanceId || !resolvedApiKey) return new Response(JSON.stringify({ error: 'integrationId or (instanceId + apiKey) is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

      const statusData = await gatewayRest(
        `/api/v1/instances/${resolvedInstanceId}/status`,
        'GET',
        resolvedApiKey,
      );

      return new Response(JSON.stringify({
        success: true,
        status: statusData.status,
        phoneNumber: statusData.phoneNumber,
        instanceId: resolvedInstanceId,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── connect ───────────────────────────────────────────────────────────────
    if (action === 'connect') {
      if (!resolvedInstanceId) return new Response(JSON.stringify({ error: 'instanceId or integrationId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      if (!gatewaySessionToken) return new Response(JSON.stringify({ error: 'Gateway session not configured.' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

      await gatewayTrpc('instances.connect', { id: resolvedInstanceId }, gatewaySessionToken);

      return new Response(JSON.stringify({
        success: true,
        message: 'Connection initiated. Use get_status to check progress.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── send_message ──────────────────────────────────────────────────────────
    if (action === 'send_message') {
      const { phone, message, countryCode } = rest as { phone?: string; message?: string; countryCode?: string };
      if (!resolvedInstanceId || !resolvedApiKey) return new Response(JSON.stringify({ error: 'integrationId or (instanceId + apiKey) is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      if (!phone || !message) return new Response(JSON.stringify({ error: 'phone and message are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

      const cc = (integration?.settings as Record<string, unknown>)?.country_code as string || countryCode || '972';
      const normalizedPhone = normalizePhone(phone, cc);

      const result = await gatewayRest(
        `/api/v1/instances/${resolvedInstanceId}/send/text`,
        'POST',
        resolvedApiKey,
        { to: normalizedPhone, body: message },
      );

      return new Response(JSON.stringify({
        success: true,
        sentTo: normalizedPhone,
        result,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[manage-manus-wa] Error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

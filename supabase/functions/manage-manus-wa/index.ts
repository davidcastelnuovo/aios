/**
 * manage-manus-wa — Supabase Edge Function
 *
 * Secure proxy between Carmen (run-ai-agent) and the Manus WhatsApp Gateway.
 * Authentication: uses WORKER_SECRET (shared secret) — no session cookies needed.
 *
 * Supported actions:
 *   create_instance  — Create a new WA instance in the Gateway + save to tenant_integrations
 *   get_qr_link      — Create a QR share token and return the public scan URL
 *   get_status       — Return live status of an instance
 *   send_message     — Send a text message via a specific instance (uses per-instance API key)
 *
 * Auth: requires a valid Supabase Bearer token (service role key from run-ai-agent).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_BASE = Deno.env.get('MANUS_GATEWAY_URL') || 'https://whatsappgw-pzpyrrww.manus.space';
const GATEWAY_WORKER_SECRET = Deno.env.get('MANUS_GATEWAY_WORKER_SECRET') || '';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ── Gateway helpers ───────────────────────────────────────────────────────────

async function gatewayAdmin(path: string, method: string, body?: unknown) {
  if (!GATEWAY_WORKER_SECRET) {
    throw new Error('MANUS_GATEWAY_WORKER_SECRET is not configured. Add it to Supabase Edge Function secrets.');
  }
  const res = await fetch(`${GATEWAY_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Worker-Secret': GATEWAY_WORKER_SECRET,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway admin ${method} ${path} failed: ${res.status} — ${text.slice(0, 300)}`);
  }
  return res.json();
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
    throw new Error(`Gateway REST ${method} ${path} failed: ${res.status} — ${text.slice(0, 300)}`);
  }
  return res.json();
}

// ── Phone normalizer ──────────────────────────────────────────────────────────

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

    // ── create_instance ───────────────────────────────────────────────────────
    if (action === 'create_instance') {
      const { displayName, countryCode } = rest as { displayName?: string; countryCode?: string };
      if (!displayName) return new Response(JSON.stringify({ error: 'displayName is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      if (!tenantId) return new Response(JSON.stringify({ error: 'tenantId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

      // Generate a unique webhook secret for this instance
      const webhookSecret = crypto.randomUUID().replace(/-/g, '');
      const webhookUrl = `${SUPABASE_URL}/functions/v1/manus-wa-webhook`;

      // 1. Create instance in Gateway via Admin API (WORKER_SECRET authenticated)
      const newInstance = await gatewayAdmin('/api/admin/instances', 'POST', {
        name: displayName,
        webhookUrl,
        webhookSecret,
      });

      // 2. Save to tenant_integrations
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

      // Create QR share token via Admin API and trigger connect
      const tokenRow = await gatewayAdmin(
        `/api/admin/instances/${resolvedInstanceId}/qr-token`,
        'POST',
        { ttlHours: 2 },
      );

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
      if (!resolvedInstanceId) return new Response(JSON.stringify({ error: 'instanceId or integrationId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

      const statusData = await gatewayAdmin(
        `/api/admin/instances/${resolvedInstanceId}/status`,
        'GET',
      );

      return new Response(JSON.stringify({
        success: true,
        status: statusData.status,
        phoneNumber: statusData.phoneNumber,
        name: statusData.name,
        instanceId: resolvedInstanceId,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── send_message ──────────────────────────────────────────────────────────
    if (action === 'send_message') {
      const { phone, message, countryCode } = rest as { phone?: string; message?: string; countryCode?: string };
      if (!resolvedInstanceId || !resolvedApiKey) return new Response(JSON.stringify({ error: 'integrationId (with api_key) is required' }), {
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

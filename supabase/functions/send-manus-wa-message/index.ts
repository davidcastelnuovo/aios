import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = 'https://whatsappgw-pzpyrrww.manus.space';

// Normalize Israeli/intl phone to digits-only with country code default 972.
function toGatewayPhone(input: string, defaultCc = '972'): string {
  let d = (input || '').replace(/[^0-9]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith(defaultCc)) return d;
  if (d.startsWith('0')) return defaultCc + d.slice(1);
  return defaultCc + d;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const isServiceRole = token === SERVICE_ROLE_KEY;

    let userId = '';
    if (!isServiceRole) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: { user }, error } = await userClient.auth.getUser(token);
      if (error || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      userId = user.id;
    }

    const supabase = createClient(
      SUPABASE_URL,
      isServiceRole ? SERVICE_ROLE_KEY : SUPABASE_ANON_KEY,
      isServiceRole
        ? { auth: { persistSession: false } }
        : { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );

    const body = await req.json();
    const {
      clientId, leadId, groupId, message, phoneNumber, tenantId: providedTenantId,
      senderUserId, integrationId
    } = body;

    if (isServiceRole) {
      if (!senderUserId) {
        return new Response(JSON.stringify({ error: 'senderUserId required for service role' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      userId = senderUserId;
    }

    if (!message) {
      return new Response(JSON.stringify({ error: 'Missing message' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Resolve tenant + group chat id
    let tenantId: string | undefined = providedTenantId;
    let groupChatId: string | undefined;
    if (!tenantId && clientId) {
      const { data } = await supabase.from('clients').select('tenant_id').eq('id', clientId).single();
      tenantId = data?.tenant_id;
    } else if (!tenantId && leadId) {
      const { data } = await supabase.from('leads').select('tenant_id').eq('id', leadId).single();
      tenantId = data?.tenant_id;
    }
    if (groupId) {
      const { data: group } = await supabase
        .from('whatsapp_groups')
        .select('tenant_id, group_chat_id')
        .eq('id', groupId)
        .single();
      if (!tenantId) tenantId = group?.tenant_id;
      groupChatId = group?.group_chat_id;
    }
    if (!tenantId) {
      const { data } = await supabase.from('user_active_tenant').select('tenant_id').eq('user_id', userId).single();
      tenantId = data?.tenant_id;
    }
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (groupId && !groupChatId) {
      return new Response(JSON.stringify({ error: 'Group chat id not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find integration
    let integ: any = null;
    if (integrationId) {
      const { data } = await supabase.from('tenant_integrations').select('*')
        .eq('id', integrationId).eq('tenant_id', tenantId).maybeSingle();
      integ = data;
    } else {
      const { data } = await supabase.from('tenant_integrations').select('*')
        .eq('tenant_id', tenantId).eq('user_id', userId)
        .eq('integration_type', 'manus_wa').eq('is_active', true)
        .order('created_at', { ascending: true }).limit(1);
      integ = data?.[0] || null;
    }

    if (!integ?.api_key || !(integ?.settings as any)?.instance_id) {
      return new Response(JSON.stringify({ error: 'Manus WhatsApp not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const settings = integ.settings as any;
    const instanceId = settings.instance_id;
    const apiKey = integ.api_key;
    const cc = (settings.country_code || settings.default_country_code || '972').toString();
    // For groups, send chat id as-is (e.g. "1234567890-9876543210@g.us"); otherwise normalize phone.
    const to = groupChatId
      ? groupChatId
      : toGatewayPhone(String(phoneNumber || ''), /^\d{1,3}$/.test(cc) ? cc : '972');

    const url = groupChatId
      ? `${BASE_URL}/api/v1/instances/${instanceId}/send/group`
      : `${BASE_URL}/api/v1/instances/${instanceId}/send/text`;
    const payload = groupChatId
      ? { groupId: groupChatId, body: message }
      : { to, body: message };
    console.log('[send-manus-wa] POST', url, 'to=', to, 'instanceId=', instanceId, 'messageLen=', message.length);

    // IMPORTANT: Do NOT retry on client-side AbortError/timeout. When our fetch times out,
    // the request often already reached Manus and a message was actually delivered to WhatsApp.
    // A naive retry then results in the recipient getting the same message twice.
    // We only retry on: explicit Manus-internal timeout reported in response body, or 5xx responses.
    const MAX_ATTEMPTS = 2;
    const FETCH_TIMEOUT_MS = 60000; // was 25s — too short; Manus can take 30-40s on slow paths
    let res: Response | null = null;
    let respText = '';
    let respData: any = null;
    let lastErr: any = null;
    let abortedOnce = false;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timer);
        respText = await res.text();
        try { respData = JSON.parse(respText); } catch { respData = { raw: respText }; }
        const elapsed = Date.now() - started;
        console.log('[send-manus-wa] attempt', attempt, 'response', { status: res.status, ok: res.ok, elapsedMs: elapsed, body: respText.slice(0, 500) });

        // Manus-internal timeout in body (e.g. "timeout of 8000ms exceeded") => Manus itself reports failure, retry is safer.
        const isManusTimeout = typeof respData?.error === 'string' && /timeout of \d+ms exceeded/i.test(respData.error);
        if (res.ok && respData?.success !== false) break;
        if (!isManusTimeout && res.status < 500) {
          // non-retryable client error
          break;
        }
        lastErr = new Error(`Manus WA error [${res.status}]: ${respText.slice(0, 300)}`);
      } catch (err: any) {
        clearTimeout(timer);
        const elapsed = Date.now() - started;
        const isAbort = err?.name === 'AbortError';
        console.error('[send-manus-wa] attempt', attempt, isAbort ? 'aborted (timeout) — NOT retrying to avoid duplicate delivery' : 'fetch error', { elapsedMs: elapsed, msg: err?.message });
        lastErr = err;
        if (isAbort) {
          abortedOnce = true;
          // Stop the loop: we cannot know if Manus delivered the message or not, and a retry would risk a duplicate.
          break;
        }
      }

      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (abortedOnce && (!res || !res.ok)) {
      // Return a soft-failure: we don't know if the message was delivered. Caller should treat as "in-flight"
      // and must NOT retry, otherwise the recipient may receive duplicates.
      console.warn('[send-manus-wa] aborted without confirmation — returning 202 to signal "delivery unknown, do not retry"');
      return new Response(JSON.stringify({
        success: false,
        delivered: 'unknown',
        error: 'Manus gateway did not respond within timeout; message may or may not have been delivered. Not retried to avoid duplicate sends.',
      }), {
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!res || !res.ok || respData?.success === false) {
      throw lastErr || new Error(`Manus WA error [${res?.status ?? 'no-response'}]: ${JSON.stringify(respData)}`);
    }

    // Save to chat_messages
    const { error: insertError } = await supabase.from('chat_messages').insert({
      client_id: clientId || null,
      lead_id: leadId || null,
      group_id: groupId || null,
      tenant_id: tenantId,
      connection_user_id: integ.user_id || userId,
      message_text: message,
      direction: 'outbound',
      channel: 'whatsapp',
      provider: 'manus_wa',
      sent_by_user_id: userId,
      raw_provider_data: respData,
      sender_phone: groupChatId ? null : to,
    });
    if (insertError) console.error('Failed to save message:', insertError);

    return new Response(JSON.stringify({ success: true, messageId: respData.messageId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('send-manus-wa-message error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-gateway-instance, x-wa-gateway-secret',
};

// Last 9 digits — matches existing lead/client matching policy
function normalizePhone(p: string): string {
  return (p || '').replace(/\D/g, '').slice(-9);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    const headerInstanceId = req.headers.get('x-wa-gateway-instance') || '';
    const headerSecret = req.headers.get('x-wa-gateway-secret') || '';
    const instanceId = payload.instanceId || headerInstanceId;

    if (!instanceId) {
      return new Response(JSON.stringify({ error: 'Missing instanceId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find integration by instance ID
    const { data: integrations } = await supabase
      .from('tenant_integrations')
      .select('id, tenant_id, user_id, settings, api_key')
      .eq('integration_type', 'manus_wa')
      .eq('is_active', true)
      .filter('settings->>instance_id', 'eq', String(instanceId))
      .order('created_at', { ascending: false })
      .limit(1);

    const integ = integrations?.[0];
    if (!integ) {
      console.error('No active manus_wa integration for instance', instanceId);
      return new Response(JSON.stringify({ error: 'No active integration' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const settings = (integ.settings as any) || {};
    const expectedSecret = settings.webhook_secret;
    if (expectedSecret && expectedSecret !== headerSecret) {
      console.error('Webhook secret mismatch for instance', instanceId);
      return new Response(JSON.stringify({ error: 'Invalid secret' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const tenantId = integ.tenant_id;
    const connectionUserId = integ.user_id;
    const event = payload.event;

    // ===== Message ACK (delivery receipt) =====
    if (event === 'message_ack') {
      const messageId = payload.messageId;
      const ack = Number(payload.ack);
      if (!messageId) {
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Find existing message by raw_provider_data->messageId
      const { data: msg } = await supabase
        .from('chat_messages')
        .select('id, read_at')
        .eq('tenant_id', tenantId)
        .eq('provider', 'manus_wa')
        .eq('raw_provider_data->>messageId', String(messageId))
        .maybeSingle();

      if (msg) {
        const update: Record<string, unknown> = {};
        if (ack >= 3 && !msg.read_at) update.read_at = new Date().toISOString();
        if (Object.keys(update).length > 0) {
          await supabase.from('chat_messages').update(update).eq('id', msg.id);
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== Incoming message =====
    if (event !== 'message') {
      return new Response(JSON.stringify({ received: true, ignored: event }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const fromRaw = String(payload.from || '');
    const toRaw = String(payload.to || '');
    const isGroup = fromRaw.endsWith('@g.us');

    // Determine direction: if "from" matches my instance's own phone (settings.phone_number), it's outbound from WA app.
    const myPhone = (settings.phone_number || '').toString();
    const fromDigits = fromRaw.split('@')[0];
    const isOutgoingFromPhone = myPhone && fromDigits === myPhone;
    const counterpartRaw = isOutgoingFromPhone ? toRaw : fromRaw;
    const counterpartPhone = counterpartRaw.split('@')[0];
    const normalized = normalizePhone(counterpartPhone);

    if (isGroup) {
      // Skip group messages for now (no group infrastructure built for manus_wa yet)
      return new Response(JSON.stringify({ received: true, skippedGroup: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Dedup by message id
    const messageId = String(payload.id || '');
    if (messageId) {
      const { data: existing } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('provider', 'manus_wa')
        .eq('raw_provider_data->>id', messageId)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Look up client/lead by phone (last 9 digits)
    let clientId: string | null = null;
    let leadId: string | null = null;

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`phone.ilike.%${normalized}%,phone.ilike.%${counterpartPhone}%`)
      .maybeSingle();
    if (client) clientId = client.id;

    if (!clientId) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('tenant_id', tenantId)
        .or(`phone.ilike.%${normalized}%,phone.ilike.%${counterpartPhone}%`)
        .maybeSingle();
      if (lead) leadId = lead.id;
    }

    const messageText = payload.body || (payload.hasMedia ? '[מדיה]' : '');

    const { error: insertError } = await supabase.from('chat_messages').insert({
      client_id: clientId,
      lead_id: leadId,
      tenant_id: tenantId,
      connection_user_id: connectionUserId,
      message_text: messageText,
      direction: isOutgoingFromPhone ? 'outbound' : 'inbound',
      channel: 'whatsapp',
      provider: 'manus_wa',
      sender_phone: counterpartPhone,
      raw_provider_data: payload,
    });

    if (insertError) {
      console.error('Failed to insert chat_messages:', insertError);
      throw insertError;
    }

    return new Response(JSON.stringify({
      success: true,
      contactType: clientId ? 'client' : leadId ? 'lead' : 'unknown',
      contactId: clientId || leadId || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('manus-wa-webhook error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

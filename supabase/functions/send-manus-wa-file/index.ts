import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = 'https://whatsappgw-pzpyrrww.manus.space';

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
      clientId, leadId, phoneNumber, tenantId: providedTenantId, integrationId,
      fileUrl, imageUrl, mimeType, filename, caption, senderUserId
    } = body;

    if (isServiceRole && senderUserId) userId = senderUserId;

    const urlToSend = imageUrl || fileUrl;
    if (!urlToSend) {
      return new Response(JSON.stringify({ error: 'Missing fileUrl or imageUrl' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Resolve tenant
    let tenantId: string | undefined = providedTenantId;
    if (!tenantId && clientId) {
      const { data } = await supabase.from('clients').select('tenant_id').eq('id', clientId).single();
      tenantId = data?.tenant_id;
    } else if (!tenantId && leadId) {
      const { data } = await supabase.from('leads').select('tenant_id').eq('id', leadId).single();
      tenantId = data?.tenant_id;
    }
    if (!tenantId && userId) {
      const { data } = await supabase.from('user_active_tenant').select('tenant_id').eq('user_id', userId).single();
      tenantId = data?.tenant_id;
    }
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let integ: any = null;
    if (integrationId) {
      const { data } = await supabase.from('tenant_integrations').select('*')
        .eq('id', integrationId).eq('tenant_id', tenantId).maybeSingle();
      integ = data;
    } else {
      const { data } = await supabase.from('tenant_integrations').select('*')
        .eq('tenant_id', tenantId).eq('user_id', userId)
        .eq('integration_type', 'manus_wa').eq('is_active', true).maybeSingle();
      integ = data;
    }

    if (!integ?.api_key || !(integ?.settings as any)?.instance_id) {
      return new Response(JSON.stringify({ error: 'Manus WhatsApp not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const settings = integ.settings as any;
    const instanceId = settings.instance_id;
    const apiKey = integ.api_key;
    const cc = (settings.country_code || '972').toString();
    const phone = toGatewayPhone(String(phoneNumber || ''), /^\d{1,3}$/.test(cc) ? cc : '972');

    // Choose endpoint: image if imageUrl provided or mimeType starts with image/
    const isImage = !!imageUrl || (mimeType || '').startsWith('image/');
    const endpoint = isImage ? 'send/image' : 'send/file';
    const url = `${BASE_URL}/api/v1/instances/${instanceId}/${endpoint}`;

    const payload: Record<string, unknown> = { to: phone, caption: caption || undefined, filename: filename || undefined };
    if (isImage) payload.imageUrl = urlToSend;
    else { payload.fileUrl = urlToSend; payload.mimeType = mimeType || 'application/octet-stream'; }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const respText = await res.text();
    let respData: any;
    try { respData = JSON.parse(respText); } catch { respData = { raw: respText }; }
    if (!res.ok || respData?.success === false) {
      throw new Error(`Manus WA error [${res.status}]: ${JSON.stringify(respData)}`);
    }

    const messageText = caption || (isImage ? '[תמונה]' : `[קובץ: ${filename || 'file'}]`);
    await supabase.from('chat_messages').insert({
      client_id: clientId || null,
      lead_id: leadId || null,
      tenant_id: tenantId,
      connection_user_id: integ.user_id || userId,
      message_text: messageText,
      direction: 'outbound',
      channel: 'whatsapp',
      provider: 'manus_wa',
      sent_by_user_id: userId,
      raw_provider_data: { ...respData, fileUrl: urlToSend, mimeType, filename, isImage },
      sender_phone: phone,
    });

    return new Response(JSON.stringify({ success: true, messageId: respData.messageId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('send-manus-wa-file error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

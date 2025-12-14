import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false }
      }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const clientId = formData.get('clientId') as string | null;
    const leadId = formData.get('leadId') as string | null;
    const groupId = formData.get('groupId') as string | null;
    const phoneNumber = formData.get('phoneNumber') as string | null;
    const tenantId = formData.get('tenantId') as string | null;
    const caption = formData.get('caption') as string || '';
    const fileType = formData.get('fileType') as string || 'document';

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('📤 Sending file:', file.name, 'type:', file.type, 'size:', file.size);

    // Determine tenant_id
    let resolvedTenantId = tenantId;
    let groupChatId: string | undefined;

    if (!resolvedTenantId && clientId) {
      const { data: client } = await supabaseClient.from('clients').select('tenant_id').eq('id', clientId).single();
      resolvedTenantId = client?.tenant_id;
    } else if (!resolvedTenantId && leadId) {
      const { data: lead } = await supabaseClient.from('leads').select('tenant_id').eq('id', leadId).single();
      resolvedTenantId = lead?.tenant_id;
    } else if (groupId) {
      const { data: group } = await supabaseClient.from('whatsapp_groups').select('tenant_id, group_chat_id').eq('id', groupId).single();
      resolvedTenantId = resolvedTenantId || group?.tenant_id;
      groupChatId = group?.group_chat_id;
    }

    if (!resolvedTenantId) {
      const { data: activeTenant } = await supabaseClient.from('user_active_tenant').select('tenant_id').eq('user_id', user.id).single();
      resolvedTenantId = activeTenant?.tenant_id;
    }

    if (!resolvedTenantId) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Green API integration
    const { data: integration } = await supabaseClient
      .from('tenant_integrations')
      .select('*')
      .eq('tenant_id', resolvedTenantId)
      .eq('user_id', user.id)
      .eq('integration_type', 'green_api')
      .eq('is_active', true)
      .maybeSingle();

    if (!integration?.api_key || !integration?.settings?.instance_id) {
      return new Response(JSON.stringify({ error: 'Green API not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const instanceId = integration.settings.instance_id;
    const apiToken = integration.api_key;

    // Determine chatId
    let chatId: string;
    if (groupChatId) {
      chatId = groupChatId;
    } else {
      const originalPhone = String(phoneNumber || '');
      let digits = originalPhone.replace(/[^0-9]/g, '');
      if (digits.startsWith('00')) digits = digits.slice(2);
      const defaultCountryCode = (integration.settings?.country_code || '972').toString();
      if (!digits.startsWith(defaultCountryCode)) {
        digits = digits.startsWith('0') ? defaultCountryCode + digits.slice(1) : defaultCountryCode + digits;
      }
      chatId = `${digits}@c.us`;
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Determine API endpoint based on file type
    let endpoint: string;
    let body: any;

    const mimeType = file.type;
    const fileName = file.name;

    if (fileType === 'voice' || mimeType.startsWith('audio/')) {
      endpoint = `https://api.green-api.com/waInstance${instanceId}/sendFileByUpload/${apiToken}`;
      
      // For voice messages, use sendFileByUpload with audio file
      const uploadFormData = new FormData();
      uploadFormData.append('chatId', chatId);
      uploadFormData.append('file', file, fileName);
      if (caption) uploadFormData.append('caption', caption);

      console.log('🎤 Sending voice message via sendFileByUpload');
      
      const response = await fetch(endpoint, {
        method: 'POST',
        body: uploadFormData,
      });

      const responseData = await response.json();
      console.log('📥 Green API response:', responseData);

      if (!response.ok) {
        throw new Error(`Green API error: ${JSON.stringify(responseData)}`);
      }

      // Save to database
      await supabaseClient.from('chat_messages').insert({
        client_id: clientId || null,
        lead_id: leadId || null,
        group_id: groupId || null,
        tenant_id: resolvedTenantId,
        connection_user_id: user.id,
        message_text: `[הודעה קולית]${caption ? ': ' + caption : ''}`,
        direction: 'outbound',
        channel: 'whatsapp',
        provider: 'green_api',
        sent_by_user_id: user.id,
        raw_provider_data: responseData,
        sender_phone: !groupChatId ? chatId.replace('@c.us', '') : null,
      });

      return new Response(JSON.stringify({ success: true, messageId: responseData.idMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For images, videos, documents
    if (mimeType.startsWith('image/')) {
      endpoint = `https://api.green-api.com/waInstance${instanceId}/sendFileByUpload/${apiToken}`;
    } else if (mimeType.startsWith('video/')) {
      endpoint = `https://api.green-api.com/waInstance${instanceId}/sendFileByUpload/${apiToken}`;
    } else {
      endpoint = `https://api.green-api.com/waInstance${instanceId}/sendFileByUpload/${apiToken}`;
    }

    // Use FormData for file upload
    const uploadFormData = new FormData();
    uploadFormData.append('chatId', chatId);
    uploadFormData.append('file', file, fileName);
    if (caption) uploadFormData.append('caption', caption);

    console.log('📤 Sending file via Green API:', { endpoint, chatId, fileName });

    const response = await fetch(endpoint, {
      method: 'POST',
      body: uploadFormData,
    });

    const responseData = await response.json();
    console.log('📥 Green API response:', responseData);

    if (!response.ok) {
      throw new Error(`Green API error: ${JSON.stringify(responseData)}`);
    }

    // Determine message text based on file type
    let messageText = '';
    if (mimeType.startsWith('image/')) {
      messageText = caption || '[תמונה]';
    } else if (mimeType.startsWith('video/')) {
      messageText = caption || '[וידאו]';
    } else {
      messageText = `[מסמך: ${fileName}]${caption ? ' - ' + caption : ''}`;
    }

    // Save to database
    await supabaseClient.from('chat_messages').insert({
      client_id: clientId || null,
      lead_id: leadId || null,
      group_id: groupId || null,
      tenant_id: resolvedTenantId,
      connection_user_id: user.id,
      message_text: messageText,
      direction: 'outbound',
      channel: 'whatsapp',
      provider: 'green_api',
      sent_by_user_id: user.id,
      raw_provider_data: responseData,
      sender_phone: !groupChatId ? chatId.replace('@c.us', '') : null,
    });

    return new Response(JSON.stringify({ success: true, messageId: responseData.idMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in send-green-api-file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

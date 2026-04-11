import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
    if (!TELEGRAM_API_KEY) throw new Error('TELEGRAM_API_KEY not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { bot_token, tenant_id } = await req.json();

    if (!bot_token || !tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'bot_token and tenant_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify bot by calling getMe through the gateway
    const response = await fetch(`${GATEWAY_URL}/getMe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TELEGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bot token verification failed. Check your token.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const botInfo = data.result;

    // Upsert bot state
    const { error: upsertErr } = await supabase
      .from('telegram_bot_state')
      .upsert({
        tenant_id,
        bot_username: botInfo.username,
        bot_name: botInfo.first_name,
        is_active: true,
        update_offset: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id' });

    if (upsertErr) {
      return new Response(
        JSON.stringify({ success: false, error: upsertErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        bot_name: botInfo.first_name,
        bot_username: botInfo.username,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error verifying Telegram bot:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

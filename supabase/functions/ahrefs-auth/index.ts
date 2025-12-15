import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ahrefsApiKey = Deno.env.get('AHREFS_API_KEY');

    if (!ahrefsApiKey) {
      return new Response(
        JSON.stringify({ error: 'Ahrefs API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: activeTenant } = await supabase
      .from('user_active_tenant')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    const tenantId = activeTenant?.tenant_id;
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'No active tenant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Test the API key by fetching subscription info
    if (action === 'test' || action === 'connect') {
      console.log('Testing Ahrefs API connection...');
      
      const testResponse = await fetch('https://api.ahrefs.com/v3/subscription-info', {
        headers: {
          'Authorization': `Bearer ${ahrefsApiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!testResponse.ok) {
        const errorText = await testResponse.text();
        console.error('Ahrefs API test failed:', errorText);
        return new Response(
          JSON.stringify({ error: 'Invalid API key or insufficient permissions', details: errorText }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const subscriptionInfo = await testResponse.json();
      console.log('Ahrefs subscription info:', subscriptionInfo);

      // Save/update integration
      const { data: existingIntegration } = await supabase
        .from('tenant_integrations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'ahrefs')
        .eq('user_id', user.id)
        .maybeSingle();

      const integrationData = {
        tenant_id: tenantId,
        user_id: user.id,
        integration_type: 'ahrefs',
        is_active: true,
        settings: {
          connected_at: new Date().toISOString(),
          subscription: subscriptionInfo,
          api_key_configured: true,
        },
      };

      if (existingIntegration) {
        await supabase
          .from('tenant_integrations')
          .update(integrationData)
          .eq('id', existingIntegration.id);
      } else {
        await supabase
          .from('tenant_integrations')
          .insert(integrationData);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          subscription: subscriptionInfo,
          message: 'Ahrefs connected successfully'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get integration status
    if (action === 'status') {
      const { data: integration } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'ahrefs')
        .eq('user_id', user.id)
        .maybeSingle();

      return new Response(
        JSON.stringify({ 
          connected: !!integration?.is_active,
          integration 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Disconnect
    if (action === 'disconnect') {
      await supabase
        .from('tenant_integrations')
        .update({ is_active: false })
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'ahrefs')
        .eq('user_id', user.id);

      return new Response(
        JSON.stringify({ success: true, message: 'Disconnected from Ahrefs' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ahrefs-auth:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

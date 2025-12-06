import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceId, apiToken } = await req.json();
    
    console.log(`🔧 Configuring Green API webhooks for instance: ${instanceId}`);

    if (!instanceId || !apiToken) {
      console.error("❌ Missing instanceId or apiToken");
      return new Response(
        JSON.stringify({ error: "Missing instanceId or apiToken" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const webhookUrl = `${supabaseUrl}/functions/v1/green-api-webhook`;

    console.log(`📡 Setting webhook URL to: ${webhookUrl}`);

    // Configure Green API settings via their API
    const settingsUrl = `https://api.green-api.com/waInstance${instanceId}/setSettings/${apiToken}`;
    
    const settingsPayload = {
      webhookUrl: webhookUrl,
      webhookUrlToken: "",
      outgoingWebhook: "yes",
      outgoingMessageWebhook: "yes",
      outgoingAPIMessageWebhook: "yes",
      incomingWebhook: "yes",
      stateWebhook: "no",
      deviceWebhook: "no",
    };

    console.log(`📤 Sending settings to Green API:`, JSON.stringify(settingsPayload, null, 2));

    const response = await fetch(settingsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settingsPayload),
    });

    const responseText = await response.text();
    console.log(`📥 Green API response status: ${response.status}`);
    console.log(`📥 Green API response body: ${responseText}`);

    if (!response.ok) {
      console.error(`❌ Green API error: ${responseText}`);
      return new Response(
        JSON.stringify({ 
          error: "Failed to configure Green API", 
          details: responseText 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    console.log(`✅ Green API configured successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhook settings configured successfully",
        result 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Error configuring Green API:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

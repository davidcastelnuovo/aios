import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenant_id');

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'Missing tenant_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { event, payload } = body;

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get tenant's Zoom integration settings
    const { data: integration } = await supabase
      .from('tenant_integrations')
      .select('settings')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'zoom')
      .eq('is_active', true)
      .maybeSingle();

    const settings = integration?.settings as Record<string, string> | null;
    const webhookSecretToken = settings?.webhook_secret_token;

    // Handle Zoom endpoint validation challenge
    if (event === 'endpoint.url_validation') {
      const plainToken = payload?.plainToken;
      if (!plainToken || !webhookSecretToken) {
        return new Response(JSON.stringify({ error: 'Missing plainToken or webhook secret' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const encryptedToken = await hmacSha256Hex(webhookSecretToken, plainToken);

      return new Response(JSON.stringify({
        plainToken,
        encryptedToken,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle recording.completed event
    if (event === 'recording.completed') {
      const meetingObject = payload?.object;
      if (!meetingObject) {
        return new Response(JSON.stringify({ error: 'No meeting object in payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const recordingFiles = meetingObject.recording_files || [];
      const insertRows = recordingFiles.map((file: any) => ({
        tenant_id: tenantId,
        meeting_id: String(meetingObject.id || meetingObject.uuid || ''),
        meeting_topic: meetingObject.topic || null,
        host_email: meetingObject.host_email || null,
        start_time: meetingObject.start_time || null,
        duration: meetingObject.duration || null,
        recording_url: file.play_url || file.download_url || null,
        recording_password: meetingObject.password || payload?.download_token || null,
        recording_type: file.recording_type || null,
        file_size: file.file_size || null,
      }));

      if (insertRows.length > 0) {
        const { error } = await supabase
          .from('zoom_recordings')
          .insert(insertRows);

        if (error) {
          console.error('Error inserting zoom recordings:', error);
          return new Response(JSON.stringify({ error: 'Failed to save recordings' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({ success: true, count: insertRows.length }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For any other event, acknowledge
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Zoom webhook error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

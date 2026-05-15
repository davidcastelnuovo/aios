// Receives Google Calendar push notifications and triggers an incremental sync.
// Google posts here whenever an event changes on a watched calendar.
// We MUST respond fast (<= a few seconds) and NOT trust the payload.
// We identify the user via the channel id header and fire-and-forget the sync.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-goog-channel-id, x-goog-resource-id, x-goog-resource-state, x-goog-message-number, x-goog-channel-token, x-goog-channel-expiration, x-goog-resource-uri',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const channelId = req.headers.get('x-goog-channel-id');
    const resourceState = req.headers.get('x-goog-resource-state');
    const resourceId = req.headers.get('x-goog-resource-id');

    console.log('Google Calendar webhook hit:', { channelId, resourceState, resourceId });

    // Google sends a "sync" message right after watch creation. Ack and stop.
    if (!channelId || resourceState === 'sync') {
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: token } = await serviceClient
      .from('calendar_tokens')
      .select('user_id')
      .eq('watch_channel_id', channelId)
      .maybeSingle();

    if (!token?.user_id) {
      console.warn('Webhook received for unknown channel id:', channelId);
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    // Fire-and-forget: kick the sync function but don't wait for it.
    fetch(`${supabaseUrl}/functions/v1/google-calendar-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
      },
      body: JSON.stringify({ user_id: token.user_id, source: 'webhook' }),
    }).catch((e) => console.error('Failed to trigger sync:', e));

    return new Response('ok', { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('google-calendar-webhook error:', error);
    // Always 200 to Google so it doesn't keep retrying.
    return new Response('ok', { status: 200, headers: corsHeaders });
  }
});

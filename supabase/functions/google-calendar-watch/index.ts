// Starts (or renews) a Google Calendar push notifications channel for a user.
// Stores channel id, resource id, and expiration on calendar_tokens.
//
// Auth:
//  - Service role: can pass { user_id } to renew on behalf of any user (used by cron).
//  - Authenticated user: starts/renews a watch on their own calendar (no body needed).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function refreshAccessTokenIfNeeded(serviceClient: any, token: any): Promise<{ accessToken: string; needsReconnect: boolean }> {
  const expiresAt = new Date(token.expires_at);
  if (expiresAt > new Date(Date.now() + 60_000)) {
    return { accessToken: token.access_token, needsReconnect: false };
  }
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('Missing Google OAuth credentials');

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await r.json();
  if (!data.access_token) {
    if (data.error === 'invalid_grant') {
      await serviceClient
        .from('calendar_tokens')
        .update({ needs_reconnect: true, sync_status: 'needs_reconnect', sync_error: 'refresh token revoked' })
        .eq('user_id', token.user_id);
      return { accessToken: '', needsReconnect: true };
    }
    throw new Error(`Token refresh failed: ${data.error || 'unknown'}`);
  }
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);
  await serviceClient
    .from('calendar_tokens')
    .update({
      access_token: data.access_token,
      expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', token.user_id);
  return { accessToken: data.access_token, needsReconnect: false };
}

async function stopExistingChannel(accessToken: string, channelId: string, resourceId: string) {
  try {
    await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: channelId, resourceId }),
    });
  } catch (e) {
    console.warn('Failed to stop existing channel (ignored):', e);
  }
}

async function startWatch(serviceClient: any, userId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

  const { data: token, error } = await serviceClient
    .from('calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !token) return { ok: false, reason: 'no_token' };

  const { accessToken, needsReconnect } = await refreshAccessTokenIfNeeded(serviceClient, token);
  if (needsReconnect) return { ok: false, reason: 'needs_reconnect' };

  // Stop any prior channel so we don't accumulate them on Google's side.
  if (token.watch_channel_id && token.watch_resource_id) {
    await stopExistingChannel(accessToken, token.watch_channel_id, token.watch_resource_id);
  }

  const channelId = crypto.randomUUID();
  const webhookUrl = `${supabaseUrl}/functions/v1/google-calendar-webhook`;

  const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events/watch', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: channelId,
      type: 'web_hook',
      address: webhookUrl,
      // Max ~7 days; let Google pick its own expiration.
    }),
  });
  const data = await r.json();
  if (!r.ok) {
    await serviceClient
      .from('calendar_tokens')
      .update({ sync_status: 'watch_error', sync_error: `${r.status}: ${JSON.stringify(data).slice(0, 300)}` })
      .eq('user_id', userId);
    return { ok: false, reason: 'google_error', status: r.status, body: data };
  }

  const expiresAt = data.expiration ? new Date(Number(data.expiration)).toISOString() : null;
  await serviceClient
    .from('calendar_tokens')
    .update({
      watch_channel_id: data.id || channelId,
      watch_resource_id: data.resourceId,
      watch_expires_at: expiresAt,
      sync_status: 'watching',
      sync_error: null,
      needs_reconnect: false,
    })
    .eq('user_id', userId);

  return { ok: true, channelId: data.id || channelId, resourceId: data.resourceId, expiresAt };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const serviceClient = createClient(supabaseUrl, serviceKey);

    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }

    let userId: string | null = body?.user_id || null;
    if (!userId) {
      const authHeader = req.headers.get('Authorization') || '';
      const anonClient = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await anonClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = user.id;
    } else {
      const authHeader = req.headers.get('Authorization') || '';
      if (!authHeader.includes(serviceKey)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const result = await startWatch(serviceClient, userId!);

    // After (re)starting the watch, kick a sync so we get a fresh syncToken right away.
    if (result.ok) {
      fetch(`${supabaseUrl}/functions/v1/google-calendar-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({ user_id: userId }),
      }).catch((e) => console.error('post-watch sync trigger failed', e));
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('google-calendar-watch error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

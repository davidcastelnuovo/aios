// Pulls incremental changes from Google Calendar (primary calendar) and applies
// them to local tasks linked via tasks.google_calendar_event_id.
//
// Invoked by:
//   - google-calendar-webhook (Google push notifications)
//   - cron-renew-calendar-watches (periodic safety net)
//   - manual call from the client (optional)
//
// Auth model:
//   - Service role can call directly with { user_id }.
//   - Authenticated users can call with no body to sync their own calendar.

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

function pad2(n: number) { return n.toString().padStart(2, '0'); }

// Convert a Google event start.dateTime (UTC ISO) to local Asia/Jerusalem date+time
function toJerusalemDateTime(iso: string): { date: string; time: string; minutes: number } {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
    minutes: d.getTime() / 60000,
  };
}

async function performSync(serviceClient: any, userId: string) {
  const { data: token, error: tokenError } = await serviceClient
    .from('calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (tokenError || !token) {
    return { ok: false, reason: 'no_token' };
  }

  const { accessToken, needsReconnect } = await refreshAccessTokenIfNeeded(serviceClient, token);
  if (needsReconnect) return { ok: false, reason: 'needs_reconnect' };

  const baseUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  // Build the incremental list URL
  const buildUrl = (syncToken: string | null, pageToken?: string) => {
    const url = new URL(baseUrl);
    url.searchParams.set('singleEvents', 'true');
    if (syncToken) {
      url.searchParams.set('syncToken', syncToken);
    } else {
      // No sync token yet: bootstrap with a reasonable window so we get a syncToken
      const past = new Date(); past.setDate(past.getDate() - 7);
      const future = new Date(); future.setDate(future.getDate() + 60);
      url.searchParams.set('timeMin', past.toISOString());
      url.searchParams.set('timeMax', future.toISOString());
    }
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    return url.toString();
  };

  let syncToken: string | null = token.next_sync_token || null;
  let pageToken: string | undefined = undefined;
  let nextSyncToken: string | null = null;
  const allEvents: any[] = [];
  let attempt = 0;

  while (true) {
    attempt++;
    if (attempt > 20) break; // safety
    const r = await fetch(buildUrl(syncToken, pageToken), {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (r.status === 410) {
      // Sync token expired -> full resync
      console.log('sync token expired, doing full resync');
      syncToken = null;
      pageToken = undefined;
      continue;
    }
    if (!r.ok) {
      const errText = await r.text();
      await serviceClient
        .from('calendar_tokens')
        .update({ sync_status: 'error', sync_error: `${r.status}: ${errText.slice(0, 300)}` })
        .eq('user_id', userId);
      return { ok: false, reason: 'google_error', status: r.status };
    }

    const data = await r.json();
    if (Array.isArray(data.items)) allEvents.push(...data.items);

    if (data.nextPageToken) {
      pageToken = data.nextPageToken;
      continue;
    }
    nextSyncToken = data.nextSyncToken || null;
    break;
  }

  // Apply changes to local tasks
  let updated = 0;
  let cleared = 0;
  for (const ev of allEvents) {
    if (!ev.id) continue;
    const { data: task } = await serviceClient
      .from('tasks')
      .select('id, title, due_date, due_time, duration_minutes')
      .eq('google_calendar_event_id', ev.id)
      .maybeSingle();
    if (!task) continue;

    if (ev.status === 'cancelled') {
      // Event was deleted in Google -> unschedule the task (don't delete).
      await serviceClient
        .from('tasks')
        .update({ due_date: null, due_time: null, google_calendar_event_id: null })
        .eq('id', task.id);
      cleared++;
      continue;
    }

    const startIso = ev.start?.dateTime;
    const endIso = ev.end?.dateTime;
    if (!startIso) continue; // skip all-day for our timed task model

    const start = toJerusalemDateTime(startIso);
    const updates: Record<string, any> = {
      due_date: start.date,
      due_time: start.time,
    };
    if (endIso) {
      const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
      const minutes = Math.max(5, Math.round(ms / 60000));
      updates.duration_minutes = minutes;
    }
    if (typeof ev.summary === 'string' && ev.summary && ev.summary !== task.title) {
      updates.title = ev.summary;
    }
    await serviceClient.from('tasks').update(updates).eq('id', task.id);
    updated++;
  }

  await serviceClient
    .from('calendar_tokens')
    .update({
      next_sync_token: nextSyncToken ?? token.next_sync_token,
      last_sync_at: new Date().toISOString(),
      sync_status: 'ok',
      sync_error: null,
      needs_reconnect: false,
    })
    .eq('user_id', userId);

  return { ok: true, updated, cleared, events: allEvents.length };
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

    // If no user_id passed, require an authenticated user (sync own calendar).
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
      // Validate that the caller is service role when passing arbitrary user_id.
      const authHeader = req.headers.get('Authorization') || '';
      if (!authHeader.includes(serviceKey)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const result = await performSync(serviceClient, userId!);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('google-calendar-sync error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

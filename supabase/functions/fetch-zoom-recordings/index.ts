import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { tenant_id, from_date, to_date } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'Missing tenant_id' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Zoom credentials
    const { data: integration } = await supabase
      .from('tenant_integrations')
      .select('settings')
      .eq('tenant_id', tenant_id)
      .eq('integration_type', 'zoom')
      .eq('is_active', true)
      .maybeSingle();

    const settings = integration?.settings as Record<string, string> | null;
    if (!settings?.account_id || !settings?.client_id || !settings?.client_secret) {
      return new Response(JSON.stringify({ error: 'Zoom credentials not configured' }), { status: 400, headers: corsHeaders });
    }

    // Get OAuth token using Server-to-Server OAuth (account_credentials)
    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${settings.client_id}:${settings.client_secret}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: settings.account_id,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('Zoom OAuth error:', errText);
      return new Response(JSON.stringify({ error: 'Failed to authenticate with Zoom' }), { status: 500, headers: corsHeaders });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Calculate date range
    const now = new Date();
    const fromDate = from_date || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = to_date || now.toISOString().split('T')[0];

    // Fetch recordings - paginate through all results
    let allMeetings: any[] = [];
    let nextPageToken = '';

    do {
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
        page_size: '300',
      });
      if (nextPageToken) params.set('next_page_token', nextPageToken);

      const recordingsResponse = await fetch(`https://api.zoom.us/v2/users/me/recordings?${params}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!recordingsResponse.ok) {
        const errText = await recordingsResponse.text();
        console.error('Zoom API error:', errText);
        return new Response(JSON.stringify({ error: 'Failed to fetch recordings from Zoom' }), { status: 500, headers: corsHeaders });
      }

      const data = await recordingsResponse.json();
      allMeetings = allMeetings.concat(data.meetings || []);
      nextPageToken = data.next_page_token || '';
    } while (nextPageToken);

    // Process and upsert recordings
    let savedCount = 0;
    for (const meeting of allMeetings) {
      const recordingFiles = meeting.recording_files || [];
      for (const file of recordingFiles) {
        const meetingId = String(meeting.id || meeting.uuid || '');
        const recordingType = file.recording_type || null;

        // Upsert by meeting_id + recording_type to avoid duplicates
        const { error } = await supabase
          .from('zoom_recordings')
          .upsert({
            tenant_id,
            meeting_id: meetingId,
            meeting_topic: meeting.topic || null,
            host_email: meeting.host_email || null,
            start_time: meeting.start_time || null,
            duration: meeting.duration || null,
            recording_url: file.play_url || file.download_url || null,
            recording_password: meeting.password || null,
            recording_type: recordingType,
            file_size: file.file_size || null,
          }, { 
            onConflict: 'tenant_id,meeting_id,recording_type',
            ignoreDuplicates: true,
          });

        if (error) {
          // If unique constraint doesn't exist, try insert and ignore duplicates
          if (error.code === '42P10' || error.message?.includes('constraint')) {
            // Try simple insert, skip on conflict
            await supabase.from('zoom_recordings').insert({
              tenant_id,
              meeting_id: meetingId,
              meeting_topic: meeting.topic || null,
              host_email: meeting.host_email || null,
              start_time: meeting.start_time || null,
              duration: meeting.duration || null,
              recording_url: file.play_url || file.download_url || null,
              recording_password: meeting.password || null,
              recording_type: recordingType,
              file_size: file.file_size || null,
            });
          } else {
            console.error('Error upserting recording:', error);
          }
        }
        savedCount++;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      meetings_found: allMeetings.length,
      recordings_processed: savedCount,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('fetch-zoom-recordings error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

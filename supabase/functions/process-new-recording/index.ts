import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
  const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { recording_id, tenant_id } = await req.json();
    if (!recording_id || !tenant_id) {
      return new Response(JSON.stringify({ error: 'Missing recording_id or tenant_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing recording ${recording_id} for tenant ${tenant_id}`);

    // 1. Fetch the recording
    const { data: recording, error: recErr } = await supabase
      .from('zoom_recordings')
      .select('*')
      .eq('id', recording_id)
      .single();

    if (recErr || !recording) {
      console.error('Recording not found:', recErr);
      return new Response(JSON.stringify({ error: 'Recording not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Find user by host_email
    let userId: string | null = null;
    let userPhone: string | null = null;

    if (recording.host_email) {
      // Look up in auth.users via profiles or direct email match
      const { data: profileMatch } = await supabase
        .from('profiles')
        .select('id, phone')
        .eq('email', recording.host_email)
        .maybeSingle();

      if (profileMatch) {
        userId = profileMatch.id;
        userPhone = profileMatch.phone;
      } else {
        // Try auth.users via admin API - list users filtered by email
        const { data: authData } = await supabase.auth.admin.listUsers();
        const matchedUser = authData?.users?.find(u => u.email === recording.host_email);
        if (matchedUser) {
          userId = matchedUser.id;
          // Get phone from profiles
          const { data: prof } = await supabase
            .from('profiles')
            .select('phone')
            .eq('id', matchedUser.id)
            .maybeSingle();
          userPhone = prof?.phone || null;
        }
      }
    }

    console.log(`User resolved: ${userId}, phone: ${userPhone}`);

    // 3. Calendar matching - find matching event by start_time
    let calendarEventName: string | null = null;

    if (userId && recording.start_time && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
      try {
        const { data: tokenData } = await supabase
          .from('calendar_tokens')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (tokenData) {
          let accessToken = tokenData.access_token;
          const expiresAt = new Date(tokenData.expires_at);

          // Refresh token if expired
          if (expiresAt <= new Date()) {
            const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                refresh_token: tokenData.refresh_token,
                grant_type: 'refresh_token',
              }),
            });
            const refreshData = await refreshResponse.json();
            if (refreshData.access_token) {
              accessToken = refreshData.access_token;
              await supabase
                .from('calendar_tokens')
                .update({
                  access_token: accessToken,
                  expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId);
            }
          }

          // Search for events around the recording start time (+-30 min)
          const startTime = new Date(recording.start_time);
          const timeMin = new Date(startTime.getTime() - 30 * 60 * 1000).toISOString();
          const timeMax = new Date(startTime.getTime() + 30 * 60 * 1000).toISOString();

          const calUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
          calUrl.searchParams.set('timeMin', timeMin);
          calUrl.searchParams.set('timeMax', timeMax);
          calUrl.searchParams.set('singleEvents', 'true');
          calUrl.searchParams.set('orderBy', 'startTime');

          const calResponse = await fetch(calUrl.toString(), {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });

          if (calResponse.ok) {
            const calData = await calResponse.json();
            const events = calData.items || [];

            // Find closest event by time overlap
            if (events.length > 0) {
              calendarEventName = events[0].summary || null;
              console.log(`Calendar match found: "${calendarEventName}"`);
            }
          } else {
            console.warn('Calendar API failed:', await calResponse.text());
          }
        }
      } catch (calErr) {
        console.warn('Calendar matching failed (continuing):', calErr);
      }
    }

    // 4. Update meeting_topic if calendar event found
    if (calendarEventName) {
      await supabase
        .from('zoom_recordings')
        .update({ meeting_topic: calendarEventName })
        .eq('id', recording_id);
      console.log(`Updated meeting_topic to: "${calendarEventName}"`);
    }

    // 5. Transcribe the recording (only audio types)
    let transcription: string | null = recording.transcription;

    if (!transcription && recording.recording_type?.toLowerCase().includes('audio')) {
      try {
        console.log('Starting transcription...');
        const transcribeResponse = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-recording`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ recording_id }),
        });

        if (transcribeResponse.ok) {
          const transcribeResult = await transcribeResponse.json();
          transcription = transcribeResult.transcription || null;
          console.log(`Transcription completed: ${transcription?.length || 0} chars`);
        } else {
          console.error('Transcription failed:', await transcribeResponse.text());
        }
      } catch (trErr) {
        console.error('Transcription error:', trErr);
      }
    }

    // 6. AI Summary via Lovable AI Gateway
    let summary: string | null = null;

    if (transcription && LOVABLE_API_KEY) {
      try {
        console.log('Generating AI summary...');
        const meetingName = calendarEventName || recording.meeting_topic || 'פגישה';

        const aiResponse = await fetch('https://ai.lovable.dev/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `אתה עוזר מקצועי שמסכם פגישות. צור סיכום קצר ומובנה בעברית.
הסיכום צריך לכלול:
1. נושא הפגישה
2. נקודות עיקריות שנדונו (3-5 נקודות)
3. החלטות שהתקבלו
4. משימות להמשך (אם יש)

השתמש באימוג'ים מתאימים. הסיכום צריך להיות תמציתי וקריא.`,
              },
              {
                role: 'user',
                content: `סכם את הפגישה הבאה:
שם הפגישה: ${meetingName}
תאריך: ${recording.start_time || 'לא ידוע'}
משך: ${recording.duration || 'לא ידוע'} דקות

תמלול:
${transcription.substring(0, 15000)}`,
              },
            ],
            max_tokens: 2000,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          summary = aiData.choices?.[0]?.message?.content || null;
          console.log(`Summary generated: ${summary?.length || 0} chars`);
        } else {
          console.error('AI summary failed:', await aiResponse.text());
        }
      } catch (aiErr) {
        console.error('AI summary error:', aiErr);
      }
    }

    // 7. Save summary to recording notes
    if (summary) {
      await supabase
        .from('zoom_recordings')
        .update({ notes: summary })
        .eq('id', recording_id);
    }

    // 8. Send summary via WhatsApp
    if (summary && userId && userPhone) {
      try {
        const meetingName = calendarEventName || recording.meeting_topic || 'פגישה';
        const whatsappMessage = `*סיכום פגישה: ${meetingName}*\n\n${summary}`;

        const sendResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-green-api-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            phoneNumber: userPhone,
            message: whatsappMessage,
            tenantId: tenant_id,
            senderUserId: userId,
          }),
        });

        if (sendResponse.ok) {
          console.log('Summary sent via WhatsApp');
        } else {
          console.warn('WhatsApp send failed:', await sendResponse.text());
        }
      } catch (waErr) {
        console.warn('WhatsApp send error:', waErr);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      calendar_match: calendarEventName,
      transcribed: !!transcription,
      summarized: !!summary,
      whatsapp_sent: !!(summary && userId && userPhone),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('process-new-recording error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

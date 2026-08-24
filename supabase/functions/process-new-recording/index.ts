import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enrichRecordingFromCalendar } from "../_shared/calendar-recording-match.ts";

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
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

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

    // 3. Deterministic Calendar match: closest Zoom event by time. The shared
    // matcher renames every recording variant and assigns a client only when its
    // name appears unambiguously in the event title.
    const calendarMatch = await enrichRecordingFromCalendar(supabase, recording, {
      preferredUserId: userId,
    });
    const calendarEventName = calendarMatch?.eventTitle || null;

    // 5. Transcribe the recording (only audio types)
    let transcription: string | null = recording.transcription;

    const recType = (recording.recording_type || '').toLowerCase();
    const isTranscribable = recType.includes('audio') || recType.includes('video') || recType === 'shared_screen_with_speaker_view' || recType === 'shared_screen_with_gallery_view' || recType === 'active_speaker';

    if (!transcription && isTranscribable) {
      try {
        console.log(`Starting transcription for type: ${recording.recording_type}...`);
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
          // transcribe-recording returns { text: ... } on success
          transcription = transcribeResult.text || transcribeResult.transcription || null;
          console.log(`Transcription completed: ${transcription?.length || 0} chars`);
        } else {
          console.error('Transcription failed:', await transcribeResponse.text());
        }
      } catch (trErr) {
        console.error('Transcription error:', trErr);
      }
    }

    // 6. AI Summary via OpenAI
    let summary: string | null = null;

    if (transcription && OPENAI_API_KEY) {
      try {
        console.log('Generating AI summary...');
        const meetingName = calendarEventName || recording.meeting_topic || 'פגישה';

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
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

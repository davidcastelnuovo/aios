import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return new Response(JSON.stringify({ error: 'No audio file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🎤 Transcribing audio file:', audioFile.name, 'size:', audioFile.size);

    // Prepare form data for OpenAI
    const openaiFormData = new FormData();
    openaiFormData.append('file', audioFile, audioFile.name || 'audio.webm');
    openaiFormData.append('model', 'whisper-1');
    openaiFormData.append('language', 'he'); // Default to Hebrew, can be auto-detected

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: openaiFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI transcription error:', response.status, errorText);
      return new Response(JSON.stringify({ error: `Transcription failed: ${errorText}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    const rawText = result.text;
    console.log('✅ Transcription complete:', rawText?.substring(0, 100));

    // Post-process with GPT to fix spelling errors
    let correctedText = rawText;
    if (rawText && rawText.length > 0) {
      try {
        console.log('🔧 Fixing spelling errors with GPT...');
        const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'אתה עוזר שמתקן שגיאות כתיב בעברית. תקבל טקסט שתומלל מהודעה קולית ותחזיר אותו מתוקן. אל תשנה את המשמעות או המבנה, רק תקן שגיאות כתיב וסימני פיסוק. החזר רק את הטקסט המתוקן, ללא הסברים.'
              },
              {
                role: 'user',
                content: rawText
              }
            ],
            temperature: 0.3,
            max_tokens: 2000,
          }),
        });

        if (gptResponse.ok) {
          const gptResult = await gptResponse.json();
          correctedText = gptResult.choices?.[0]?.message?.content || rawText;
          console.log('✅ Spelling correction complete');
        } else {
          console.error('⚠️ GPT spelling correction failed, using raw transcription');
        }
      } catch (gptError) {
        console.error('⚠️ GPT spelling correction error:', gptError);
        // Fall back to raw transcription if GPT fails
      }
    }

    return new Response(JSON.stringify({ text: correctedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in transcribe-voice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

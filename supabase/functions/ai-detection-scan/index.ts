import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface ScanRequest {
  brand_id: string;
  tenant_id: string;
  prompt_ids?: string[]; // optional - scan specific prompts only
}

interface PromptRow {
  id: string;
  prompt: string;
  category: string;
}

interface BrandRow {
  id: string;
  brand_name: string;
  keywords: string[];
  competitor_names: string[];
  tenant_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing environment variables');
    }

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { brand_id, tenant_id, prompt_ids } = await req.json() as ScanRequest;

    if (!brand_id || !tenant_id) {
      throw new Error('Missing brand_id or tenant_id');
    }

    // Get brand config
    const { data: brand, error: brandError } = await supabase
      .from('ai_detection_brands')
      .select('*')
      .eq('id', brand_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (brandError || !brand) throw new Error('Brand not found');
    const brandData = brand as BrandRow;

    // Get prompts to scan
    let promptQuery = supabase
      .from('ai_detection_prompts')
      .select('id, prompt, category')
      .eq('brand_id', brand_id)
      .eq('is_active', true);

    if (prompt_ids && prompt_ids.length > 0) {
      promptQuery = promptQuery.in('id', prompt_ids);
    }

    const { data: prompts, error: promptsError } = await promptQuery;
    if (promptsError) throw new Error('Failed to fetch prompts');
    if (!prompts || prompts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No prompts to scan', scanned: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const typedPrompts = prompts as PromptRow[];

    // Scan each prompt against each platform model
    const platforms = [
      { name: 'chatgpt', model: 'openai/gpt-4o-mini' },
      { name: 'gemini', model: 'google/gemini-3-flash-preview' },
      { name: 'perplexity', model: 'google/gemini-2.5-flash' }, // Using Gemini as proxy for Perplexity
    ];

    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const results: any[] = [];
    const competitorResults: any[] = [];

    for (const prompt of typedPrompts) {
      for (const platform of platforms) {
        try {
          // Send prompt to AI
          const aiResponse = await fetch(AI_GATEWAY_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: platform.model,
              messages: [
                {
                  role: 'system',
                  content: 'You are a helpful assistant. Answer the user question naturally. If you recommend products or services, list them by name. Be specific with brand names.'
                },
                { role: 'user', content: prompt.prompt }
              ],
            }),
          });

          if (!aiResponse.ok) {
            if (aiResponse.status === 429) {
              console.log(`Rate limited on ${platform.name}, skipping`);
              continue;
            }
            console.error(`AI error for ${platform.name}: ${aiResponse.status}`);
            continue;
          }

          const aiData = await aiResponse.json();
          const responseText = aiData.choices?.[0]?.message?.content || '';

          // Check if brand is mentioned
          const brandMentioned = checkBrandMention(responseText, brandData.brand_name, brandData.keywords);

          // Analyze sentiment if mentioned
          let sentiment: string | null = null;
          let position: number | null = null;
          let snippet: string | null = null;

          if (brandMentioned) {
            const analysis = await analyzeMention(
              LOVABLE_API_KEY, responseText, brandData.brand_name, brandData.keywords
            );
            sentiment = analysis.sentiment;
            position = analysis.position;
            snippet = analysis.snippet;
          }

          // Extract citations (URLs)
          const citations = extractUrls(responseText);

          results.push({
            tenant_id,
            brand_id,
            prompt_id: prompt.id,
            platform: platform.name,
            is_mentioned: brandMentioned,
            position,
            sentiment,
            response_snippet: snippet || (brandMentioned ? responseText.substring(0, 500) : null),
            citations,
            scan_id: scanId,
            scanned_at: new Date().toISOString(),
          });

          // Check competitors
          for (const competitor of brandData.competitor_names) {
            const compMentioned = checkBrandMention(responseText, competitor, [competitor]);
            competitorResults.push({
              tenant_id,
              brand_id,
              competitor_name: competitor,
              prompt_id: prompt.id,
              platform: platform.name,
              is_mentioned: compMentioned,
              position: compMentioned ? findPosition(responseText, competitor) : null,
              scan_id: scanId,
              scanned_at: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.error(`Error scanning ${platform.name} for prompt ${prompt.id}:`, err);
        }
      }
    }

    // Save results to database
    if (results.length > 0) {
      const { error: insertError } = await supabase
        .from('ai_detection_results')
        .insert(results);
      if (insertError) console.error('Error saving results:', insertError);
    }

    if (competitorResults.length > 0) {
      const { error: insertError } = await supabase
        .from('ai_detection_competitor_results')
        .insert(competitorResults);
      if (insertError) console.error('Error saving competitor results:', insertError);
    }

    // Calculate and save weekly score
    const totalScans = results.length;
    const mentionedScans = results.filter(r => r.is_mentioned).length;
    const score = totalScans > 0 ? Math.round((mentionedScans / totalScans) * 100) : 0;

    const chatgptResults = results.filter(r => r.platform === 'chatgpt');
    const geminiResults = results.filter(r => r.platform === 'gemini');
    const perplexityResults = results.filter(r => r.platform === 'perplexity');

    const calcScore = (arr: any[]) => arr.length > 0
      ? Math.round((arr.filter(r => r.is_mentioned).length / arr.length) * 100)
      : 0;

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Upsert weekly score
    const { error: scoreError } = await supabase
      .from('ai_detection_scores')
      .upsert({
        tenant_id,
        brand_id,
        score,
        chatgpt_score: calcScore(chatgptResults),
        gemini_score: calcScore(geminiResults),
        perplexity_score: calcScore(perplexityResults),
        total_prompts: typedPrompts.length,
        mentioned_prompts: new Set(results.filter(r => r.is_mentioned).map(r => r.prompt_id)).size,
        week_start: weekStartStr,
      }, { onConflict: 'brand_id,week_start', ignoreDuplicates: false });

    if (scoreError) console.error('Error saving score:', scoreError);

    return new Response(
      JSON.stringify({
        success: true,
        scanned: results.length,
        mentioned: mentionedScans,
        score,
        platforms: {
          chatgpt: calcScore(chatgptResults),
          gemini: calcScore(geminiResults),
          perplexity: calcScore(perplexityResults),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function checkBrandMention(text: string, brandName: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  if (lowerText.includes(brandName.toLowerCase())) return true;
  return keywords.some(kw => lowerText.includes(kw.toLowerCase()));
}

function findPosition(text: string, name: string): number | null {
  const lines = text.split('\n');
  let listIndex = 0;
  for (const line of lines) {
    if (/^\d+[\.\)]/.test(line.trim()) || /^[-•*]/.test(line.trim())) {
      listIndex++;
      if (line.toLowerCase().includes(name.toLowerCase())) {
        return listIndex;
      }
    }
  }
  return null;
}

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s\)]+/g;
  const matches = text.match(urlRegex);
  return matches ? [...new Set(matches)] : [];
}

async function analyzeMention(
  apiKey: string, responseText: string, brandName: string, keywords: string[]
): Promise<{ sentiment: string; position: number | null; snippet: string }> {
  try {
    const analysisResponse = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `Analyze how the brand "${brandName}" (keywords: ${keywords.join(', ')}) is mentioned in the following AI response. Return JSON only: {"sentiment": "positive"|"neutral"|"negative", "position": <number or null - position in list if applicable>, "snippet": "<relevant 1-2 sentence excerpt>"}`
          },
          { role: 'user', content: responseText }
        ],
      }),
    });

    if (!analysisResponse.ok) {
      return { sentiment: 'neutral', position: null, snippet: responseText.substring(0, 200) };
    }

    const data = await analysisResponse.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        sentiment: parsed.sentiment || 'neutral',
        position: parsed.position || null,
        snippet: parsed.snippet || responseText.substring(0, 200),
      };
    }
  } catch (e) {
    console.error('Analysis error:', e);
  }

  return { sentiment: 'neutral', position: null, snippet: responseText.substring(0, 200) };
}

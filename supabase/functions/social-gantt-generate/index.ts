import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { chatCompletion } from '../_shared/ai-gateway.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) throw new Error('Unauthorized')

    const body = await req.json()
    const { action, post_id, tenant_id, prompt, style, additional_notes, tone, target_audience, call_to_action, date } = body

    if (!Deno.env.get('ANTHROPIC_API_KEY')) {
      throw new Error('ANTHROPIC_API_KEY not configured')
    }

    let result: any

    if (action === 'generate_copy') {
      result = await generateCopy({ prompt, tone, target_audience, call_to_action, post_id, tenant_id }, supabase)
    } else if (action === 'generate_creative_prompt') {
      result = await generateCreativePrompt({ prompt, style, additional_notes, post_id, tenant_id }, supabase)
    } else if (action === 'generate_day_ideas') {
      result = await generateDayIdeas({ date, tenant_id }, supabase)
    } else {
      throw new Error(`Unknown action: ${action}`)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ─── generate_day_ideas ────────────────────────────────────────────────────
async function generateDayIdeas(params: { date: string; tenant_id: string }, _supabase: any) {
  const { date } = params

  // Parse the date to understand context (day of week, month, upcoming events)
  const d = new Date(date)
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
  const dayOfWeek = dayNames[d.getDay()]
  const monthName = monthNames[d.getMonth()]
  const dayNum = d.getDate()
  const year = d.getFullYear()

  const systemPrompt = `אתה מנהל תוכן סושיאל מדיה מנוסה בישראל.
תפקידך להציע רעיונות לפוסטים לפי תאריך ספציפי, תוך התחשבות ב:
- אקטואליה ישראלית ועולמית (חגים, אירועים, מגמות)
- ימים מיוחדים בלוח השנה הישראלי והבינלאומי
- טרנדים עונתיים ותרבותיים
- ימי המודעות הבינלאומיים
- אירועי ספורט, תרבות, כלכלה

כל רעיון צריך להיות ספציפי, אקטואלי ורלוונטי לתאריך.
כתוב בעברית.`

  const userPrompt = `תאריך: יום ${dayOfWeek}, ${dayNum} ב${monthName} ${year}

צור 4 רעיונות לפוסטים סושיאל שמתאימים לתאריך הזה.
חשוב על: מה קורה בישראל ובעולם בתקופה הזו? אילו חגים/אירועים/ימי מודעות קרובים?
מה הטרנדים הרלוונטיים לחודש הזה?

החזר JSON בפורמט הבא (בלי markdown, רק JSON טהור):
{
  "ideas": [
    {
      "topic": "נושא קצר ומדויק",
      "rationale": "למה הרעיון הזה רלוונטי לתאריך הזה (1-2 משפטים)",
      "platform": "instagram",
      "hook": "פתיח קצר לפוסט (משפט אחד מושך)"
    }
  ]
}`

  const data = await chatCompletion({
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const content = data.choices?.[0]?.message?.content || ''

  let parsed
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { ideas: [] }
  } catch {
    parsed = { ideas: [] }
  }

  return { ideas: parsed.ideas || [] }
}

// ─── generate_copy ─────────────────────────────────────────────────────────
async function generateCopy(params: {
  prompt: string
  tone: string
  target_audience: string
  call_to_action: string
  post_id: string
  tenant_id: string
}, supabase: any) {
  const { prompt, tone, target_audience, call_to_action, post_id, tenant_id } = params

  const { data: post } = await supabase
    .from('social_gantt_posts')
    .select('*')
    .eq('id', post_id)
    .single()

  const toneMap: Record<string, string> = {
    professional: 'מקצועי ורשמי',
    casual: 'קז׳ואל וקליל',
    bold: 'נועז ובולט',
    emotional: 'רגשי ומרגש',
    humorous: 'הומוריסטי ומצחיק',
  }

  const systemPrompt = `אתה קופירייטר מקצועי לסושיאל מדיה. אתה כותב בעברית מצוינת.
אתה מייצר קופי קצר, קליט ואפקטיבי לפלטפורמות סושיאל.

כללים:
- כתוב בעברית תקנית ושוטפת
- התאם את הטון לפלטפורמה ולקהל היעד
- השתמש באימוג׳ים בצורה מושכלת
- הוסף האשטגים רלוונטיים בסוף
- כל אפשרות צריכה להיות שונה בגישה ובמסר`

  const userPrompt = `צור 3 אפשרויות קופי לפוסט בנושא "${post?.topic || prompt}".

פלטפורמה: ${post?.platform || 'instagram'}
טון: ${toneMap[tone] || tone}
${target_audience ? `קהל יעד: ${target_audience}` : ''}
${call_to_action ? `קריאה לפעולה: ${call_to_action}` : ''}
${prompt ? `הנחיות נוספות: ${prompt}` : ''}

החזר את התוצאה כ-JSON בפורמט הבא (בלי markdown, רק JSON טהור):
{
  "options": [
    { "text": "הקופי כאן", "tone_label": "תיאור הטון" },
    { "text": "הקופי כאן", "tone_label": "תיאור הטון" },
    { "text": "הקופי כאן", "tone_label": "תיאור הטון" }
  ]
}`

  const data = await chatCompletion({
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const content = data.choices?.[0]?.message?.content || ''

  let parsed
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { options: [] }
  } catch {
    parsed = {
      options: [
        { text: content, tone_label: toneMap[tone] || tone },
      ],
    }
  }

  return { options: parsed.options || [] }
}

// ─── generate_creative_prompt ──────────────────────────────────────────────
async function generateCreativePrompt(params: {
  prompt: string
  style: string
  additional_notes: string
  post_id: string
  tenant_id: string
}, supabase: any) {
  const { prompt, style, additional_notes, post_id } = params

  const { data: post } = await supabase
    .from('social_gantt_posts')
    .select('*')
    .eq('id', post_id)
    .single()

  const styleMap: Record<string, string> = {
    modern: 'מודרני ונקי עם קווים חדים וצבעים עזים',
    minimal: 'מינימליסטי עם הרבה רווח לבן ואלמנטים מעטים',
    bold: 'בולט ודרמטי עם צבעים חזקים וטיפוגרפיה גדולה',
    elegant: 'אלגנטי ומעודן עם גוונים רכים',
    playful: 'שובב וצבעוני עם אלמנטים כיפיים',
    corporate: 'עסקי ומקצועי עם מראה רציני',
  }

  const systemPrompt = `אתה מנהל אמנותי (Art Director) מקצועי.
תפקידך ליצור 3 בריפים מפורטים לעיצוב קריאייטיב לפוסט סושיאל.

כל בריף צריך לכלול:
- תיאור ויזואלי מפורט
- סכימת צבעים מוצעת (hex)
- הנחיות טיפוגרפיה
- מבנה הקומפוזיציה
- טקסט שיופיע על הקריאייטיב (אם רלוונטי)

כתוב בעברית.`

  const userPrompt = `צור 3 בריפים שונים לקריאייטיב בנושא "${post?.topic || prompt}".

פלטפורמה: ${post?.platform || 'instagram'}
סגנון: ${styleMap[style] || style}
${additional_notes ? `הערות: ${additional_notes}` : ''}
${prompt ? `תיאור: ${prompt}` : ''}

החזר JSON בפורמט (בלי markdown, רק JSON טהור):
{
  "options": [
    {
      "brief": "תיאור הבריף",
      "colors": ["#hex1", "#hex2", "#hex3"],
      "headline_text": "הטקסט הראשי על הקריאייטיב",
      "style_label": "שם הסגנון"
    }
  ]
}`

  const data = await chatCompletion({
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const content = data.choices?.[0]?.message?.content || ''

  let parsed
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { options: [] }
  } catch {
    parsed = {
      options: [{ brief: content, colors: ['#6366f1', '#ec4899', '#f59e0b'], headline_text: post?.topic || '', style_label: style }],
    }
  }

  return { options: parsed.options || [] }
}

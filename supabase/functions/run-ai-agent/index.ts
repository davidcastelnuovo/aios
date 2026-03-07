import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Map engine names to Lovable AI model identifiers
function resolveModel(engine: string): string {
  const map: Record<string, string> = {
    'gemini-2.5-flash': 'google/gemini-2.5-flash',
    'gemini-2.5-pro': 'google/gemini-2.5-pro',
    'gemini-3-flash': 'google/gemini-3-flash-preview',
    'gemini-3-pro': 'google/gemini-3-pro-preview',
    'gpt-5': 'openai/gpt-5',
    'gpt-5-mini': 'openai/gpt-5-mini',
    'gpt-5-nano': 'openai/gpt-5-nano',
  }
  return map[engine] || 'google/gemini-3-flash-preview'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { agent_id, command_text, automation_id, user_name, lead_data } = await req.json()

    if (!agent_id || !command_text) {
      throw new Error('Missing agent_id or command_text')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    const supabase = createClient(supabaseUrl, supabaseKey)

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured')
    }

    // 1. Fetch agent configuration
    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agent_id)
      .single()

    if (agentError || !agent) {
      throw new Error(`Agent not found: ${agent_id}`)
    }

    console.log(`🤖 Running agent: ${agent.name} (engine: ${agent.engine})`)

    // 2. Build system prompt from agent configuration
    const systemParts: string[] = []
    systemParts.push(`אתה ${agent.name}.`)
    if (agent.personality) systemParts.push(`האופי שלך: ${agent.personality}.`)
    if (agent.soul) systemParts.push(`הנשמה שלך: ${agent.soul}.`)
    if (agent.talent) systemParts.push(`הטלנט שלך: ${agent.talent}.`)
    systemParts.push('ענה בעברית. היה תמציתי ומועיל.')

    // Auto-inject lead context if available
    if (lead_data) {
      const leadParts: string[] = []
      if (lead_data.contact_name) leadParts.push(`שם: ${lead_data.contact_name}`)
      if (lead_data.company_name) leadParts.push(`חברה: ${lead_data.company_name}`)
      if (lead_data.phone) leadParts.push(`טלפון: ${lead_data.phone}`)
      if (lead_data.email) leadParts.push(`אימייל: ${lead_data.email}`)
      if (lead_data.source) leadParts.push(`מקור: ${lead_data.source}`)
      if (lead_data.status) leadParts.push(`סטטוס: ${lead_data.status}`)
      if (lead_data.pipeline_stage) leadParts.push(`שלב: ${lead_data.pipeline_stage}`)
      if (lead_data.agency_name) leadParts.push(`סוכנות: ${lead_data.agency_name}`)
      if (lead_data.notes) leadParts.push(`הערות: ${lead_data.notes}`)
      if (lead_data.lead_id) leadParts.push(`מזהה ליד: ${lead_data.lead_id}`)

      if (leadParts.length > 0) {
        systemParts.push(`\n\nהנה פרטי הליד/איש הקשר שעבורו אתה מבצע את המשימה:\n${leadParts.join('\n')}`)
        systemParts.push('\nהשתמש בפרטים אלו כדי לבצע את המשימה. אין צורך לבקש פרטים נוספים.')
      }
    }

    const systemPrompt = systemParts.join(' ')
    const model = resolveModel(agent.engine)

    console.log(`📝 System prompt: ${systemPrompt.substring(0, 100)}...`)
    console.log(`🔧 Model: ${model}`)

    // 3. Call AI Gateway
    const startTime = Date.now()
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: command_text },
        ],
      }),
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      console.error('AI Gateway error:', aiResponse.status, errorText)
      
      if (aiResponse.status === 429) {
        throw new Error('מגבלת קצב בקשות. נסה שוב בעוד רגע.')
      }
      if (aiResponse.status === 402) {
        throw new Error('נדרש תשלום. יש להוסיף קרדיטים.')
      }
      throw new Error(`AI Gateway error: ${aiResponse.status}`)
    }

    const aiData = await aiResponse.json()
    const agentOutput = aiData.choices?.[0]?.message?.content || 'אין תשובה מהסוכן'
    const executionTime = Date.now() - startTime

    console.log(`✅ Agent response (${executionTime}ms): ${agentOutput.substring(0, 200)}...`)

    // 4. Save to automation_logs if automation_id provided
    if (automation_id) {
      await supabase.from('automation_logs').insert({
        automation_id,
        success: true,
        payload: { command_text, user_name, agent_id, agent_name: agent.name },
        response: { agent_output: agentOutput, model, execution_time_ms: executionTime },
        execution_time_ms: executionTime,
      })
    }

    // 5. Return response
    return new Response(
      JSON.stringify({
        success: true,
        output: agentOutput,
        agent_name: agent.name,
        model,
        execution_time_ms: executionTime,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('run-ai-agent error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

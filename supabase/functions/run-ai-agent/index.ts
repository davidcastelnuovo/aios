import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'

function resolveModel(engine: string): string {
  const map: Record<string, string> = {
    'gemini-2.5-flash': 'google/gemini-2.5-flash',
    'gemini-2.5-pro': 'google/gemini-2.5-pro',
    'gemini-3-flash': 'google/gemini-3-flash-preview',
    'gemini-3-pro': 'google/gemini-3-pro-preview',
    'gpt-5': 'openai/gpt-5',
    'gpt-5-mini': 'openai/gpt-5-mini',
    'claude-sonnet': 'anthropic/claude-sonnet-4-6',
  }
  return map[engine] || 'google/gemini-3-flash-preview'
}

// ===========================
// ALL AVAILABLE TOOLS
// ===========================
const ALL_TOOLS = [
  // LEADS
  { name: 'create_lead', description: 'יצירת ליד חדש', parameters: { type: 'object', properties: { company_name: { type: 'string' }, contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, source: { type: 'string' }, notes: { type: 'string' } }, required: ['contact_name'] } },
  { name: 'list_leads', description: 'רשימת לידים', parameters: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'integer' } } } },
  { name: 'update_lead_status', description: 'עדכון סטטוס ליד', parameters: { type: 'object', properties: { lead_id: { type: 'string' }, status: { type: 'string' } }, required: ['lead_id', 'status'] } },
  { name: 'add_lead_update', description: 'הוספת עדכון לליד', parameters: { type: 'object', properties: { lead_id: { type: 'string' }, content: { type: 'string' } }, required: ['lead_id', 'content'] } },
  // TASKS
  { name: 'create_task', description: 'יצירת משימה חדשה', parameters: { type: 'object', properties: { title: { type: 'string' }, client_id: { type: 'string' }, priority: { type: 'integer' }, due_date: { type: 'string' }, due_time: { type: 'string' }, notes: { type: 'string' } }, required: ['title'] } },
  { name: 'list_tasks', description: 'רשימת משימות', parameters: { type: 'object', properties: { status: { type: 'string' }, client_id: { type: 'string' }, limit: { type: 'integer' } } } },
  { name: 'update_task_status', description: 'עדכון סטטוס משימה', parameters: { type: 'object', properties: { task_id: { type: 'string' }, status: { type: 'string', enum: ['open', 'in_progress', 'completed', 'cancelled'] } }, required: ['task_id', 'status'] } },
  // CLIENTS
  { name: 'list_clients', description: 'רשימת לקוחות', parameters: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'integer' } } } },
  { name: 'get_client_info', description: 'מידע על לקוח', parameters: { type: 'object', properties: { client_id: { type: 'string' } }, required: ['client_id'] } },
  { name: 'add_client_update', description: 'הוספת עדכון ללקוח', parameters: { type: 'object', properties: { client_id: { type: 'string' }, content: { type: 'string' } }, required: ['client_id', 'content'] } },
  // MESSAGES
  { name: 'send_message', description: 'שליחת הודעת WhatsApp ללקוח או ליד', parameters: { type: 'object', properties: { contact_type: { type: 'string', enum: ['lead', 'client'] }, contact_id: { type: 'string' }, message_text: { type: 'string' } }, required: ['contact_type', 'contact_id', 'message_text'] } },
  // SEARCH
  { name: 'search_entities', description: 'חיפוש סוכנויות, לקוחות, קמפיינרים או לידים לפי שם', parameters: { type: 'object', properties: { entity_type: { type: 'string', enum: ['agency', 'client', 'campaigner', 'lead'] }, search_term: { type: 'string' } }, required: ['entity_type', 'search_term'] } },
]

// ===========================
// TOOL EXECUTOR
// ===========================
async function executeTool(name: string, args: Record<string, any>, supabase: any, tenantId: string, userId: string): Promise<any> {
  switch (name) {
    case 'create_lead': {
      const { data: agency } = await supabase.from('agencies').select('id').eq('tenant_id', tenantId).limit(1).single()
      const { data, error } = await supabase.from('leads').insert({
        ...args, status: 'new', agency_id: agency?.id, tenant_id: tenantId,
        company_name: args.company_name || args.contact_name,
      }).select('id, company_name, contact_name, status').single()
      if (error) throw error
      return { lead_id: data.id, company_name: data.company_name, status: data.status }
    }
    case 'list_leads': {
      let query = supabase.from('leads').select('id, company_name, contact_name, phone, status, source, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(args.limit || 20)
      if (args.status) query = query.eq('status', args.status)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, leads: data }
    }
    case 'update_lead_status': {
      const { data, error } = await supabase.from('leads').update({ status: args.status }).eq('id', args.lead_id).eq('tenant_id', tenantId).select('id, company_name, status').single()
      if (error) throw error
      return data
    }
    case 'add_lead_update': {
      const { data, error } = await supabase.from('lead_updates').insert({ lead_id: args.lead_id, user_id: userId, tenant_id: tenantId, content: args.content }).select('id').single()
      if (error) throw error
      return { update_id: data.id }
    }
    case 'create_task': {
      const { data: profile } = await supabase.from('profiles').select('campaigner_id').eq('id', userId).single()
      const { data: campAgency } = await supabase.from('campaigner_agencies').select('agency_id').eq('campaigner_id', profile?.campaigner_id).limit(1).single()
      const { data, error } = await supabase.from('tasks').insert({
        title: args.title, agency_id: campAgency?.agency_id, campaigner_id: profile?.campaigner_id,
        tenant_id: tenantId, priority: args.priority || 5, status: 'open', task_type: 'other',
        client_id: args.client_id, due_date: args.due_date, due_time: args.due_time, notes: args.notes,
      }).select('id, title, status').single()
      if (error) throw error
      return { task_id: data.id, title: data.title, status: data.status }
    }
    case 'list_tasks': {
      let query = supabase.from('tasks').select('id, title, status, priority, due_date, clients(name)').eq('tenant_id', tenantId).order('priority', { ascending: false }).limit(args.limit || 20)
      if (args.status) query = query.eq('status', args.status)
      if (args.client_id) query = query.eq('client_id', args.client_id)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, tasks: data.map((t: any) => ({ ...t, client_name: t.clients?.name })) }
    }
    case 'update_task_status': {
      const { data, error } = await supabase.from('tasks').update({ status: args.status }).eq('id', args.task_id).eq('tenant_id', tenantId).select('id, title, status').single()
      if (error) throw error
      return data
    }
    case 'list_clients': {
      let query = supabase.from('clients').select('id, name, contact_name, phone, status').eq('tenant_id', tenantId).order('name').limit(args.limit || 20)
      if (args.status) query = query.eq('status', args.status)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, clients: data }
    }
    case 'get_client_info': {
      const { data, error } = await supabase.from('clients').select('*, agencies(name)').eq('id', args.client_id).eq('tenant_id', tenantId).single()
      if (error) throw error
      return data
    }
    case 'add_client_update': {
      const { data, error } = await supabase.from('client_updates').insert({ client_id: args.client_id, user_id: userId, tenant_id: tenantId, content: args.content }).select('id').single()
      if (error) throw error
      return { update_id: data.id }
    }
    case 'send_message': {
      let phone: string | null = null
      let contactName: string | null = null
      if (args.contact_type === 'lead') {
        const { data } = await supabase.from('leads').select('phone, company_name, contact_name').eq('id', args.contact_id).single()
        phone = data?.phone; contactName = data?.contact_name || data?.company_name
      } else {
        const { data } = await supabase.from('clients').select('phone, name, contact_name').eq('id', args.contact_id).single()
        phone = data?.phone; contactName = data?.contact_name || data?.name
      }
      if (!phone) return { success: false, error: 'לא נמצא מספר טלפון' }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-green-api-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ phone, message: args.message_text, tenantId, [`${args.contact_type}_id`]: args.contact_id }),
      })
      if (!res.ok) throw new Error(await res.text())
      return { sent_to: contactName, phone }
    }
    case 'search_entities': {
      const tableMap: Record<string, string> = { agency: 'agencies', client: 'clients', campaigner: 'campaigners', lead: 'leads' }
      const nameMap: Record<string, string> = { agency: 'name', client: 'name', campaigner: 'full_name', lead: 'company_name' }
      const table = tableMap[args.entity_type]
      const nameField = nameMap[args.entity_type]
      const { data, error } = await supabase.from(table).select('id, ' + nameField).eq('tenant_id', tenantId).ilike(nameField, `%${args.search_term}%`).limit(10)
      if (error) throw error
      return { count: data.length, results: data }
    }
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

// ===========================
// MAIN HANDLER
// ===========================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { agent_id, command_text, temperature, automation_id, user_name, lead_data, tenant_id, user_id } = await req.json()

    if (!agent_id || !command_text) throw new Error('Missing agent_id or command_text')
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Fetch agent
    const { data: agent, error: agentError } = await supabase.from('ai_agents').select('*').eq('id', agent_id).single()
    if (agentError || !agent) throw new Error(`Agent not found: ${agent_id}`)

    console.log(`🤖 Agent: ${agent.name} | tools: ${(agent.allowed_tools || []).join(', ') || 'all'}`)

    // 2. Resolve tenant
    let resolvedTenantId = tenant_id || agent.tenant_id
    let resolvedUserId = user_id || 'system'

    // 3. Build system prompt
    let systemPrompt = agent.system_prompt || ''
    if (!systemPrompt) {
      const parts = [`אתה ${agent.name}.`]
      if (agent.personality) parts.push(`אופי: ${agent.personality}.`)
      if (agent.soul) parts.push(`נשמה: ${agent.soul}.`)
      if (agent.talent) parts.push(`טלנט: ${agent.talent}.`)
      parts.push('ענה בעברית. היה תמציתי ומקצועי.')
      systemPrompt = parts.join(' ')
    }

    // Inject lead context
    if (lead_data) {
      const leadParts = Object.entries(lead_data)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
      if (leadParts.length) systemPrompt += `\n\nפרטי ליד:\n${leadParts.join('\n')}`
    }

    // 4. Filter tools
    const allowedTools = (agent.allowed_tools || []) as string[]
    const filteredTools = allowedTools.length > 0
      ? ALL_TOOLS.filter(t => allowedTools.includes(t.name))
      : ALL_TOOLS

    const toolsForAPI = filteredTools.map(t => ({ type: 'function', function: t }))

    // 5. Run agent with tool loop
    const model = resolveModel(agent.engine || 'gemini-3-flash')
    const maxRounds = agent.max_tool_rounds || 3
    const safeTemp = typeof temperature === 'number' ? Math.min(2, Math.max(0, temperature)) : undefined

    let messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: command_text },
    ]

    let finalOutput = ''
    const toolLog: any[] = []
    const startTime = Date.now()

    for (let round = 0; round < maxRounds; round++) {
      const payload: any = { model, messages }
      if (safeTemp !== undefined) payload.temperature = safeTemp
      if (toolsForAPI.length > 0) payload.tools = toolsForAPI

      const res = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.text()
        if (res.status === 429) throw new Error('מגבלת קצב. נסה שוב.')
        throw new Error(`AI error: ${res.status} ${err}`)
      }

      const data = await res.json()
      const choice = data.choices?.[0]
      const msg = choice?.message

      if (!msg) break

      messages.push(msg)

      // No tool calls → done
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        finalOutput = msg.content || ''
        break
      }

      // Execute tool calls
      const toolResults: any[] = []
      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name
        let toolArgs: Record<string, any> = {}
        try { toolArgs = JSON.parse(tc.function.arguments || '{}') } catch { /* ignore */ }

        console.log(`🔧 Tool: ${toolName}`, toolArgs)

        let result: any
        try {
          result = await executeTool(toolName, toolArgs, supabase, resolvedTenantId, resolvedUserId)
        } catch (e: any) {
          result = { error: e.message }
        }

        toolLog.push({ tool: toolName, args: toolArgs, result })
        toolResults.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
      }

      messages.push(...toolResults)
    }

    const executionTime = Date.now() - startTime
    console.log(`✅ Done in ${executionTime}ms | tools used: ${toolLog.length}`)

    // 6. Log to automation_logs
    if (automation_id) {
      await supabase.from('automation_logs').insert({
        automation_id,
        success: true,
        payload: { command_text, user_name, agent_id, agent_name: agent.name },
        response: { agent_output: finalOutput, model, execution_time_ms: executionTime, tools_used: toolLog.map(t => t.tool) },
        execution_time_ms: executionTime,
      })
    }

    return new Response(JSON.stringify({
      success: true,
      output: finalOutput,
      agent_name: agent.name,
      model,
      execution_time_ms: executionTime,
      tools_used: toolLog.map(t => t.tool),
      tool_log: toolLog,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('run-ai-agent error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
    })
  }
})

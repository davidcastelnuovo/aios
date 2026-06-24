import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Custom field name for phone number in ManyChat (must be created manually in ManyChat)
const PHONE_CUSTOM_FIELD_NAME = 'phone_number';

// ManyChat sometimes returns a single object and sometimes an array.
// Prefer subscribers with whatsapp_phone (not deleted).
// NOTE: Some parts of this file define a more advanced extractSubscriberId inside a function scope;
// this global helper is used by other functions in this file.
function extractSubscriberId(result: any): string | null {
  if (!result || result.status !== 'success' || !result.data) return null;
  const subscribers = Array.isArray(result.data) ? result.data : [result.data];

  const withWA = subscribers.find((s: any) => s?.status !== 'deleted' && s?.whatsapp_phone && s?.id);
  if (withWA?.id) return String(withWA.id);

  const active = subscribers.find((s: any) => s?.status !== 'deleted' && s?.id);
  if (active?.id) return String(active.id);

  const anyWithId = subscribers.find((s: any) => s?.id);
  if (anyWithId?.id) return String(anyWithId.id);

  return null;
}

// Get Custom Field ID from ManyChat API (with caching)
async function getPhoneNumberFieldIdMC(apiKey: string, supabase: any, tenantId: string): Promise<number | null> {
  // First, try to get cached field_id from tenant_integrations.settings
  const { data: integration } = await supabase
    .from('tenant_integrations')
    .select('settings')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'manychat')
    .single();

  const settings = integration?.settings || {};
  if (settings.phone_number_field_id) {
    return settings.phone_number_field_id;
  }

  // If not cached, fetch from ManyChat API
  try {
    const res = await fetch('https://api.manychat.com/fb/page/getCustomFields', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();

      if (data?.status === 'success' && Array.isArray(data?.data)) {
        const phoneField = data.data.find((field: any) => 
          field.name === PHONE_CUSTOM_FIELD_NAME || 
          field.name?.toLowerCase() === 'phone_number'
        );

        if (phoneField?.id) {
          const fieldId = parseInt(phoneField.id, 10);

          // Cache the field_id in tenant_integrations.settings
          await supabase
            .from('tenant_integrations')
            .update({ settings: { ...settings, phone_number_field_id: fieldId } })
            .eq('tenant_id', tenantId)
            .eq('integration_type', 'manychat');

          return fieldId;
        } else {
        }
      }
    }
  } catch (e) {
    console.error('Error fetching custom fields:', e);
  }

  return null;
}

// Find subscriber by Custom Field using field_id (NOT field_name!)
async function findSubscriberByCustomFieldMC(apiKey: string, fieldId: number, phoneCandidates: string[]): Promise<string | null> {
  for (const candidate of phoneCandidates) {
    try {
      // IMPORTANT: Use field_id (numeric) not field_name
      const url = `https://api.manychat.com/fb/subscriber/findByCustomField?field_id=${fieldId}&field_value=${encodeURIComponent(candidate)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.status === 'success' && data?.data) {
          // Handle both array and object responses from ManyChat API
          const subscribers = Array.isArray(data.data) ? data.data : [data.data];

          // Prefer ACTIVE subscriber with whatsapp_phone (not deleted)
          const activeWithWA = subscribers.find((s: any) => s?.status !== 'deleted' && s?.whatsapp_phone && s?.id);
          if (activeWithWA?.id) {
            return String(activeWithWA.id);
          }

          // Second priority: ACTIVE subscriber (no WA phone but not deleted)
          const activeSubscriber = subscribers.find((s: any) => s?.status !== 'deleted' && s?.id);
          if (activeSubscriber?.id) {
            return String(activeSubscriber.id);
          }

          // IMPORTANT: If ONLY deleted subscribers exist, return NULL so we can try to create a new one
          // or search via other methods. Using a deleted subscriber will fail silently.
          const deletedSubscriber = subscribers.find((s: any) => s?.id);
          if (deletedSubscriber?.id) {
            // Return null to trigger fallback logic
            return null;
          }
        }
      }
      
      // If rate limited, wait
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {
    }
  }
  return null;
}

// Set phone_number custom field for a subscriber
async function setPhoneCustomFieldMC(apiKey: string, subscriberId: string, phoneValue: string): Promise<boolean> {
  try {
    const url = 'https://api.manychat.com/fb/subscriber/setCustomFieldByName';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: subscriberId,
        field_name: PHONE_CUSTOM_FIELD_NAME,
        field_value: phoneValue,
      }),
    });

    const data = await res.json();
    return data?.status === 'success';
  } catch (e) {
    return false;
  }
}

interface AutomationPayload {
  trigger_type?: string
  data?: any
  tenant_id?: string
  // Support direct automation execution by ID
  automationId?: string
  payload?: any
  // Source separation: 'crm' = only CRM automations, 'flow' = only the specific flow
  source?: 'crm' | 'flow'
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const requestBody = await req.json()

    // Backward-compat alias: old name → new name
    if (requestBody.trigger_type === 'ad_account_billing_issue') {
      requestBody.trigger_type = 'ad_account_blocked'
    }


    // ===== AUTOMATION SAFETY GUARDS =====
    const MAX_EXECUTION_DEPTH = 10
    const MAX_ACTIONS_PER_RUN = 50
    const MAX_RUNTIME_SECONDS = 60
    const executionStartTime = Date.now()

    // Extract execution context for loop detection
    const executionId = requestBody._execution_id || crypto.randomUUID()
    const executionDepth = requestBody._execution_depth || 0
    const executionChain: string[] = requestBody._execution_chain || []

    // Guard: max depth
    if (executionDepth >= MAX_EXECUTION_DEPTH) {
      console.error(`🛑 SAFETY: Max execution depth (${MAX_EXECUTION_DEPTH}) reached. Aborting to prevent infinite recursion.`)
      return new Response(
        JSON.stringify({ error: 'Max automation depth exceeded', depth: executionDepth }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      )
    }

    // Guard: loop detection - same trigger+entity already in chain
    const entityKey = requestBody.data?.lead_id || requestBody.data?.entity_id || requestBody.data?.group_id || requestBody.data?.client_id || 'no-entity'
    const loopKey = `${requestBody.trigger_type || requestBody.automationId}:${entityKey}`
    if (executionChain.includes(loopKey)) {
      console.error(`🛑 SAFETY: Loop detected! Key "${loopKey}" already in execution chain: [${executionChain.join(' → ')}]`)
      return new Response(
        JSON.stringify({ error: 'Automation loop detected', loop_key: loopKey }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      )
    }

    // Guard: cooldown - prevent same trigger+entity from firing again within 30 seconds
    if (requestBody.trigger_type === 'whatsapp_message_received' && entityKey !== 'no-entity') {
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString()
      const { data: recentExec } = await supabase
        .from('automation_executions')
        .select('id')
        .eq('tenant_id', requestBody.tenant_id)
        .eq('trigger_type', 'whatsapp_message_received')
        .eq('entity_id', entityKey)
        .gte('started_at', thirtySecondsAgo)
        .eq('status', 'running')
        .limit(1)
        .maybeSingle()
      
      if (recentExec) {
        return new Response(
          JSON.stringify({ error: 'Cooldown active', entity: entityKey }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        )
      }
    }

    const { data: execRecord } = await supabase.from('automation_executions').insert({
      execution_id: executionId,
      tenant_id: requestBody.tenant_id || null,
      automation_id: requestBody.automationId || null,
      trigger_type: requestBody.trigger_type || null,
      entity_id: entityKey !== 'no-entity' ? entityKey : null,
      depth: executionDepth,
      status: 'running',
      started_at: new Date().toISOString(),
    }).select('id').single()

    // ===== END SAFETY GUARDS =====

    let automations: any[] = []
    let payloadData: any
    let tenantId: string

    const validateFlowTriggerConfig = (config: any, data: any, hasActiveCarmenSession?: boolean): { matches: boolean; reason?: string } => {
      const safeConfig = config || {}
      const safeData = data || {}

      // ═══════════════════════════════════════════════════════════
      // CARMEN SCOPE ENFORCEMENT — CRITICAL SECURITY CHECK
      // Runs BEFORE session bypass. Prevents agent from responding
      // to wrong groups/phones even if a session is active.
      // ═══════════════════════════════════════════════════════════
      const scopeMode = safeConfig.carmen_scope_mode
      const groupCandidates: string[] = [safeData.group_id, safeData.group_chat_id].filter(Boolean) as string[]
      if (scopeMode && scopeMode !== 'all') {
        if (scopeMode === 'specific_group') {
          const allowedGroupIds: string[] = Array.isArray(safeConfig.carmen_allowed_group_ids) && safeConfig.carmen_allowed_group_ids.length > 0
            ? safeConfig.carmen_allowed_group_ids
            : (safeConfig.carmen_allowed_group_id ? [safeConfig.carmen_allowed_group_id] : [])
          if (allowedGroupIds.length === 0) {
            console.warn('[CARMEN SCOPE] specific_group configured but no group IDs set — blocking')
            return { matches: false, reason: 'carmen_scope_no_group_configured' }
          }
          if (groupCandidates.length === 0 || !allowedGroupIds.some((id: string) => groupCandidates.includes(id))) {
            return { matches: false, reason: 'carmen_scope_group_mismatch' }
          }
        } else if (scopeMode === 'specific_phone') {
          // Group messages must NOT be validated against a phone whitelist —
          // group scoping is a separate automation. Silently skip this automation.
          if (safeData.group_id || safeData.group_chat_id || safeData.contact_type === 'group') {
            return { matches: false, reason: 'carmen_scope_phone_ignored_in_group' }
          }
          const allowedPhones: string[] = safeConfig.carmen_allowed_phones || []
          if (allowedPhones.length === 0) {
            console.warn('[CARMEN SCOPE] specific_phone configured but no phones listed — blocking')
            return { matches: false, reason: 'carmen_scope_no_phones_configured' }
          }
          const senderPhone = String(safeData.sender_phone || safeData.phone || '').trim()
          const normalizePhone = (p: string) => String(p || '').replace(/\D/g, '').slice(-9)
          const senderNorm = normalizePhone(senderPhone)
          const allowedNorm = allowedPhones.map(normalizePhone).filter(Boolean)
          if (!senderNorm || !allowedNorm.includes(senderNorm)) {
            console.warn('[CARMEN SCOPE] phone not in whitelist', { senderPhone, senderNorm, allowedNorm })
            return { matches: false, reason: 'carmen_scope_phone_not_allowed' }
          }
        } else if (scopeMode === 'private_only') {
          if (safeData.group_id || safeData.group_chat_id) {
            return { matches: false, reason: 'carmen_scope_private_only_but_group' }
          }
        }
        // Enforce specific Green API connection if set
        if (safeConfig.carmen_connection_user_id && safeData.connection_user_id) {
          if (safeConfig.carmen_connection_user_id !== safeData.connection_user_id) {
            return { matches: false, reason: 'carmen_scope_connection_mismatch' }
          }
        }
      }

      const keywordConfig = safeConfig.trigger_keyword || safeConfig.keyword
      const isCarmenConfig = Boolean(
        safeConfig.carmen_session_mode ||
        safeConfig.trigger_keyword ||
        safeConfig.end_keyword ||
        safeConfig.carmen_scope_mode
      )

      // CARMEN SESSION MODE: if there's an active session, bypass keyword check entirely
      // (scope enforcement above already ran and passed)
      if (isCarmenConfig && hasActiveCarmenSession) {
        // But still close session if end keyword is sent
        if (safeConfig.end_keyword && safeData.message_text) {
          const endKw = String(safeConfig.end_keyword).toLowerCase()
          const msgText = String(safeData.message_text).toLowerCase()
          if (msgText.includes(endKw)) {
            return { matches: false, reason: 'carmen_session_ended' }
          }
        }
        return { matches: true }
      }

      if (safeConfig.facebook_form_id && safeConfig.facebook_form_id !== safeData.facebook_form_id) {
        return { matches: false, reason: 'facebook_form_id_mismatch' }
      }
      if (safeConfig.group_id && !groupCandidates.includes(safeConfig.group_id)) {
        return { matches: false, reason: 'group_id_mismatch' }
      }
      if (safeConfig.connection_user_id && safeConfig.connection_user_id !== safeData.connection_user_id) {
        return { matches: false, reason: 'connection_user_id_mismatch' }
      }

      if (keywordConfig && safeData.message_text) {
        const keywords = String(keywordConfig)
          .split(',')
          .map((k: string) => k.trim().toLowerCase())
          .filter(Boolean)
        const msgText = String(safeData.message_text).toLowerCase()
        const hasMatch = keywords.some((kw: string) => msgText.includes(kw))
        if (!hasMatch) {
          return { matches: false, reason: 'keyword_mismatch' }
        }
      } else if (keywordConfig && !safeData.message_text) {
        return { matches: false, reason: 'keyword_no_message' }
      }

      if (safeConfig.source_filter === 'group' && !safeData.group_id) {
        return { matches: false, reason: 'source_filter_group' }
      }
      if (safeConfig.source_filter === 'all_groups' && !safeData.group_id) {
        return { matches: false, reason: 'source_filter_all_groups' }
      }
      if (safeConfig.source_filter === 'all_groups_except') {
        if (groupCandidates.length === 0) {
          return { matches: false, reason: 'source_filter_all_groups_except' }
        }
        const excludedIds = safeConfig.excluded_group_ids || []
        if (excludedIds.length > 0 && excludedIds.some((id: string) => groupCandidates.includes(id))) {
          return { matches: false, reason: 'group_excluded' }
        }
      }
      if (safeConfig.source_filter === 'multiple_groups') {
        if (groupCandidates.length === 0) {
          return { matches: false, reason: 'source_filter_multiple_groups' }
        }
        const selectedIds = safeConfig.selected_group_ids || []
        if (selectedIds.length > 0 && !selectedIds.some((id: string) => groupCandidates.includes(id))) {
          return { matches: false, reason: 'group_not_selected' }
        }
      }
      if (safeConfig.source_filter === 'private' && safeData.group_id) {
        return { matches: false, reason: 'source_filter_private' }
      }
      // Specific phones whitelist
      if (safeConfig.source_filter === 'specific_phones') {
        const allowedPhones: string[] = safeConfig.allowed_phones || []
        if (allowedPhones.length === 0) {
          console.warn('[TRIGGER] specific_phones selected but no phones configured — blocking')
          return { matches: false, reason: 'specific_phones_none_configured' }
        }
        const senderPhone = String(safeData.sender_phone || safeData.phone || '').trim()
        const normalizePhone = (p: string) => String(p || '').replace(/\D/g, '').slice(-9)
        const senderNorm = normalizePhone(senderPhone)
        const allowedNorm = allowedPhones.map(normalizePhone).filter(Boolean)
        if (!senderNorm || !allowedNorm.includes(senderNorm)) {
          console.warn('[TRIGGER] phone not in whitelist', { senderPhone, senderNorm, allowedNorm })
          return { matches: false, reason: 'specific_phones_not_allowed' }
        }
      }
      return { matches: true }
    }

    // Check if this is a direct automation execution by ID
    if (requestBody.automationId) {
      // Direct execution mode - fetch the specific automation
      const { data: automation, error: fetchError } = await supabase
        .from('automations')
        .select('*')
        .eq('id', requestBody.automationId)
        .single()

      if (fetchError) {
        console.error('Error fetching automation by ID:', fetchError)
        throw fetchError
      }

      if (!automation) {
        throw new Error(`Automation not found: ${requestBody.automationId}`)
      }

      automations = [automation]
      // Support both 'payload' and 'data' field names for the actual data
      payloadData = requestBody.payload || requestBody.data || requestBody
      tenantId = automation.tenant_id
    } else {
      // Standard trigger mode - find automations by trigger_type
      const payload = requestBody as AutomationPayload
      payloadData = payload.data
      tenantId = payload.tenant_id!

      // Resolve automation_ids visible to this tenant: own + shared mirrors
      const { data: sharedRows } = await supabase
        .from('automation_shared_tenants')
        .select('automation_id')
        .eq('tenant_id', payload.tenant_id)
      const sharedAutomationIds: string[] = (sharedRows || []).map((r: any) => r.automation_id)

      // 1. Find non-flow automations by trigger_type — own OR shared into this tenant
      const ownOrSharedFilter = sharedAutomationIds.length > 0
        ? `tenant_id.eq.${payload.tenant_id},id.in.(${sharedAutomationIds.join(',')})`
        : null

      let foundQuery = supabase
        .from('automations')
        .select('*')
        .eq('trigger_type', payload.trigger_type)
        .eq('active', true)
      foundQuery = ownOrSharedFilter
        ? foundQuery.or(ownOrSharedFilter)
        : foundQuery.eq('tenant_id', payload.tenant_id)

      const { data: foundAutomations, error: fetchError } = await foundQuery

      if (fetchError) {
        console.error('Error fetching automations:', fetchError)
        throw fetchError
      }


      // CRITICAL: Exclude flow automations from generic trigger_type lookup.
      // Flow automations must ONLY be matched via trigger step configuration
      // (which validates group_id, keyword, source_filter etc.)
      // Without this, flows bypass their trigger step filters entirely.
      automations = (foundAutomations || []).filter((a: any) => !a.is_flow)

      // 2. Also find flow automations — BUT ONLY if source is NOT 'crm'
      // When source === 'crm', we skip flow lookup entirely to prevent CRM leads from triggering flows
      if (payload.source !== 'crm') {
        // CARMEN SESSION CHECK: before keyword filtering, check if there's an active Carmen session
        // for this sender. If yes, bypass keyword requirement so mid-session messages are routed.
        let hasActiveCarmenSession = false
        const senderPhone = payloadData?.sender_phone || payloadData?.phone || ''
        const chatId = payloadData?.chat_id || ''
        const connectionUserId = payloadData?.connection_user_id || ''
        if (senderPhone && chatId) {
          const sessionQuery = supabase
            .from('carmen_whatsapp_sessions')
            .select('id, agent_id, conversation_history, end_keyword, last_message_at, automation_id')
            .eq('tenant_id', payload.tenant_id)
            .eq('status', 'active')
            .eq('chat_id', chatId)
            .eq('phone', senderPhone)
          // connection_user_id is optional — only filter if present
          if (connectionUserId) {
            sessionQuery.eq('connection_user_id', connectionUserId)
          }
          const { data: activeSession } = await sessionQuery
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          // 🔁 ECHO/LOOP GUARD: if incoming text equals Carmen's last assistant reply in this
          // session, it's a self-echo from the WhatsApp provider — skip session continuation.
          if (activeSession) {
            const hist = activeSession.conversation_history || []
            const lastAssistant = [...hist].reverse().find((m: any) => m?.role === 'assistant')
            const incomingText = String(payloadData?.message_text || '').trim()
            const lastText = String(lastAssistant?.content || '').trim()
            if (incomingText && lastText && (incomingText === lastText || lastText.startsWith(incomingText) || incomingText.startsWith(lastText))) {
              console.log('[CARMEN] Dropping echoed assistant reply for session', activeSession.id)
              return new Response(JSON.stringify({ success: true, skipped: 'carmen_echo' }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              })
            }
          }

          if (activeSession) {
            // ── Timeout check: if session is stale, close it ──────────────────────
            // We need the trigger config to know the timeout setting
            // Fetch it from the automation's trigger step
            let sessionTimeoutMinutes = 60 // default
            if (activeSession.automation_id) {
              const { data: tStep } = await supabase
                .from('automation_flow_steps')
                .select('configuration')
                .eq('automation_id', activeSession.automation_id)
                .eq('step_type', 'trigger')
                .limit(1)
                .maybeSingle()
              if (tStep?.configuration?.session_timeout_minutes != null) {
                sessionTimeoutMinutes = tStep.configuration.session_timeout_minutes
              }
            }
            if (sessionTimeoutMinutes > 0 && activeSession.last_message_at) {
              const lastMsg = new Date(activeSession.last_message_at).getTime()
              const idleMs = Date.now() - lastMsg
              if (idleMs > sessionTimeoutMinutes * 60 * 1000) {
                // Session timed out — close it
                await supabase
                  .from('carmen_whatsapp_sessions')
                  .update({ status: 'ended', ended_at: new Date().toISOString() })
                  .eq('id', activeSession.id)
                console.log(`[CARMEN] Session ${activeSession.id} timed out after ${sessionTimeoutMinutes} min`)
                // Don't set hasActiveCarmenSession — let it fall through to keyword check
              } else {
                hasActiveCarmenSession = true
                // Check if this message is the end keyword — if so, close session
                const msgText = (payloadData?.message_text || '').toLowerCase()
                const endKw = (activeSession.end_keyword || 'סיימנו').toLowerCase()
                if (msgText.includes(endKw)) {
                  await supabase
                    .from('carmen_whatsapp_sessions')
                    .update({ status: 'ended', ended_at: new Date().toISOString() })
                    .eq('id', activeSession.id)
                  hasActiveCarmenSession = false
                  payloadData._carmen_session_ended = true
                  console.log(`[CARMEN] Session ${activeSession.id} closed by end keyword`)
                } else {
                  // Inject session context into payload for the AI agent
                  payloadData._carmen_session_id = activeSession.id
                  payloadData._carmen_agent_id = activeSession.agent_id
                  payloadData._carmen_history = activeSession.conversation_history || []
                  // Update last_message_at
                  await supabase
                    .from('carmen_whatsapp_sessions')
                    .update({ last_message_at: new Date().toISOString() })
                    .eq('id', activeSession.id)
                }
              }
            } else {
              // No timeout configured — session stays active indefinitely
              hasActiveCarmenSession = true
              const msgText = (payloadData?.message_text || '').toLowerCase()
              const endKw = (activeSession.end_keyword || 'סיימנו').toLowerCase()
              if (msgText.includes(endKw)) {
                await supabase
                  .from('carmen_whatsapp_sessions')
                  .update({ status: 'ended', ended_at: new Date().toISOString() })
                  .eq('id', activeSession.id)
                hasActiveCarmenSession = false
                payloadData._carmen_session_ended = true
              } else {
                payloadData._carmen_session_id = activeSession.id
                payloadData._carmen_agent_id = activeSession.agent_id
                payloadData._carmen_history = activeSession.conversation_history || []
                await supabase
                  .from('carmen_whatsapp_sessions')
                  .update({ last_message_at: new Date().toISOString() })
                  .eq('id', activeSession.id)
              }
            }
          }
        }

        const triggerTypesToMatch = payload.trigger_type === 'whatsapp_message_received'
          ? ['whatsapp_message_received', 'carmen_whatsapp_session']
          : [payload.trigger_type]

        // Include flow steps from own tenant OR from automations shared into this tenant
        const flowStepFilter = sharedAutomationIds.length > 0
          ? `tenant_id.eq.${payload.tenant_id},automation_id.in.(${sharedAutomationIds.join(',')})`
          : null

        let flowStepsQuery = supabase
          .from('automation_flow_steps')
          .select('automation_id, configuration, tenant_id')
          .eq('step_type', 'trigger')
          .in('action_type', triggerTypesToMatch)
        flowStepsQuery = flowStepFilter
          ? flowStepsQuery.or(flowStepFilter)
          : flowStepsQuery.eq('tenant_id', payload.tenant_id)

        const { data: flowTriggerSteps, error: flowError } = await flowStepsQuery

        if (flowError) {
          console.error('Error fetching flow trigger steps:', flowError)
        }

        if (flowTriggerSteps && flowTriggerSteps.length > 0) {
          // Filter by trigger configuration BEFORE fetching automations
          const matchingSteps = flowTriggerSteps.filter((step: any) => {
            const config = step.configuration || {}
            const validation = validateFlowTriggerConfig(config, payloadData, hasActiveCarmenSession)
            return validation.matches
          })
          const flowAutomationIds = matchingSteps.map((s: any) => s.automation_id)
          // Filter out IDs already found
          const existingIds = new Set(automations.map((a: any) => a.id))
          const newFlowIds = flowAutomationIds.filter((id: string) => !existingIds.has(id))

          if (newFlowIds.length > 0) {
            const { data: flowAutomations, error: flowAutoError } = await supabase
              .from('automations')
              .select('*')
              .in('id', newFlowIds)
              .eq('active', true)

            if (flowAutoError) {
              console.error('Error fetching flow automations:', flowAutoError)
            } else if (flowAutomations) {
              automations = [...automations, ...flowAutomations]
            }
          }
        }
      } else {
        // When source is 'crm', also filter out any flow automations that were found in CRM automations
        automations = automations.filter((a: any) => !a.is_flow)
      }
    }


    // Execute each matching automation
    const results = await Promise.allSettled(
      (automations || []).map(async (automation) => {
        const startTime = Date.now()
        
        try {
          // Check conditions if any (pass trigger_type to skip irrelevant conditions)
          if (automation.conditions && Object.keys(automation.conditions).length > 0) {
            const conditionsMet = checkConditions(automation.conditions, payloadData, automation.trigger_type)
            if (!conditionsMet) {
              return
            }
          }

          let response: any

          // If this is a flow automation, execute flow steps sequentially
          if (automation.is_flow) {
            const { data: flowSteps, error: stepsError } = await supabase
              .from('automation_flow_steps')
              .select('*')
              .eq('automation_id', automation.id)
              .order('sort_order', { ascending: true })

            if (stepsError) {
              console.error('Error fetching flow steps:', stepsError)
              throw stepsError
            }


            // === CRITICAL: Validate trigger step matches incoming payload ===
            // In TEST mode (direct execution by automationId with test=true),
            // we bypass trigger filter validation so the test always runs end-to-end
            // and shows up in the run history.
            const isTestRun = Boolean(requestBody.automationId) && Boolean(payloadData?.test)
            const triggerSteps = (flowSteps || []).filter((s: any) => s.step_type === 'trigger')
            const incomingTriggerTypeForMatch = (requestBody as any).trigger_type || (requestBody as any).triggerType
            // Support multiple triggers per automation (OR semantics):
            // pick the trigger step whose action_type matches the incoming event.
            const triggerStep =
              triggerSteps.find((s: any) => s.action_type === incomingTriggerTypeForMatch) ||
              triggerSteps.find((s: any) => s.action_type === 'carmen_whatsapp_session' && incomingTriggerTypeForMatch === 'whatsapp_message_received') ||
              triggerSteps[0]
            if (triggerStep && !isTestRun) {
              // Check action_type match (e.g. whatsapp_message_received vs lead_created)
              const triggerActionType = triggerStep.action_type
              const incomingTriggerType = (requestBody as any).trigger_type || (requestBody as any).triggerType
              const triggerTypesMatch = !triggerActionType || !incomingTriggerType ||
                triggerActionType === incomingTriggerType ||
                (triggerActionType === 'carmen_whatsapp_session' && incomingTriggerType === 'whatsapp_message_received')

              if (!triggerTypesMatch) {
                // Log skipped run so it appears in history
                await supabase.from('automation_logs').insert({
                  automation_id: automation.id,
                  success: false,
                  error_message: `דולג: trigger_type_mismatch (${triggerActionType} ≠ ${incomingTriggerType})`,
                  payload: payloadData,
                  execution_time_ms: Date.now() - startTime,
                })
                return { skipped: true, reason: 'trigger_type_mismatch' }
              }
              // Also validate trigger step filters (group_id, keyword, etc.)
              const config = triggerStep.configuration || {}
              const validation = validateFlowTriggerConfig(
                config,
                payloadData,
                Boolean(payloadData?._carmen_session_id && !payloadData?._carmen_session_ended)
              )
              if (!validation.matches) {
                // Log skipped run so it appears in history
                await supabase.from('automation_logs').insert({
                  automation_id: automation.id,
                  success: false,
                  error_message: `דולג: ${validation.reason || 'trigger_config_mismatch'}`,
                  payload: payloadData,
                  execution_time_ms: Date.now() - startTime,
                })
                return { skipped: true, reason: validation.reason || 'trigger_config_mismatch' }
              }
            }

            // === FB ENRICHMENT: Parse fb_ fields from notes (saved during sync) ===
            if (payloadData.test && payloadData.notes) {
              const lines = String(payloadData.notes).split('\n')
              let inFbSection = false
              // Meta lines from cron-sync-facebook-leads header (skip these)
              const metaKeys = new Set([
                'leadgen_id', 'facebook lead id', 'facebook form', 'form id', 'created',
              ])
              for (const line of lines) {
                // Legacy section header
                if (line.includes('--- שדות טופס פייסבוק ---')) {
                  inFbSection = true
                  continue
                }
                // New explicit format: fb_key: value
                const fbMatch = line.match(/^(fb_[^:]+):\s*(.+)$/)
                if (fbMatch) {
                  if (!(fbMatch[1] in payloadData)) payloadData[fbMatch[1]] = fbMatch[2].trim()
                  continue
                }
                // Generic key: value — register as fb_key unless it's a known meta line
                const kvMatch = line.match(/^([^:]+):\s*(.+)$/)
                if (kvMatch) {
                  const rawKey = kvMatch[1].trim()
                  if (metaKeys.has(rawKey.toLowerCase())) continue
                  const key = `fb_${rawKey}`
                  if (!(key in payloadData)) payloadData[key] = kvMatch[2].trim()
                  continue
                }
                if (inFbSection) continue
              }
            }
            // === END FB ENRICHMENT ===

            // ═══════════════════════════════════════════════════════════════
            // DAG-BASED FLOW ENGINE
            // Executes nodes in topological order (Kahn's algorithm).
            // Supports: condition(IF), switch, merge, loop, code, error_branch
            // ═══════════════════════════════════════════════════════════════

            // Build adjacency map
            type StepEdge = { targetId: string; sourceHandle: string | null }
            const outEdges: Record<string, StepEdge[]> = {}
            const inDegree: Record<string, number> = {}
            const stepMap: Record<string, any> = {}

            for (const s of (flowSteps || [])) {
              stepMap[s.id] = s
              outEdges[s.id] = outEdges[s.id] || []
              inDegree[s.id] = inDegree[s.id] || 0
            }
            for (const s of (flowSteps || [])) {
              if (s.parent_step_id && stepMap[s.parent_step_id]) {
                outEdges[s.parent_step_id].push({ targetId: s.id, sourceHandle: s.condition_branch || null })
                inDegree[s.id] = (inDegree[s.id] || 0) + 1
              }
            }

            // Topological sort
            const topoQueue: string[] = Object.keys(stepMap).filter(id => (inDegree[id] || 0) === 0)
            const topoOrder: string[] = []
            const tempDeg = { ...inDegree }
            while (topoQueue.length > 0) {
              const cur = topoQueue.shift()!
              topoOrder.push(cur)
              for (const edge of (outEdges[cur] || [])) {
                tempDeg[edge.targetId] = (tempDeg[edge.targetId] || 1) - 1
                if (tempDeg[edge.targetId] === 0) topoQueue.push(edge.targetId)
              }
            }

            // Per-node output store
            const nodeOutputs: Record<string, any> = {}
            const skippedNodes = new Set<string>()

            const stepResults: any[] = []
            let actionCount = 0
            let previousStepOutput: any = null

            for (const stepId of topoOrder) {
              const step = stepMap[stepId]
              if (!step) continue

              // SAFETY: Runtime timeout check
              const elapsedSeconds = (Date.now() - executionStartTime) / 1000
              if (elapsedSeconds >= MAX_RUNTIME_SECONDS) {
                console.error(`🛑 SAFETY: Runtime limit (${MAX_RUNTIME_SECONDS}s) exceeded after ${elapsedSeconds.toFixed(1)}s. Stopping flow.`)
                stepResults.push({ step_id: step.id, action_type: step.action_type, success: false, error: 'Runtime limit exceeded' })
                break
              }
              // SAFETY: Max actions check
              if (actionCount >= MAX_ACTIONS_PER_RUN) {
                console.error(`🛑 SAFETY: Max actions per run (${MAX_ACTIONS_PER_RUN}) reached. Stopping flow.`)
                stepResults.push({ step_id: step.id, action_type: step.action_type, success: false, error: 'Max actions exceeded' })
                break
              }

              // Skip trigger steps
              if (step.step_type === 'trigger') {
                nodeOutputs[step.id] = payloadData
                continue
              }

              // Skip nodes on branches not taken
              if (skippedNodes.has(step.id)) {
                for (const edge of (outEdges[step.id] || [])) skippedNodes.add(edge.targetId)
                continue
              }

              const stepConfig = step.configuration || {}

              // Build stepData: merge payloadData + latest parent output
              const stepData: Record<string, any> = {
                ...payloadData,
                previous_step_output: previousStepOutput,
                agent_output: previousStepOutput?.output || previousStepOutput,
                _node_outputs: nodeOutputs,
              }

              let stepResponse: any = null

              try {
                const effectiveActionType = step.action_type || step.step_type

                // ── CONDITION (IF) ──────────────────────────────────────────
                if (step.step_type === 'condition') {
                  const field = stepConfig.condition_field || ''
                  const operator = stepConfig.condition_operator || 'equals'
                  const expected = String(stepConfig.condition_value || '')
                  const actual = String(stepData[field] ?? '')
                  let result = false
                  if (operator === 'equals') result = actual === expected
                  else if (operator === 'not_equals') result = actual !== expected
                  else if (operator === 'contains') result = actual.toLowerCase().includes(expected.toLowerCase())
                  else if (operator === 'not_contains') result = !actual.toLowerCase().includes(expected.toLowerCase())
                  else if (operator === 'starts_with') result = actual.startsWith(expected)
                  else if (operator === 'greater_than') result = parseFloat(actual) > parseFloat(expected)
                  else if (operator === 'less_than') result = parseFloat(actual) < parseFloat(expected)
                  else if (operator === 'is_empty') result = !actual || actual === 'undefined'
                  else if (operator === 'is_not_empty') result = !!actual && actual !== 'undefined'
                  stepResponse = { condition_result: result }
                  nodeOutputs[step.id] = { ...stepData, condition_result: result }
                  const notTakenHandle = result ? 'false' : 'true'
                  for (const edge of (outEdges[step.id] || [])) {
                    if (edge.sourceHandle === notTakenHandle) skippedNodes.add(edge.targetId)
                  }
                  actionCount++
                  stepResults.push({ step_id: step.id, action_type: 'condition', success: true, response: stepResponse })
                  continue
                }

                // ── SWITCH ──────────────────────────────────────────────────
                if (step.step_type === 'switch') {
                  const switchField = stepConfig.switch_field || ''
                  const actualValue = String(stepData[switchField] ?? '')
                  const branches: string[] = stepConfig.switch_branches || ['ברירת מחדל']
                  const matchedBranch = branches.includes(actualValue) ? actualValue : branches[branches.length - 1]
                  stepResponse = { matched_branch: matchedBranch }
                  nodeOutputs[step.id] = { ...stepData, matched_branch: matchedBranch }
                  for (const edge of (outEdges[step.id] || [])) {
                    const branchName = edge.sourceHandle?.replace('branch_', '') || ''
                    if (branchName !== matchedBranch) skippedNodes.add(edge.targetId)
                  }
                  actionCount++
                  stepResults.push({ step_id: step.id, action_type: 'switch', success: true, response: stepResponse })
                  continue
                }

                // ── MERGE ───────────────────────────────────────────────────
                if (step.step_type === 'merge') {
                  const mergedData: Record<string, any> = { ...stepData }
                  Object.values(nodeOutputs).forEach(o => { if (o && typeof o === 'object') Object.assign(mergedData, o) })
                  stepResponse = { merged: true }
                  nodeOutputs[step.id] = mergedData
                  Object.assign(payloadData, mergedData)
                  actionCount++
                  stepResults.push({ step_id: step.id, action_type: 'merge', success: true, response: stepResponse })
                  continue
                }

                // ── LOOP ────────────────────────────────────────────────────
                if (step.step_type === 'loop') {
                  const loopField = stepConfig.loop_field || ''
                  const rawItems = stepData[loopField]
                  const items: any[] = Array.isArray(rawItems)
                    ? rawItems
                    : typeof rawItems === 'string'
                    ? rawItems.split(',').map((s: string) => s.trim()).filter(Boolean)
                    : []
                  stepResponse = { loop_items_count: items.length }
                  nodeOutputs[step.id] = { ...stepData, loop_items: items, loop_current_item: items[0] }
                  payloadData.loop_items = items
                  payloadData.loop_current_item = items[0]
                  if (items.length === 0) {
                    for (const edge of (outEdges[step.id] || [])) {
                      if (edge.sourceHandle === 'loop_body') skippedNodes.add(edge.targetId)
                    }
                  }
                  actionCount++
                  stepResults.push({ step_id: step.id, action_type: 'loop', success: true, response: stepResponse })
                  continue
                }

                // ── CODE ────────────────────────────────────────────────────
                if (step.step_type === 'code') {
                  const codeStr = stepConfig.code || 'return {};'
                  try {
                    const fn = new Function('$input', `"use strict"; ${codeStr}`)
                    const result = fn({ ...stepData })
                    stepResponse = result && typeof result === 'object' ? result : { output: result }
                    if (stepResponse && typeof stepResponse === 'object') Object.assign(payloadData, stepResponse)
                    nodeOutputs[step.id] = { ...stepData, ...stepResponse }
                    previousStepOutput = stepResponse
                  } catch (codeErr: any) {
                    stepResponse = { error: codeErr.message }
                    nodeOutputs[step.id] = { ...stepData, code_error: codeErr.message }
                  }
                  actionCount++
                  stepResults.push({ step_id: step.id, action_type: 'code', success: !stepResponse?.error, response: stepResponse })
                  continue
                }

                // ── ERROR BRANCH ────────────────────────────────────────────
                if (step.step_type === 'error_branch') {
                  const prevResult = stepResults[stepResults.length - 1]
                  const hadError = prevResult && !prevResult.success
                  stepResponse = { had_error: hadError, prev_error: prevResult?.error || null }
                  nodeOutputs[step.id] = { ...stepData, had_error: hadError }
                  for (const edge of (outEdges[step.id] || [])) {
                    if (hadError && edge.sourceHandle === 'success') skippedNodes.add(edge.targetId)
                    if (!hadError && edge.sourceHandle === 'error') skippedNodes.add(edge.targetId)
                  }
                  actionCount++
                  stepResults.push({ step_id: step.id, action_type: 'error_branch', success: true, response: stepResponse })
                  continue
                }

                // ── DELAY ───────────────────────────────────────────────────
                if (step.step_type === 'delay') {
                  const amount = parseInt(stepConfig.delay_amount || '1', 10)
                  const unit = stepConfig.delay_unit || 'minutes'
                  const ms = unit === 'minutes' ? amount * 60000 : unit === 'hours' ? amount * 3600000 : amount * 86400000
                  if (ms <= 30000) await new Promise(r => setTimeout(r, ms))
                  stepResponse = { delayed_ms: ms }
                  nodeOutputs[step.id] = stepData
                  actionCount++
                  stepResults.push({ step_id: step.id, action_type: 'delay', success: true, response: stepResponse })
                  continue
                }

                // ── REGULAR ACTIONS ─────────────────────────────────────────
                if (effectiveActionType === 'agent') {
                  const agentId = stepConfig.agent_id
                  if (agentId) {
                    // CARMEN SESSION: detect from trigger step config OR legacy automation.configuration
                    // Trigger step config takes priority (new Flow Builder approach)
                    const triggerStepForCarmen = (flowSteps || []).find((s: any) => s.step_type === 'trigger')
                    const triggerCfg = triggerStepForCarmen?.configuration || {}
                      const isCarmenFlow = triggerStepForCarmen?.action_type === 'carmen_whatsapp_session' ||
                        triggerCfg.carmen_session_mode ||
                      (automation as any).configuration?.carmen_session_mode

                    // HARD GUARD: Carmen WhatsApp flows are now owned end-to-end by
                    // `handleCarmenMessage` in the webhooks (green-api-webhook / manus-wa-webhook).
                    // Running this legacy path duplicates replies AND leaks the agent step's
                    // `step_instruction` (treated as a user message) back into the chat as
                    // "ההנחיות נשמרו" loops. Skip the agent + downstream send entirely.
                    if (isCarmenFlow) {
                      console.log('[trigger-automation] Skipping legacy Carmen agent path — owned by webhook handler', { automationId: automation.id })
                      // Mark all downstream steps as skipped so the executed send step
                      // (which would otherwise log "send_manus_message" without text) is
                      // not reported as a successful run.
                      const queue: string[] = [step.id]
                      while (queue.length) {
                        const cur = queue.shift()!
                        for (const edge of (outEdges[cur] || [])) {
                          if (!skippedNodes.has(edge.targetId)) {
                            skippedNodes.add(edge.targetId)
                            queue.push(edge.targetId)
                          }
                        }
                      }
                      stepResponse = { success: true, skipped: 'carmen_owned_by_webhook' }
                      previousStepOutput = { success: true, output: '', skipped: 'carmen_owned_by_webhook' }
                      nodeOutputs[step.id] = stepData
                      stepResults.push({ step_id: step.id, action_type: 'agent', success: true, response: stepResponse })
                      continue
                    }

                    if (isCarmenFlow) {
                      const sPhone = payloadData?.sender_phone || payloadData?.phone || ''
                      const cId = payloadData?.chat_id || payloadData?.group_chat_id || ''

                      // ── Timeout check: close expired sessions ──────────────
                      const timeoutMinutes = triggerCfg.session_timeout_minutes ??
                        (automation as any).configuration?.session_timeout_minutes ?? 60
                      if (timeoutMinutes > 0 && payloadData._carmen_session_id) {
                        const { data: sessionRow } = await supabase
                          .from('carmen_whatsapp_sessions')
                          .select('last_message_at')
                          .eq('id', payloadData._carmen_session_id)
                          .single()
                        if (sessionRow?.last_message_at) {
                          const lastMsg = new Date(sessionRow.last_message_at).getTime()
                          const idleMs = Date.now() - lastMsg
                          if (idleMs > timeoutMinutes * 60 * 1000) {
                            // Session timed out — close it and start fresh
                            await supabase
                              .from('carmen_whatsapp_sessions')
                              .update({ status: 'ended', ended_at: new Date().toISOString() })
                              .eq('id', payloadData._carmen_session_id)
                            payloadData._carmen_session_id = undefined
                            payloadData._carmen_history = []
                            console.log(`[CARMEN] Session timed out after ${timeoutMinutes} minutes — starting fresh`)
                          }
                        }
                      }

                      if (!payloadData._carmen_session_id) {
                        // No active session — only create one if trigger keyword is present AND message is outgoing
                        const messageDirection = String(payloadData?.direction || '').toLowerCase()
                        const isOutgoingMessage = messageDirection === 'outgoing' || messageDirection === 'outbound'
                        const triggerKeyword = triggerCfg.trigger_keyword ||
                          (automation as any).configuration?.trigger_keyword || 'כרמן'
                        const messageText = (payloadData?.text || payloadData?.message_text || '').toLowerCase()
                        const triggerWords = [triggerKeyword.toLowerCase(), 'carmen', 'כרמן']
                        const hasTrigger = triggerWords.some(kw => messageText.includes(kw))

                        // In group chats, allow inbound trigger keyword (group members can invoke Carmen).
                        // In private chats, only outbound (operator's own device) can start a session.
                        const isGroupChat = String(cId).includes('@g.us')
                        const allowedByDirection = isOutgoingMessage || (isGroupChat && messageDirection === 'inbound')
                        if (!hasTrigger || !allowedByDirection) {
                          console.log(`[CARMEN] No active session — skipping: hasTrigger=${hasTrigger}, direction=${messageDirection}, isGroup=${isGroupChat} for chat ${cId}`)
                          continue
                        }

                        // Trigger keyword found — create new session
                        const connUserId = payloadData?.connection_user_id || ''
                        const { data: newSession } = await supabase
                          .from('carmen_whatsapp_sessions')
                          .insert({
                            tenant_id: tenantId,
                            chat_id: cId,
                            phone: sPhone,
                            sender_name: payloadData?.sender_name || payloadData?.contact_name || '',
                            agent_id: agentId,
                            connection_user_id: connUserId || null,
                            conversation_history: [],
                            status: 'active',
                            automation_id: automation.id || null,
                            started_by_keyword: triggerKeyword,
                            end_keyword: triggerCfg.end_keyword ||
                              (automation as any).configuration?.end_keyword || 'סיימנו',
                          })
                          .select('id')
                          .single()
                        if (newSession) {
                          payloadData._carmen_session_id = newSession.id
                          payloadData._carmen_history = []
                          console.log(`[CARMEN] New session created: ${newSession.id} for chat ${cId}`)
                        }
                      } else {
                        // Session exists — only respond to INBOUND messages from the user.
                        // Outbound messages are Carmen's own replies echoed back by the webhook;
                        // processing them would cause Carmen to reply to herself in a loop and
                        // hallucinate confirmations without actually invoking tools.
                        const messageDirection = String(payloadData?.direction || '').toLowerCase()
                        const isOutgoingMessage = messageDirection === 'outgoing' || messageDirection === 'outbound'
                        if (isOutgoingMessage) {
                          console.log(`[CARMEN] Active session ${payloadData._carmen_session_id} — skipping outbound echo for chat ${cId}`)
                          continue
                        }
                        // Update last_message_at on inbound messages to keep session alive
                        await supabase
                          .from('carmen_whatsapp_sessions')
                          .update({ last_message_at: new Date().toISOString() })
                          .eq('id', payloadData._carmen_session_id)
                      }
                    }

                    // Build command_text from step_instruction with variable replacement
                    let commandText = stepConfig.step_instruction || payloadData?.command_text || payloadData?.text || 'הפעל את האוטומציה'
                    
                    // Replace {{variable}} placeholders with actual values from stepData
                    // Use [^}]+ instead of \w+ to support Hebrew characters and special symbols in variable names
                    commandText = commandText.replace(/\{\{([^}]+)\}\}/g, (match: string, key: string) => {
                      const trimmedKey = key.trim()
                      if (stepData[trimmedKey] !== undefined && stepData[trimmedKey] !== null) return String(stepData[trimmedKey])
                      if (payloadData?.[trimmedKey] !== undefined && payloadData?.[trimmedKey] !== null) return String(payloadData[trimmedKey])
                      return match // Keep placeholder if no value found
                    })

                    // Append output format instruction if specified
                    const outputFormat = stepConfig.output_format
                    let agentTemperature: number | undefined = undefined
                    if (outputFormat === 'json') {
                      commandText += '\n\nחשוב: החזר את התשובה בפורמט JSON בלבד, ללא טקסט נוסף.'
                      agentTemperature = 0.1
                    } else if (outputFormat === 'single_value') {
                      commandText += '\n\nחשוב: החזר ערך בודד בלבד, ללא הסברים או טקסט נוסף.'
                      agentTemperature = 0.1
                    } else if (outputFormat === 'single_reply') {
                      commandText += '\n\nחשוב מאוד: החזר תשובה אחת ישירה בלבד, במשפט קצר, ללא רשימות, ללא חלופות, ללא הומור וללא ניסוחים כמו "הנה כמה אפשרויות".'
                      agentTemperature = 0.1
                    }

                    const agentUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/run-ai-agent`
                    // Build conversation history — prefer the active Carmen session,
                    // otherwise reuse the most recent Carmen session for this chat.
                    let carmenHistory: any[] = payloadData?._carmen_history || []
                    if (carmenHistory.length === 0) {
                      const sessionChatId = payloadData?.chat_id || ''
                      const sessionPhone = payloadData?.sender_phone || payloadData?.phone || ''

                      if (sessionChatId || sessionPhone) {
                        // Only restore from sessions that were active within the last 30 minutes —
                        // older sessions are considered dead and must not bleed stale context
                        // into a fresh conversation.
                        const freshSince = new Date(Date.now() - 30 * 60_000).toISOString()
                        let previousSessionQuery = supabase
                          .from('carmen_whatsapp_sessions')
                          .select('id, conversation_history, last_message_at')
                          .eq('tenant_id', tenantId)
                          .gte('last_message_at', freshSince)
                          .order('last_message_at', { ascending: false })
                          .order('created_at', { ascending: false })
                          .limit(1)

                        if (sessionChatId) {
                          previousSessionQuery = previousSessionQuery.eq('chat_id', sessionChatId)
                        }
                        if (sessionPhone) {
                          previousSessionQuery = previousSessionQuery.eq('phone', sessionPhone)
                        }
                        if (payloadData?.connection_user_id) {
                          previousSessionQuery = previousSessionQuery.eq('connection_user_id', payloadData.connection_user_id)
                        }
                        if (payloadData?._carmen_session_id) {
                          previousSessionQuery = previousSessionQuery.neq('id', payloadData._carmen_session_id)
                        }

                        const { data: previousSession } = await previousSessionQuery.maybeSingle()
                        const previousHistory = Array.isArray(previousSession?.conversation_history)
                          ? previousSession.conversation_history
                          : []

                        if (previousHistory.length > 0) {
                          carmenHistory = previousHistory
                          payloadData._carmen_history = previousHistory
                          console.log(`[CARMEN] Restored ${previousHistory.length} history items from recent session ${previousSession?.id}`)
                        }
                      }
                    }
                    const agentBody: any = {
                      agent_id: agentId,
                      command_text: commandText,
                      temperature: agentTemperature,
                      automation_id: automation.id,
                      user_name: payloadData?.user_name || 'מערכת',
                      lead_data: {
                        lead_id: stepData.lead_id,
                        contact_name: stepData.contact_name,
                        phone: stepData.phone,
                        email: stepData.email,
                        company_name: stepData.company_name,
                        source: stepData.source,
                        notes: stepData.notes,
                        status: stepData.status,
                        pipeline_stage: stepData.pipeline_stage,
                        agency_name: stepData.agency_name,
                        ...Object.fromEntries(
                          Object.entries(stepData)
                            .filter(([k]) => k.startsWith('fb_'))
                        ),
                      },
                    }
                    // Pass conversation history for Carmen sessions
                    if (carmenHistory.length > 0) {
                      agentBody.conversation_history = carmenHistory
                    }
                    const agentRes = await fetch(agentUrl, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                      },
                      body: JSON.stringify(agentBody),
                    })
                    stepResponse = await agentRes.json()
                    previousStepOutput = stepResponse
                    // SESSION: save updated history after agent responds (for whatsapp_session step)
                    if (stepResponse?.output) {
                      const updatedHistory = [
                        ...carmenHistory,
                        { role: 'user', content: commandText, ts: new Date().toISOString() },
                        { role: 'assistant', content: stepResponse.output, ts: new Date().toISOString() },
                      ]
                      // Store in payloadData so the whatsapp_session step can use it
                      payloadData._pending_session_history = updatedHistory
                      // Also update carmen_whatsapp_sessions if applicable
                      if (payloadData?._carmen_session_id) {
                        await supabase
                          .from('carmen_whatsapp_sessions')
                          .update({
                            conversation_history: updatedHistory,
                            last_message_at: new Date().toISOString(),
                          })
                          .eq('id', payloadData._carmen_session_id)
                      }
                    }
                  }
                } else if (effectiveActionType === 'send_greenapi_message' || effectiveActionType === 'send_manus_message') {
                  // If message_template contains {{agent_output}}, replace it.
                  // Distinguish between real failures (throw) and legitimate empty output
                  // (agent intentionally produced no text — e.g. only tool calls, or the
                  // AI step was suppressed). In the empty-output case, skip the send step
                  // silently instead of raising a misleading "כרמן לא החזירה תשובה" error.
                  if (stepConfig.message_template?.includes('{{agent_output}}') && !previousStepOutput?.output) {
                    if (previousStepOutput && previousStepOutput.success === false) {
                      throw new Error('כרמן לא החזירה תשובה לשליחה, לכן ההודעה לא נשלחה')
                    }
                    console.log('[trigger-automation] Skipping send step — agent returned no text output')
                    stepResponse = { success: true, skipped: 'empty_agent_output' }
                    previousStepOutput = stepResponse
                  } else {
                    if (stepConfig.message_template && previousStepOutput) {
                      const agentText = previousStepOutput?.output || (typeof previousStepOutput === 'string' ? previousStepOutput : JSON.stringify(previousStepOutput))
                      stepConfig.message_template = stepConfig.message_template.replace(/\{\{agent_output\}\}/g, agentText)
                      // Also support {{previous_step_output}}
                      stepConfig.message_template = stepConfig.message_template.replace(/\{\{previous_step_output\}\}/g, agentText)
                    }
                    stepResponse = await executeGreenApiMessage(supabase, stepConfig, stepData, tenantId)
                    previousStepOutput = stepResponse
                  }
                } else if (effectiveActionType === 'send_whatsapp') {
                  if (stepConfig.message_template && previousStepOutput) {
                    const agentText = previousStepOutput?.output || (typeof previousStepOutput === 'string' ? previousStepOutput : JSON.stringify(previousStepOutput))
                    stepConfig.message_template = stepConfig.message_template.replace(/\{\{agent_output\}\}/g, agentText)
                    stepConfig.message_template = stepConfig.message_template.replace(/\{\{previous_step_output\}\}/g, agentText)
                  }
                  stepResponse = await executeSendWhatsapp(supabase, stepConfig, stepData, tenantId)
                  previousStepOutput = stepResponse
                } else if (effectiveActionType === 'webhook') {
                  stepResponse = await executeWebhook(stepConfig, stepData)
                  previousStepOutput = stepResponse
                } else if (effectiveActionType === 'add_lead_update') {
                  if (stepConfig.update_text && previousStepOutput) {
                    const agentText = previousStepOutput?.output || (typeof previousStepOutput === 'string' ? previousStepOutput : '')
                    stepConfig.update_text = stepConfig.update_text.replace(/\{\{agent_output\}\}/g, agentText)
                  }
                  stepResponse = await executeAddLeadUpdate(supabase, stepConfig, stepData, tenantId)
                  previousStepOutput = stepResponse
                } else if (effectiveActionType === 'add_client_update') {
                  stepResponse = await executeAddClientUpdate(supabase, stepConfig, stepData, tenantId)
                  previousStepOutput = stepResponse
                } else if (effectiveActionType === 'create_task') {
                  stepResponse = await executeCreateTask(supabase, stepConfig, stepData, tenantId)
                  previousStepOutput = stepResponse
                } else if (effectiveActionType === 'create_lead') {
                  stepResponse = await executeCreateLead(supabase, stepConfig, stepData, tenantId)
                  previousStepOutput = stepResponse
                } else if (effectiveActionType === 'update_status') {
                  stepResponse = await executeStatusUpdate(supabase, stepConfig, stepData)
                  previousStepOutput = stepResponse
                } else if (effectiveActionType === 'create_manychat_subscriber') {
                  stepResponse = await executeCreateManychatSubscriber(supabase, stepConfig, stepData, tenantId)
                  previousStepOutput = stepResponse
                } else if (effectiveActionType === 'send_greenapi_to_campaigner') {
                  stepResponse = await executeGreenApiToCampaigner(supabase, stepConfig, stepData, tenantId)
                  previousStepOutput = stepResponse
                } else if (effectiveActionType === 'send_telegram') {
                  // Replace dynamic variables in message template
                  if (stepConfig.message_template && previousStepOutput) {
                    const agentText = previousStepOutput?.output || (typeof previousStepOutput === 'string' ? previousStepOutput : JSON.stringify(previousStepOutput))
                    stepConfig.message_template = stepConfig.message_template.replace(/\{\{agent_output\}\}/g, agentText)
                    stepConfig.message_template = stepConfig.message_template.replace(/\{\{previous_step_output\}\}/g, agentText)
                  }
                  // Replace contact_name variable (special alias)
                  if (stepConfig.message_template) {
                    const contactName = stepData?.contact_name || stepData?.sender_name || stepData?.name || ''
                    stepConfig.message_template = stepConfig.message_template.replace(/\{\{contact_name\}\}/g, contactName)
                  }
                  // Generic field replacement: replace {{field_name}} with any value from stepData (lead fields, etc.)
                  if (stepConfig.message_template) {
                    stepConfig.message_template = stepConfig.message_template.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (match: string, key: string) => {
                      const value = stepData?.[key]
                      if (value === undefined || value === null) return match
                      if (typeof value === 'object') return JSON.stringify(value)
                      return String(value)
                    })
                  }
                  // Resolve chat_id - could be dynamic variable
                  let telegramChatId = stepConfig.telegram_chat_id || ''
                  if (telegramChatId === '{{chat_id}}') {
                    telegramChatId = stepData?.chat_id || stepData?.telegram_chat_id || ''
                  }
                  
                  if (!Deno.env.get('TELEGRAM_BOT_TOKEN')) {
                    throw new Error('Telegram integration not configured (missing TELEGRAM_BOT_TOKEN)')
                  }
                  if (!telegramChatId) {
                    throw new Error('Telegram chat_id is required')
                  }
                  
                  // Verify tenant has an active bot (primary OR shared shadow record)
                  const { data: tgBotState } = await supabase
                    .from('telegram_bot_state')
                    .select('id, shared_from_state_id')
                    .eq('tenant_id', tenantId)
                    .eq('is_active', true)
                    .maybeSingle()
                  
                  if (!tgBotState) {
                    throw new Error('לארגון זה אין בוט טלגרם פעיל. יש לחבר בוט בהגדרות הטלגרם או לבקש שיתוף מארגון אחר.')
                  }
                  
                  const TG_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
                  if (!TG_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not configured')
                  const telegramResponse = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: telegramChatId,
                      text: stepConfig.message_template || 'No message configured',
                      parse_mode: stepConfig.telegram_parse_mode || 'HTML',
                    }),
                  })
                  
                  const telegramData = await telegramResponse.json()
                  if (!telegramResponse.ok) {
                    throw new Error(`Telegram API failed [${telegramResponse.status}]: ${JSON.stringify(telegramData)}`)
                  }
                  
                  // Store outbound message
                  await supabase.from('telegram_messages').insert({
                    tenant_id: tenantId,
                    chat_id: parseInt(telegramChatId),
                    text: stepConfig.message_template,
                    direction: 'outbound',
                    raw_update: telegramData.result,
                  })
                  
                  stepResponse = { success: true, message_id: telegramData.result?.message_id }
                  previousStepOutput = stepResponse
                  // WHATSAPP SESSION STEP: save/update conversation history by chat_id
                  const chatId = payloadData?.chat_id || payloadData?.sender_phone || ''
                  const agentOutput = previousStepOutput?.output || ''
                  const userMsg = payloadData?.message_text || payloadData?.text || ''
                  // Use pre-built history from agent step if available
                  const pendingHistory = payloadData?._pending_session_history
                  if (chatId && (agentOutput || pendingHistory)) {
                    // Load existing session
                    const { data: existingSession } = await supabase
                      .from('whatsapp_sessions')
                      .select('id, conversation_history')
                      .eq('tenant_id', tenantId)
                      .eq('chat_id', chatId)
                      .eq('status', 'active')
                      .order('created_at', { ascending: false })
                      .limit(1)
                      .maybeSingle()
                    // Use pre-built history from agent step if available, otherwise build from scratch
                    const prevHistory: any[] = existingSession?.conversation_history || []
                    const updatedHistory = pendingHistory || [
                      ...prevHistory,
                      { role: 'user', content: userMsg, ts: new Date().toISOString() },
                      { role: 'assistant', content: agentOutput, ts: new Date().toISOString() },
                    ]
                    if (existingSession) {
                      await supabase
                        .from('whatsapp_sessions')
                        .update({ conversation_history: updatedHistory, last_message_at: new Date().toISOString() })
                        .eq('id', existingSession.id)
                    } else {
                      await supabase
                        .from('whatsapp_sessions')
                        .insert({
                          tenant_id: tenantId,
                          chat_id: chatId,
                          conversation_history: updatedHistory,
                          status: 'active',
                          last_message_at: new Date().toISOString(),
                        })
                    }
                    // Inject history into payloadData for subsequent steps in same run
                    payloadData._session_history = updatedHistory
                    stepResponse = { saved: true, turns: updatedHistory.length / 2 }
                    // IMPORTANT: do NOT overwrite previousStepOutput — keep agent output for send step
                    // previousStepOutput stays as the agent's output so send_greenapi_message uses it
                  }
                } else {
                }

                // Store output for downstream nodes
                nodeOutputs[step.id] = {
                  ...stepData,
                  ...(stepResponse && typeof stepResponse === 'object' ? stepResponse : { output: stepResponse }),
                }
                actionCount++
                stepResults.push({ step_id: step.id, action_type: effectiveActionType, success: true, response: stepResponse })
              } catch (stepErr: any) {
                console.error(`Error in flow step ${step.id}:`, stepErr)
                nodeOutputs[step.id] = { ...payloadData, _error: stepErr.message }
                stepResults.push({ step_id: step.id, action_type: step.action_type, success: false, error: stepErr.message })
                // Continue to next step even if one fails
              }
            }

            response = { 
              flow: true, 
              steps: stepResults,
              agent_output: stepResults.find(s => s.action_type === 'agent')?.response?.output || null,
            }
          } else {
            // Non-flow: execute single action as before
            if (automation.action_type === 'webhook') {
              response = await executeWebhook(automation.configuration, payloadData)
            } else if (automation.action_type === 'email') {
              response = await executeEmail(automation.configuration, payloadData)
            } else if (automation.action_type === 'notification') {
              response = await executeNotification(automation.configuration, payloadData)
            } else if (automation.action_type === 'update_status') {
              response = await executeStatusUpdate(supabase, automation.configuration, payloadData)
            } else if (automation.action_type === 'send_whatsapp') {
              response = await executeSendWhatsapp(supabase, automation.configuration, payloadData, tenantId)
            } else if (automation.action_type === 'create_manychat_subscriber') {
              response = await executeCreateManychatSubscriber(supabase, automation.configuration, payloadData, tenantId)
            } else if (automation.action_type === 'send_greenapi_message' || automation.action_type === 'send_manus_message') {
              response = await executeGreenApiMessage(supabase, automation.configuration, payloadData, tenantId)
            } else if (automation.action_type === 'send_greenapi_to_campaigner') {
              response = await executeGreenApiToCampaigner(supabase, automation.configuration, payloadData, tenantId)
            } else if (automation.action_type === 'add_lead_update') {
              response = await executeAddLeadUpdate(supabase, automation.configuration, payloadData, tenantId)
            } else if (automation.action_type === 'add_client_update') {
              response = await executeAddClientUpdate(supabase, automation.configuration, payloadData, tenantId)
            } else if (automation.action_type === 'create_task') {
              response = await executeCreateTask(supabase, automation.configuration, payloadData, tenantId)
            } else if (automation.action_type === 'create_lead') {
              response = await executeCreateLead(supabase, automation.configuration, payloadData, tenantId)
            } else if (automation.action_type === 'agent') {
              const agentConfig = automation.configuration || {}
              const agentId = agentConfig.agent_id
              if (agentId) {
                const agentUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/run-ai-agent`
                const agentRes = await fetch(agentUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                  },
                  body: JSON.stringify({
                    agent_id: agentId,
                    command_text: payloadData?.command_text || payloadData?.text || 'הפעל את האוטומציה',
                    automation_id: automation.id,
                    user_name: payloadData?.user_name || 'מערכת',
                    lead_data: {
                      lead_id: payloadData?.lead_id,
                      contact_name: payloadData?.contact_name,
                      phone: payloadData?.phone,
                      email: payloadData?.email,
                      company_name: payloadData?.company_name,
                      source: payloadData?.source,
                      notes: payloadData?.notes,
                      status: payloadData?.status,
                      pipeline_stage: payloadData?.pipeline_stage,
                      agency_name: payloadData?.agency_name,
                    },
                  }),
                })
                response = await agentRes.json()
              } else {
                response = { error: 'No agent_id configured in automation' }
              }
            }
          }

          const executionTime = Date.now() - startTime

          // Log success
          await supabase.from('automation_logs').insert({
            automation_id: automation.id,
            success: true,
            payload: payloadData,
            response: response,
            execution_time_ms: executionTime,
          })

          return { success: true, automation_id: automation.id, response }
        } catch (error) {
          const executionTime = Date.now() - startTime
          console.error(`Error executing automation ${automation.id}:`, error)
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          // Log failure
          await supabase.from('automation_logs').insert({
            automation_id: automation.id,
            success: false,
            error_message: errorMessage,
            payload: payloadData,
            execution_time_ms: executionTime,
          })

          return { success: false, automation_id: automation.id, error: errorMessage }
        }
      })
    )

    return new Response(
      JSON.stringify({
        success: true,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason }),
        executed: results.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in trigger-automation:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

// Helper function to check conditions
function checkConditions(conditions: any, data: any, triggerType?: string): boolean {
  try {
    for (const [key, value] of Object.entries(conditions)) {
      // Special handling for new_status - only relevant for status change triggers
      if (key === 'new_status') {
        if (triggerType && triggerType !== 'lead_status_changed' && triggerType !== 'task_status_changed') {
          continue;
        }
        const dataStatus = data.new_status || data.status;
        if (dataStatus !== value) {
          return false;
        }
      }
      // WhatsApp message received trigger conditions
      else if (triggerType === 'whatsapp_message_received') {
        if (key === 'source_filter') {
          // Handle source_filter logic here
          if (value === 'group' && !data.group_id) return false;
          if (value === 'all_groups' && !data.group_id) return false;
          if (value === 'all_groups_except') {
            if (!data.group_id) return false;
            const excludedIds = conditions.excluded_group_ids || [];
            if (excludedIds.length > 0 && excludedIds.includes(data.group_id)) return false;
          }
          if (value === 'multiple_groups') {
            if (!data.group_id) return false;
            const selectedIds = conditions.selected_group_ids || [];
            if (selectedIds.length > 0 && !selectedIds.includes(data.group_id)) return false;
          }
          if (value === 'private' && data.group_id) return false;
          continue;
        }
        if (key === 'selected_group_ids' || key === 'excluded_group_ids') {
          // Already handled by source_filter above
          continue;
        }
        if (key === 'group_id' && value) {
          if (data.group_id !== value) {
            return false;
          }
        }
        if (key === 'keyword' && value) {
          const keyword = String(value).toLowerCase();
          const msgText = (data.message_text || '').toLowerCase();
          if (!msgText.includes(keyword)) {
            return false;
          }
        }
        if (key === 'tag_id' && value) {
          const contactTags = data.tags || [];
          if (!contactTags.includes(value)) {
            return false;
          }
        }
        if (key === 'connection_user_id' && value) {
          if (data.connection_user_id !== value) {
            return false;
          }
        }
      }
      else if (data[key] !== value) {
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Error checking conditions:', error)
    return false;
  }
}

// Execute webhook action
async function executeWebhook(config: any, data: any) {
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.headers || {}),
  }

  // Send data as flat JSON object with individual fields
  // This makes it easy to map fields in Make.com
  const bodyData = JSON.stringify(data)


  const response = await fetch(config.url, {
    method: config.method || 'POST',
    headers: headers,
    body: bodyData,
  })

  const responseText = await response.text()
  
  return {
    status: response.status,
    statusText: response.statusText,
    body: responseText,
  }
}

// Execute email action (placeholder)
async function executeEmail(config: any, data: any) {
  return { message: 'Email action not implemented' }
}

// Execute notification action (placeholder)
async function executeNotification(config: any, data: any) {
  return { message: 'Notification action not implemented' }
}

// Execute status update action
async function executeStatusUpdate(supabase: any, config: any, data: any) {
  
  const { entity, status, update_field, update_field_value } = config
  const recordId = data.id
  
  if (!recordId) {
    throw new Error('No record ID provided for status update')
  }
  
  // Determine which table to update
  const table = entity === 'lead' ? 'leads' : 'tasks'
  
  
  // Build update object
  const updateData: any = {}
  
  // Update status only if provided (optional now)
  if (status) {
    updateData.status = status
  }
  
  // Update additional date field if specified
  if (update_field && update_field !== 'none' && update_field_value === 'today') {
    const today = new Date().toISOString().split('T')[0] // Format: YYYY-MM-DD
    updateData[update_field] = today
  }
  
  // Ensure we have something to update
  if (Object.keys(updateData).length === 0) {
    return { success: true, message: 'No updates needed' }
  }
  
  
  const { data: updateResult, error } = await supabase
    .from(table)
    .update(updateData)
    .eq('id', recordId)
    .select()
    .single()
  
  if (error) {
    console.error(`Error updating ${table}:`, error)
    throw error
  }
  
  
  return {
    success: true,
    entity: entity,
    recordId: recordId,
    updates: updateData,
    result: updateResult
  }
}

// Execute send WhatsApp action via ManyChat
async function executeSendWhatsapp(supabase: any, config: any, data: any, tenantId: string) {
  
  const { manychat_tag_id, field_mapping } = config
  
  // Get ManyChat integration settings for this tenant
  const { data: integration, error: integrationError } = await supabase
    .from('tenant_integrations')
    .select('api_key, settings')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'manychat')
    .eq('is_active', true)
    .maybeSingle()
  
  if (integrationError) {
    console.error('Error fetching ManyChat integration:', integrationError)
    throw new Error('שגיאה בטעינת הגדרות ManyChat')
  }
  
  if (!integration?.api_key) {
    throw new Error('לא נמצא חיבור ManyChat פעיל לארגון זה')
  }
  
  const apiKey = integration.api_key
  const baseUrl = 'https://api.manychat.com/fb'
  
  // Get the subscriber ID from lead or client
  let subscriberId: string | null = null
  let contactPhone: string | null = null
  let contactRecord: any = null
  let contactType: 'lead' | 'client' | null = null
  
  // Helper to check if subscriber ID is valid (not a sync conflict status)
  const isValidSubscriberId = (id: string | null | undefined): boolean => {
    if (!id) return false;
    const invalidStatuses = ['SYNC_CONFLICT', 'NEEDS_MANUAL_LINK', 'SYNC_ERROR', 'EXISTING_WA_SUBSCRIBER'];
    return !invalidStatuses.includes(id);
  };

  // ============================================
  // NEW: verifyAndFixSubscriberId - Always verify ID by phone_number custom field
  // This ensures we ALWAYS use the correct subscriber, even if saved ID is stale
  // ============================================
  const verifyAndFixSubscriberId = async (
    phone: string,
    savedId: string | null,
    type: 'lead' | 'client',
    recordId: string
  ): Promise<string | null> => {
    
    // Step 1: Get field_id for phone_number custom field
    const fieldId = await getPhoneNumberFieldIdMC(apiKey, supabase, tenantId);
    if (!fieldId) {
      // Fall back to saved ID if we can't search
      return isValidSubscriberId(savedId) ? savedId : null;
    }
    
    // Step 2: Generate phone format candidates for search
    const cleanPhone = phone.replace(/\D/g, '');
    const last9Digits = cleanPhone.slice(-9);
    const phoneCandidates = [...new Set([
      `+972${last9Digits}`,
      `972${last9Digits}`,
      `0${last9Digits}`,
      cleanPhone
    ])];
    
    // Step 3: Search for subscriber by custom field
    const foundId = await findSubscriberByCustomFieldMC(apiKey, fieldId, phoneCandidates);
    
    if (foundId) {

      // IMPORTANT:
      // If the subscriber we found via the custom field is NOT a valid WhatsApp subscriber
      // (e.g., status=deleted or whatsapp_phone is missing), we must NOT use it for tagging.
      // Otherwise the tag might be applied to an invisible/deleted contact and the user won't see it.
      // Returning null here will allow the existing fallback logic (findBySystemField + extractSubscriberId)
      // to locate an active WA subscriber.
      const foundIsWhatsApp = await validateSubscriberHasWhatsApp(foundId);
      if (!foundIsWhatsApp) {
        return null;
      }
      
      // Step 4: Compare with saved ID
      if (savedId && savedId !== foundId) {
        // Log ERROR level so it's easy to find in logs
        console.error(`🚨 ID MISMATCH ERROR: ${type} ${recordId} - Saved ID: ${savedId}, ManyChat Found ID: ${foundId}`);
        console.error(`🔧 AUTO-FIX TRIGGERED: Updating ${type} ${recordId} manychat_subscriber_id from ${savedId} to ${foundId}`);
        
        // Update the database with the correct ID
        const table = type === 'lead' ? 'leads' : 'clients';
        const { error: updateError } = await supabase
          .from(table)
          .update({ manychat_subscriber_id: foundId })
          .eq('id', recordId);
        
        if (updateError) {
          console.error(`❌ CRITICAL: Failed to fix ${type} ${recordId}:`, updateError);
          throw new Error(`ID Mismatch detected for ${type} ${recordId}: Saved=${savedId}, Found=${foundId}. Fix failed: ${updateError.message}`);
        } else {
        }
      } else if (!savedId) {
        // No saved ID - save the found one
        const table = type === 'lead' ? 'leads' : 'clients';
        await supabase
          .from(table)
          .update({ manychat_subscriber_id: foundId })
          .eq('id', recordId);
      } else {
      }
      
      return foundId;
    }
    
    // Return null to trigger fallback searches or creation
    return null;
  };

  // ManyChat sometimes returns a single object and sometimes an array.
  // Prefer subscribers with whatsapp_phone (not deleted).
  const extractSubscriberId = (result: any): string | null => {
    if (!result || result.status !== 'success' || !result.data) return null;
    const subscribers = Array.isArray(result.data) ? result.data : [result.data];
    
    // Priority 1: Active subscriber with whatsapp_phone
    const withWA = subscribers.find((s: any) => s?.status !== 'deleted' && s?.whatsapp_phone && s?.id);
    if (withWA?.id) {
      return String(withWA.id);
    }
    
    // Priority 2: Active subscriber (no WA phone but not deleted)
    const active = subscribers.find((s: any) => s?.status !== 'deleted' && s?.id);
    if (active?.id) {
      return String(active.id);
    }
    
    // Fallback: any subscriber with ID (including deleted)
    const anyWithId = subscribers.find((s: any) => s?.id);
    if (anyWithId?.id) {
      return String(anyWithId.id);
    }
    
    return null;
  };

  // Helper: Validate subscriber has whatsapp_phone (so it's the WA subscriber, not Messenger)
  const validateSubscriberHasWhatsApp = async (subId: string): Promise<boolean> => {
    try {
      const infoUrl = `${baseUrl}/subscriber/getInfo?subscriber_id=${encodeURIComponent(subId)}`
      const res = await fetch(infoUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      })
      if (!res.ok) return false
      const info = await res.json()
      const sub = info?.data
      // Valid if status != deleted AND whatsapp_phone is populated
      if (sub?.status === 'deleted') {
        return false
      }
      if (!sub?.whatsapp_phone) {
        return false
      }
      return true
    } catch (e) {
      return false
    }
  }

  // ============================================
  // NEW LOGIC: ALWAYS verify by phone_number custom field first
  // This is the "single source of truth" approach
  // ============================================
  if (data.lead_id) {
    const { data: lead } = await supabase
      .from('leads')
      .select('id, manychat_subscriber_id, contact_name, phone')
      .eq('id', data.lead_id)
      .single()
    contactRecord = lead
    contactType = 'lead'
    contactPhone = lead?.phone
    
    // NEW: If we have a phone, ALWAYS verify and potentially fix the subscriber ID
    if (contactPhone) {
      const savedId = isValidSubscriberId(lead?.manychat_subscriber_id) ? lead.manychat_subscriber_id : null;
      
      // This function searches by phone_number custom field and fixes mismatches
      const verifiedId = await verifyAndFixSubscriberId(contactPhone, savedId, 'lead', lead.id);
      if (verifiedId) {
        subscriberId = verifiedId;
      }
    }
  } else if (data.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('id, manychat_subscriber_id, contact_name, phone')
      .eq('id', data.client_id)
      .single()
    contactRecord = client
    contactType = 'client'
    contactPhone = client?.phone
    
    // NEW: If we have a phone, ALWAYS verify and potentially fix the subscriber ID
    if (contactPhone) {
      const savedId = isValidSubscriberId(client?.manychat_subscriber_id) ? client.manychat_subscriber_id : null;
      
      // This function searches by phone_number custom field and fixes mismatches
      const verifiedId = await verifyAndFixSubscriberId(contactPhone, savedId, 'client', client.id);
      if (verifiedId) {
        subscriberId = verifiedId;
      }
    }
  }

  
  // If no subscriber ID, try to find by phone number
  if (!subscriberId && contactPhone) {
    
    // Clean phone number - remove all non-digits
    const cleanPhone = contactPhone.replace(/\D/g, '')
    
    // Try multiple phone formats - without + sign first (ManyChat may not use +)
    const phoneFormats = [
      cleanPhone,                           // Full number: 972507677613
      cleanPhone.slice(-9),                 // Last 9 digits: 507677613
      '972' + cleanPhone.slice(-9),         // With country code: 972507677613
      '0' + cleanPhone.slice(-9),           // With leading 0: 0507677613
    ]
    
    // Remove duplicates
    const uniqueFormats = [...new Set(phoneFormats)]
    
    for (const phoneFormat of uniqueFormats) {
      
      // ManyChat API uses direct "phone" parameter (not field_name/field_value)
      const searchUrl = `${baseUrl}/subscriber/findBySystemField?phone=${encodeURIComponent(phoneFormat)}`
      const searchResponse = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })
      
      
      if (searchResponse.ok) {
        const searchResult = await searchResponse.json()
        
        const foundId = extractSubscriberId(searchResult);
        if (foundId) {
          subscriberId = foundId;
          
          // Update the contact record with the found subscriber ID
          if (contactType === 'lead' && contactRecord?.id) {
            await supabase
              .from('leads')
              .update({ manychat_subscriber_id: subscriberId })
              .eq('id', contactRecord.id)
          } else if (contactType === 'client' && contactRecord?.id) {
            await supabase
              .from('clients')
              .update({ manychat_subscriber_id: subscriberId })
              .eq('id', contactRecord.id)
          }
          break // Found subscriber, exit loop
        }
      } else {
        const errorText = await searchResponse.text()
      }
    }
  }

  // NOTE: wa_id and whatsapp_phone are NOT supported by ManyChat findBySystemField API
  // These queries always return 400 errors. Skipping them.
  // Only phone and email are valid system fields for findBySystemField.
  if (!subscriberId && contactPhone) {
  }

  // If still no subscriber, try Custom Field lookup (phone_number) using field_id
  if (!subscriberId && contactPhone) {
    const cleanPhone = contactPhone.replace(/\D/g, '')
    const last9Digits = cleanPhone.slice(-9)
    const customFieldCandidates = [`+972${last9Digits}`, `972${last9Digits}`, `0${last9Digits}`]

    // Get field_id (cached or from API)
    const fieldId = await getPhoneNumberFieldIdMC(apiKey, supabase, tenantId)
    if (fieldId) {
      subscriberId = await findSubscriberByCustomFieldMC(apiKey, fieldId, customFieldCandidates)
      if (subscriberId) {
        if (contactType === 'lead' && contactRecord?.id) {
          await supabase.from('leads').update({ manychat_subscriber_id: subscriberId }).eq('id', contactRecord.id)
        } else if (contactType === 'client' && contactRecord?.id) {
          await supabase.from('clients').update({ manychat_subscriber_id: subscriberId }).eq('id', contactRecord.id)
        }
      }
    } else {
    }
  }
  
  // If still no subscriber found, try to create a new one in ManyChat
  if (!subscriberId && contactPhone) {
    
    const cleanPhone = contactPhone.replace(/\D/g, '')
    // Format for WhatsApp: international format with + for whatsapp_phone
    const last9Digits = cleanPhone.slice(-9)
    const whatsappPhone = '+972' + last9Digits
    
    
    try {
      const createResponse = await fetch(`${baseUrl}/subscriber/createSubscriber`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: contactRecord?.contact_name || 'Unknown',
          whatsapp_phone: whatsappPhone,
          has_opt_in_sms: true,
          // Some ManyChat accounts deny importing email. Don't attempt it here.
          has_opt_in_email: false,
          consent_phrase: 'אני מאשר קבלת הודעות ודיוור פרסומי'
        }),
      })
      
      const createResult = await createResponse.json()
      
      if (createResult.status === 'success' && createResult.data?.id) {
        subscriberId = createResult.data.id.toString()
        
        // IMPORTANT: Save phone to custom field for future lookups
        await setPhoneCustomFieldMC(apiKey, subscriberId!, whatsappPhone)
        
        // Save the new subscriber ID to the lead/client
        if (contactType === 'lead' && contactRecord?.id) {
          await supabase.from('leads')
            .update({ manychat_subscriber_id: subscriberId })
            .eq('id', contactRecord.id)
        } else if (contactType === 'client' && contactRecord?.id) {
          await supabase.from('clients')
            .update({ manychat_subscriber_id: subscriberId })
            .eq('id', contactRecord.id)
        }
      } else {
        // If creation failed due to existing wa_id conflict
        const errStr = JSON.stringify(createResult)
        console.error('Failed to create subscriber:', createResult)

        if (errStr.includes('wa_id') || errStr.includes('WhatsApp ID already exists')) {
          
          // Mark with special status to indicate this specific scenario
          const specialStatus = 'EXISTING_WA_SUBSCRIBER'
          if (contactType === 'lead' && contactRecord?.id) {
            await supabase.from('leads')
              .update({ manychat_subscriber_id: specialStatus })
              .eq('id', contactRecord.id)
          } else if (contactType === 'client' && contactRecord?.id) {
            await supabase.from('clients')
              .update({ manychat_subscriber_id: specialStatus })
              .eq('id', contactRecord.id)
          }
          
          // Don't throw - this is a known ManyChat limitation, not an error
          // The subscriber exists but cannot be found via API
        }
      }
    } catch (createError) {
      console.error('Error creating subscriber:', createError)
    }
  }
  
  if (!subscriberId) {
    throw new Error('לא נמצא Subscriber ID של ManyChat ולא ניתן היה ליצור subscriber חדש. ודא שלליד יש מספר טלפון תקין')
  }

  const subscriberIdNum = Number(subscriberId)
  if (!Number.isFinite(subscriberIdNum)) {
    throw new Error(`Subscriber ID לא תקין (לא מספר): ${subscriberId}`)
  }
  
  // Update custom fields if mapping is provided
  const customFieldUpdates: any[] = []
  
  if (field_mapping?.date && data.meeting_date) {
    customFieldUpdates.push({
      field_id: parseInt(field_mapping.date),
      field_value: data.meeting_date
    })
  }
  
  if (field_mapping?.time && data.meeting_time) {
    customFieldUpdates.push({
      field_id: parseInt(field_mapping.time),
      field_value: data.meeting_time
    })
  }
  
  if (field_mapping?.location && data.meeting_location) {
    customFieldUpdates.push({
      field_id: parseInt(field_mapping.location),
      field_value: data.meeting_location
    })
  }
  
  if (field_mapping?.contact && data.contact_name) {
    customFieldUpdates.push({
      field_id: parseInt(field_mapping.contact),
      field_value: data.contact_name
    })
  }
  
  // Update custom fields
  if (customFieldUpdates.length > 0) {
    
    for (const fieldUpdate of customFieldUpdates) {
      const fieldResponse = await fetch(`${baseUrl}/subscriber/setCustomField`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriber_id: subscriberIdNum,
          field_id: fieldUpdate.field_id,
          field_value: fieldUpdate.field_value,
        }),
      })
      
      if (!fieldResponse.ok) {
        const errorText = await fieldResponse.text()
        console.error(`Failed to set custom field ${fieldUpdate.field_id}:`, errorText)
      }
    }
  }
  
  // Add tag to trigger ManyChat automation (instead of sending a Flow)
  if (manychat_tag_id) {
    const tagIdNum = Number.parseInt(String(manychat_tag_id).trim(), 10)
    if (!Number.isFinite(tagIdNum)) {
      throw new Error(`Tag ID לא תקין (לא מספר): ${manychat_tag_id}`)
    }

    
    const tagResponse = await fetch(`${baseUrl}/subscriber/addTag`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: subscriberIdNum,
        tag_id: tagIdNum,
      }),
    })
    
    const tagResult = await tagResponse.json()
    
    if (!tagResponse.ok) {
      throw new Error(`שגיאה בהוספת טאג ב-ManyChat: ${JSON.stringify(tagResult)}`)
    }

    // Verify (best-effort) that the tag is visible on the subscriber right after applying.
    // This helps debug cases where we tag the wrong subscriber (e.g., Messenger vs WhatsApp).
    try {
      const infoUrl = `${baseUrl}/subscriber/getInfo?subscriber_id=${encodeURIComponent(String(subscriberIdNum))}`
      const infoRes = await fetch(infoUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (infoRes.ok) {
        const info = await infoRes.json()
      } else {
        const err = await infoRes.text()
      }
    } catch (e) {
    }
    
    return {
      success: true,
      subscriber_id: subscriberId,
      fields_updated: customFieldUpdates.length,
      tag_id: manychat_tag_id,
      tag_result: tagResult
    }
  }
  
  return {
    success: true,
    subscriber_id: subscriberId,
    fields_updated: customFieldUpdates.length,
    message: 'No tag configured'
  }
}

// Execute create ManyChat subscriber action
async function executeCreateManychatSubscriber(supabase: any, config: any, data: any, tenantId: string) {
  
  const { manychat_tag_id } = config
  
  // Get ManyChat integration settings for this tenant
  const { data: integration, error: integrationError } = await supabase
    .from('tenant_integrations')
    .select('api_key, settings')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'manychat')
    .eq('is_active', true)
    .maybeSingle()
  
  if (integrationError) {
    console.error('Error fetching ManyChat integration:', integrationError)
    throw new Error('שגיאה בטעינת הגדרות ManyChat')
  }
  
  if (!integration?.api_key) {
    throw new Error('לא נמצא חיבור ManyChat פעיל לארגון זה')
  }
  
  const apiKey = integration.api_key
  const baseUrl = 'https://api.manychat.com/fb'
  
  // Get lead data
  let leadRecord: any = null
  const leadId = data.id || data.lead_id
  
  if (leadId) {
    const { data: lead } = await supabase
      .from('leads')
      .select('id, manychat_subscriber_id, contact_name, company_name, phone, email')
      .eq('id', leadId)
      .single()
    leadRecord = lead
  }
  
  if (!leadRecord) {
    throw new Error('לא נמצא ליד עם נתונים')
  }

  // Helper to check if subscriber ID is valid (not a sync conflict status)
  const isValidSubscriberId = (id: string | null | undefined): boolean => {
    if (!id) return false;
    const invalidStatuses = ['SYNC_CONFLICT', 'NEEDS_MANUAL_LINK', 'SYNC_ERROR', 'EXISTING_WA_SUBSCRIBER'];
    return !invalidStatuses.includes(id);
  };
  
  // If subscriber already exists with VALID ID, skip creation
  if (isValidSubscriberId(leadRecord.manychat_subscriber_id)) {
    
    // Still add tag if configured
    if (manychat_tag_id && manychat_tag_id !== 'none') {
      const tagResponse = await fetch(`${baseUrl}/subscriber/addTag`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriber_id: leadRecord.manychat_subscriber_id,
          tag_id: parseInt(manychat_tag_id),
        }),
      })
      const tagResult = await tagResponse.json()
    }
    
    return {
      success: true,
      subscriber_id: leadRecord.manychat_subscriber_id,
      message: 'Subscriber already exists, tag added if configured'
    }
  }

  // Log if subscriber has a conflict status
  if (leadRecord.manychat_subscriber_id) {
  }
  
  // Prepare phone number for lookup/creation
  const contactPhone = leadRecord.phone
  if (!contactPhone) {
    throw new Error('לליד אין מספר טלפון')
  }
  
  const cleanPhone = contactPhone.replace(/\D/g, '')
  const last9Digits = cleanPhone.slice(-9)
  const whatsappPhone = '+972' + last9Digits
  const waIdCandidates = [...new Set([`972${last9Digits}`, `+972${last9Digits}`])]
  const contactName = leadRecord.contact_name || leadRecord.company_name || 'Unknown'
  
  // Generate phone candidates for lookup (multi-format)
  const phoneCandidates = [
    `+972${last9Digits}`,
    `972${last9Digits}`,
    `0${last9Digits}`,
    cleanPhone,
    contactPhone.replace(/[\s\-\(\)]/g, '')
  ]
  
  // Step 1: Try to find existing subscriber by phone in ManyChat
  let subscriberId: string | null = null
  
  for (const candidate of phoneCandidates) {
    try {
      const findResponse = await fetch(
        `${baseUrl}/subscriber/findBySystemField?phone=${encodeURIComponent(candidate)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )
      const findResult = await findResponse.json()

      const foundId = extractSubscriberId(findResult)
      if (foundId) {
        subscriberId = foundId
        break
      }
    } catch (e) {
    }
  }

  // NOTE: wa_id and whatsapp_phone are NOT supported by ManyChat findBySystemField API
  // These queries always return 400 errors. Only phone and email are valid.
  // Skipping this step.
  if (!subscriberId) {
  }

  // Step 1c: Try to find by Custom Field (phone_number) using field_id
  if (!subscriberId) {
    
    // Get field_id (cached or from API)
    const fieldId = await getPhoneNumberFieldIdMC(apiKey, supabase, tenantId)
    if (fieldId) {
      subscriberId = await findSubscriberByCustomFieldMC(apiKey, fieldId, phoneCandidates)
      if (subscriberId) {
      }
    } else {
    }
  }
  
  // Step 2: If found, update lead and add tag
  if (subscriberId) {
    await supabase.from('leads')
      .update({ manychat_subscriber_id: subscriberId })
      .eq('id', leadRecord.id)
    
    if (manychat_tag_id && manychat_tag_id !== 'none') {
      const tagResponse = await fetch(`${baseUrl}/subscriber/addTag`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriber_id: subscriberId,
          tag_id: parseInt(manychat_tag_id),
        }),
      })
      const tagResult = await tagResponse.json()
    }
    
    return {
      success: true,
      subscriber_id: subscriberId,
      message: 'Found existing subscriber in ManyChat, linked to lead'
    }
  }
  
  // Step 3: Create new subscriber (only if not found)

  const createBodyBase: any = {
    first_name: contactName,
    // NOTE: some ManyChat accounts deny importing phone to system field.
    // Keep whatsapp_phone; phone will be added only if allowed.
    whatsapp_phone: whatsappPhone,
    has_opt_in_sms: true,
    // Some ManyChat accounts deny importing email. We don't import it on create.
    has_opt_in_email: false,
    consent_phrase: 'אני מאשר קבלת הודעות ודיוור פרסומי'
  }

  const createBodyWithPhone = {
    ...createBodyBase,
    phone: whatsappPhone,
  }

  let createResponse = await fetch(`${baseUrl}/subscriber/createSubscriber`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createBodyWithPhone),
  })

  let createResult = await createResponse.json()

  // If ManyChat denies importing phone, retry without "phone" field
  const createResultStr = JSON.stringify(createResult)
  if (
    (createResultStr.includes('Permission denied to import phone') || createResultStr.includes('Permission denied')) &&
    (createResultStr.includes('phone') || createResultStr.includes('warning'))
  ) {
    createResponse = await fetch(`${baseUrl}/subscriber/createSubscriber`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...createBodyBase,
      }),
    })
    createResult = await createResponse.json()
  }
  
  if (createResult.status !== 'success' || !createResult.data?.id) {
    // If creation failed, check if it's the "WhatsApp ID already exists" case
    const createResultStr = JSON.stringify(createResult)

    if (createResultStr.includes('wa_id') || createResultStr.includes('WhatsApp ID already exists')) {
      
      // Mark with special status to indicate this specific scenario
      const specialStatus = 'EXISTING_WA_SUBSCRIBER'
      await supabase.from('leads')
        .update({ manychat_subscriber_id: specialStatus })
        .eq('id', leadRecord.id)
      
      return {
        success: false,
        subscriber_id: null,
        status: specialStatus,
        message: 'המנוי קיים ב-ManyChat אך נוצר דרך וואטסאפ ללא שדה טלפון. יש ליצור Flow ב-ManyChat שמעתיק את whatsapp_phone לשדה phone_number'
      }
    }

    // Try one more lookup by phone (not wa_id/whatsapp_phone - those don't work)
    for (const candidate of phoneCandidates) {
      try {
        const retryFind = await fetch(
          `${baseUrl}/subscriber/findBySystemField?phone=${encodeURIComponent(candidate)}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        )
        const retryResult = await retryFind.json()
        const foundId = extractSubscriberId(retryResult)
        if (foundId) {
          subscriberId = foundId
          
          await supabase.from('leads')
            .update({ manychat_subscriber_id: subscriberId })
            .eq('id', leadRecord.id)
          
          if (manychat_tag_id && manychat_tag_id !== 'none') {
            await fetch(`${baseUrl}/subscriber/addTag`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                subscriber_id: subscriberId,
                tag_id: parseInt(manychat_tag_id),
              }),
            })
          }
          
          return {
            success: true,
            subscriber_id: subscriberId,
            message: 'Found existing subscriber on retry, linked to lead'
          }
        }
      } catch (e) {
        // Continue to next candidate
      }
    }
    
    // Mark as NEEDS_MANUAL_LINK for other failure types
    await supabase.from('leads')
      .update({ manychat_subscriber_id: 'NEEDS_MANUAL_LINK' })
      .eq('id', leadRecord.id)
    
    throw new Error(`שגיאה ביצירת subscriber ב-ManyChat: ${JSON.stringify(createResult)}`)
  }
  
  subscriberId = createResult.data.id.toString()
  
  // IMPORTANT: Save phone to custom field for future lookups
  await setPhoneCustomFieldMC(apiKey, subscriberId!, whatsappPhone)
  
  // Save subscriber ID to lead
  await supabase.from('leads')
    .update({ manychat_subscriber_id: subscriberId })
    .eq('id', leadRecord.id)
  
  // Add tag if configured
  if (manychat_tag_id && manychat_tag_id !== 'none') {
    const tagResponse = await fetch(`${baseUrl}/subscriber/addTag`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: subscriberId,
        tag_id: parseInt(manychat_tag_id),
      }),
    })
    const tagResult = await tagResponse.json()
    
    return {
      success: true,
      subscriber_id: subscriberId,
      tag_id: manychat_tag_id,
      tag_result: tagResult,
      message: 'Subscriber created and tag added'
    }
  }
  
  return {
    success: true,
    subscriber_id: subscriberId,
    message: 'Subscriber created successfully'
  }
}

// Helper function to replace template variables
function replaceTemplateVariables(template: string, data: any, tenantSlug?: string): string {
  // Current date/time info
  const now = new Date()
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const dayOfWeek = days[now.getDay()]
  const formattedDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`
  const formattedTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  
  // Format due_date if provided
  let formattedDueDate = ''
  if (data.due_date) {
    const dueDate = new Date(data.due_date)
    formattedDueDate = `${dueDate.getDate().toString().padStart(2, '0')}.${(dueDate.getMonth() + 1).toString().padStart(2, '0')}.${dueDate.getFullYear()}`
  }
  
  // Priority translation
  const priorityMap: Record<string, string> = {
    'high': 'גבוהה',
    'medium': 'בינונית', 
    'low': 'נמוכה'
  }
  const priorityValue = data.priority?.toString() || ''
  const formattedPriority = priorityMap[priorityValue.toLowerCase()] || priorityValue
  
  // Base URL for links - use actual production URL
  const appUrl = Deno.env.get('APP_URL') || 'https://aios.co.il'
  const baseUrl = tenantSlug 
    ? `${appUrl}/t/${tenantSlug}` 
    : appUrl
  
  const variables: Record<string, string> = {
    // Contact info
    contact_name: data.contact_name || '',
    company_name: data.company_name || data.name || '',
    phone: data.phone || '',
    email: data.email || '',
    status: data.status || data.new_status || '',
    old_status: data.old_status || '',
    new_status: data.new_status || data.status || '',
    // Date/time
    date: formattedDate,
    time: formattedTime,
    day_of_week: dayOfWeek,
    // Task info
    task_title: data.task_title || '',
    task_status: data.task_status || '',
    client_name: data.client_name || '',
    campaigner_name: data.campaigner_name || '',
    agency_name: data.agency_name || '',
    priority: formattedPriority,
    due_date: formattedDueDate,
    // Link variables
    tasks_link: `${baseUrl}/tasks`,
    leads_link: `${baseUrl}/leads`,
    clients_link: `${baseUrl}/clients`,
    // Chat/message variables
    message_text: data.message_text || '',
    sender_name: data.contact_name || data.sender_name || '',
    sender_phone: data.sender_phone || '',
    group_name: data.group_name || '',
    group_invite_link: data.group_invite_link || '',
  }
  
  const stringifyVariable = (value: unknown): string => {
    if (value === undefined || value === null) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    try { return JSON.stringify(value) } catch { return String(value) }
  }

  const registerVariable = (key: string, value: unknown, override = false) => {
    if (!key || value === undefined || value === null) return
    const textValue = stringifyVariable(value)
    if (override || !(key in variables)) variables[key] = textValue

    // Register common spacing variants so {{fb_phone_number}}, {{fb phone number}}
    // and {{fb_phone number}} can all resolve to the same value.
    const underscore = key.replace(/\s+/g, '_')
    if (!(underscore in variables)) variables[underscore] = textValue
    const spaced = key.replace(/_/g, ' ')
    if (!(spaced in variables)) variables[spaced] = textValue
  }

  // Add all primitive dynamic fields from data, including fb_ fields from Facebook.
  for (const [key, value] of Object.entries(data || {})) {
    if (['string', 'number', 'boolean'].includes(typeof value)) {
      registerVariable(key, value)
    }
  }

  // Backward-compatible aliases for older Facebook templates that used Hebrew labels
  // instead of the real Facebook field keys (for example {{fb_שם_מלא}}).
  const fbFullName = data?.fb_full_name || data?.fb_name || data?.['fb_full name'] || data?.contact_name || data?.company_name
  const fbPhone = data?.fb_phone_number || data?.fb_phone || data?.['fb_phone number'] || data?.phone || data?.sender_phone
  const fbEmail = data?.fb_email || data?.email
  registerVariable('fb_שם_מלא', fbFullName)
  registerVariable('fb_שם מלא', fbFullName)
  registerVariable('fb_שם', fbFullName)
  registerVariable('fb_מספר_טלפון', fbPhone)
  registerVariable('fb_מספר טלפון', fbPhone)
  registerVariable('fb_טלפון', fbPhone)
  registerVariable('fb_אימייל', fbEmail)
  registerVariable('fb_מייל', fbEmail)

  const normalizeTemplateKey = (key: string) =>
    key.trim().toLowerCase().replace(/[\s_\-־״"'`.,:;!?؟،()[\]{}<>/\\|]+/g, '')
  const normalizedVariables = new Map<string, string>()
  for (const [key, value] of Object.entries(variables)) {
    normalizedVariables.set(normalizeTemplateKey(key), value)
  }

  return template.replace(/\{\{([^}]+)\}\}/g, (match: string, rawKey: string) => {
    const key = rawKey.trim()
    if (variables[key] !== undefined) return variables[key]
    const normalizedValue = normalizedVariables.get(normalizeTemplateKey(key))
    if (normalizedValue !== undefined) return normalizedValue
    return match
  })
}

// ---------- Multi-recipient helpers ----------
function phoneToChatId(phone: string): string {
  const clean = String(phone).replace(/\D/g, '')
  const last9 = clean.slice(-9)
  return `972${last9}@c.us`
}

function normalizeGroupId(raw: string): string {
  const v = String(raw).trim()
  return v.includes('@g.us') ? v : `${v}@g.us`
}

async function resolveRecipientsToChatIds(
  supabase: any,
  recipients: any[],
  data: any,
  tenantId: string,
): Promise<string[]> {
  const out: string[] = []
  for (const r of recipients) {
    try {
      if (!r || typeof r !== 'object') continue
      switch (r.type) {
        case 'phone_field': {
          const v = r.field ? data?.[r.field] : null
          if (v) {
            const s = String(v).trim()
            const keyLower = String(r.field).toLowerCase()
            const isGroup = data?.contact_type === 'group' || keyLower.includes('group') || s.includes('@g.us')
            out.push(isGroup ? normalizeGroupId(s) : phoneToChatId(s))
          }
          break
        }
        case 'phone_manual': {
          if (r.phone) {
            out.push(r.phone.includes('@g.us') ? r.phone : phoneToChatId(r.phone))
          }
          break
        }
        case 'group_field': {
          const fieldKey = r.field || 'group_chat_id'
          const raw = data?.[fieldKey]
          const v = data?.contact_type === 'group' && data?.group_chat_id &&
            (fieldKey === 'group_id' || !raw || !String(raw).includes('@g.us'))
            ? data.group_chat_id
            : raw
          if (v) out.push(normalizeGroupId(v))
          break
        }
        case 'group_manual': {
          if (r.group_id) out.push(normalizeGroupId(r.group_id))
          break
        }
        case 'contact_lookup': {
          if (!r.id) break
          const table = r.entity === 'client' ? 'clients' : 'leads'
          const { data: row } = await supabase
            .from(table).select('phone').eq('id', r.id).eq('tenant_id', tenantId).maybeSingle()
          if (row?.phone) out.push(phoneToChatId(row.phone))
          break
        }
        case 'group_lookup': {
          if (r.group_id) out.push(normalizeGroupId(r.group_id))
          break
        }
      }
    } catch (e) {
      console.error('[recipients] resolve error', r, e)
    }
  }
  // Dedupe
  return Array.from(new Set(out))
}

async function resolveWaIntegration(supabase: any, config: any, tenantId: string) {
  const integration_id = config.integration_id || config.green_api_integration_id
  let providerType: 'green_api' | 'manus_wa' = 'green_api'
  let integration: any = null
  let idInstance = ''
  let apiTokenInstance = ''

  if (config.green_api_mode === 'external' && config.external_instance_id && config.external_api_token) {
    return { idInstance: config.external_instance_id, apiTokenInstance: config.external_api_token, providerType: 'green_api' as const }
  }

  if (integration_id) {
    const { data: row } = await supabase
      .from('tenant_integrations')
      .select('id, api_key, settings, user_id, integration_type, instance_id')
      .eq('id', integration_id).eq('is_active', true).maybeSingle()
    if (row) {
      integration = row
      if (row.integration_type === 'manus_wa') providerType = 'manus_wa'
    }
  }
  if (!integration) {
    const { data: row } = await supabase
      .from('tenant_integrations')
      .select('id, api_key, settings, user_id, integration_type, instance_id')
      .eq('tenant_id', tenantId).eq('integration_type', 'green_api').eq('is_active', true).limit(1).maybeSingle()
    if (!row) throw new Error('לא נמצא חיבור WhatsApp פעיל')
    integration = row
  }
  if (providerType === 'manus_wa') {
    idInstance = integration.settings?.instance_id || integration.instance_id
    apiTokenInstance = integration.api_key
    if (!idInstance || !apiTokenInstance) throw new Error('הגדרות Manus WhatsApp חסרות')
  } else {
    idInstance = integration.settings?.idInstance || integration.settings?.instance_id || integration.instance_id
    apiTokenInstance = integration.settings?.apiTokenInstance || integration.api_key
    if (!idInstance || !apiTokenInstance) throw new Error('הגדרות Green API חסרות')
  }
  return { idInstance, apiTokenInstance, providerType }
}

async function sendWaMessage(opts: {
  providerType: 'green_api' | 'manus_wa',
  idInstance: string,
  apiTokenInstance: string,
  chatId: string,
  message: string,
  config: any,
  data: any,
  tenantSlug?: string,
}) {
  const { providerType, idInstance, apiTokenInstance, chatId, message, config, data, tenantSlug } = opts
  const mediaType = config.media_type
  const mediaUrl = config.media_url

  if (providerType === 'manus_wa') {
    const isGroup = chatId.includes('@g.us')
    const manusRecipient = isGroup ? chatId : chatId.replace(/[^0-9]/g, '')
    const manusBase = 'https://whatsappgw-pzpyrrww.manus.space'
    const endpoint = isGroup ? 'send/group' : 'send/text'
    const payload: Record<string, unknown> = isGroup
      ? { groupId: manusRecipient, body: message }
      : { to: manusRecipient, body: message }
    const r = await fetch(`${manusBase}/api/v1/instances/${idInstance}/${endpoint}`, {
      method: 'POST', headers: { 'X-Api-Key': apiTokenInstance, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j?.success === false) throw new Error(`Manus error: ${JSON.stringify(j)}`)
    return j
  } else {
    const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message, linkPreview: mediaType === 'link' }),
    })
    const j = await r.json()
    if (!r.ok) throw new Error(`Green API error: ${JSON.stringify(j)}`)

    if (mediaUrl && mediaType === 'file') {
      const resolvedMediaUrl = replaceTemplateVariables(mediaUrl, { ...data }, tenantSlug)
      const fileName = config.media_filename || resolvedMediaUrl.split('/').pop()?.split('?')[0] || 'file'
      const fileUrl = `https://api.green-api.com/waInstance${idInstance}/sendFileByUrl/${apiTokenInstance}`
      await fetch(fileUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, urlFile: resolvedMediaUrl, fileName, caption: message }),
      })
    }
    return j
  }
}

// Execute Green API message action

async function executeGreenApiMessage(supabase: any, config: any, data: any, tenantId: string) {
  
  const { message_template, send_to_type, manual_phone, manual_group_id, phone_mode, green_api_mode, external_instance_id, external_api_token, phone_field, group_id_field } = config
  const integration_id = config.integration_id || config.green_api_integration_id
  
  if (!message_template) {
    throw new Error('תבנית הודעה לא הוגדרה')
  }
  
  // Get tenant slug for links
  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug')
    .eq('id', tenantId)
    .single()
  const tenantSlug = tenant?.slug
  
  // NEW: Multi-recipient support (recipients[] array)
  if (Array.isArray(config.recipients) && config.recipients.length > 0) {
    const chatIds = await resolveRecipientsToChatIds(supabase, config.recipients, data, tenantId)
    if (chatIds.length === 0) {
      throw new Error('לא נמצאו יעדים תקפים לשליחה')
    }

    // Resolve integration once
    const { idInstance, apiTokenInstance, providerType } = await resolveWaIntegration(supabase, config, tenantId)

    // Build message once (using available data; no per-recipient contactRecord override)
    let message = replaceTemplateVariables(message_template, { ...data }, tenantSlug)
    if (config.media_type === 'link' && config.media_url) {
      const resolvedLink = replaceTemplateVariables(config.media_url, { ...data }, tenantSlug)
      message = `${message}\n\n${resolvedLink}`
    }

    const results: any[] = []
    for (const chatId of chatIds) {
      try {
        const r = await sendWaMessage({
          providerType, idInstance, apiTokenInstance, chatId, message, config, data, tenantSlug,
        })
        results.push({ chatId, status: 'sent', result: r })
      } catch (e) {
        results.push({ chatId, status: 'failed', error: e instanceof Error ? e.message : String(e) })
      }
    }
    const sentCount = results.filter(r => r.status === 'sent').length
    if (sentCount === 0) {
      throw new Error(`כל ${chatIds.length} היעדים נכשלו: ${JSON.stringify(results)}`)
    }
    return {
      success: true,
      message_sent: message,
      recipients_count: chatIds.length,
      sent_count: sentCount,
      results,
    }
  }

  // Determine chatId based on phone_mode or legacy send_to_type

  let chatId: string
  let contactRecord: any = null
  
  if (phone_mode === "group_manual" && manual_group_id) {
    // Send to a fixed group id (configured manually)
    chatId = manual_group_id.includes("@g.us") ? manual_group_id : `${manual_group_id}@g.us`
  } else if (phone_mode === "group_field") {
    // Send to a group whose chat id is taken from the trigger payload
    const fieldKey = group_id_field || "group_id"
    const rawFieldValue = data?.[fieldKey]
    const fieldValue =
      data?.contact_type === 'group' && data?.group_chat_id &&
      (fieldKey === 'group_id' || !rawFieldValue || !String(rawFieldValue).includes('@g.us'))
        ? data.group_chat_id
        : rawFieldValue
    if (!fieldValue) {
      throw new Error(`לא נמצא מזהה קבוצה בשדה ${fieldKey}`)
    }
    const v = String(fieldValue).trim()
    chatId = v.includes("@g.us") ? v : `${v}@g.us`
  } else if (phone_mode === "manual" && manual_phone) {
    // New: manual phone mode from flow editor
    // Check if it's a group chat ID (contains @g.us)
    if (manual_phone.includes('@g.us')) {
      chatId = manual_phone
    } else {
      const cleanPhone = manual_phone.replace(/\D/g, '')
      const last9 = cleanPhone.slice(-9)
      chatId = `972${last9}@c.us`
    }
  } else if (send_to_type === "manual_group" && manual_group_id) {
    // Send to manual group
    chatId = manual_group_id.includes("@g.us") ? manual_group_id : `${manual_group_id}@g.us`
  } else if (send_to_type === "manual_phone" && manual_phone) {
    // Legacy: Send to manual phone number
    const cleanPhone = manual_phone.replace(/\D/g, '')
    const last9 = cleanPhone.slice(-9)
    chatId = `972${last9}@c.us`
  } else if ((phone_mode === "field" || (!phone_mode && phone_field)) && phone_field && data?.[phone_field]) {
    // Dynamic field mode - resolve destination from data field (supports both phone and group chat id)
    const fieldValue = String(data[phone_field]).trim()
    const fieldKey = String(phone_field).toLowerCase()
    const shouldTreatAsGroup =
      data?.contact_type === 'group' ||
      fieldKey.includes('group') ||
      fieldValue.includes('@g.us')

    if (shouldTreatAsGroup) {
      chatId = fieldValue.includes('@g.us') ? fieldValue : `${fieldValue}@g.us`
    } else {
      const cleanPhone = fieldValue.replace(/\D/g, '')
      const last9 = cleanPhone.slice(-9)
      chatId = `972${last9}@c.us`
    }
  } else {
    // Default: send to contact (lead/client)
    let contactPhone: string | null = null
    
    if (data.lead_id || data.id) {
      const leadId = data.lead_id || data.id
      const { data: lead } = await supabase
        .from('leads')
        .select('id, phone, contact_name, company_name')
        .eq('id', leadId)
        .single()
      contactRecord = lead
      contactPhone = lead?.phone
    } else if (data.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('id, phone, contact_name, name')
        .eq('id', data.client_id)
        .single()
      contactRecord = client
      contactPhone = client?.phone
    }
    
    // Fallback: use phone directly from data (manual test / webhook)
    if (!contactPhone && data.phone) {
      contactPhone = data.phone
    }
    
    if (!contactPhone) {
      throw new Error('לא נמצא מספר טלפון לשליחה')
    }
    
    // Format phone for Green API
    const cleanPhone = contactPhone.replace(/\D/g, '')
    const last9 = cleanPhone.slice(-9)
    chatId = `972${last9}@c.us`
  }
  
  // Find Green API / Manus WA integration - use specified ID or fall back to first active
  let idInstance: string
  let apiTokenInstance: string
  let integration: any = null
  let providerType: 'green_api' | 'manus_wa' = 'green_api'
  
  if (green_api_mode === "external" && external_instance_id && external_api_token) {
    // External mode: use manually provided credentials (Green API only)
    idInstance = external_instance_id
    apiTokenInstance = external_api_token
  } else {
    // Tenant mode: look up from tenant_integrations
    if (integration_id) {
      const { data: specificIntegration, error } = await supabase
        .from('tenant_integrations')
        .select('id, api_key, settings, user_id, integration_type, instance_id')
        .eq('id', integration_id)
        .eq('is_active', true)
        .maybeSingle()
      
      if (!error && specificIntegration) {
        integration = specificIntegration
        if (specificIntegration.integration_type === 'manus_wa') providerType = 'manus_wa'
      }
    }
    
    // Fallback to first active Green API integration
    if (!integration) {
      const { data: fallbackIntegration, error: integrationError } = await supabase
        .from('tenant_integrations')
        .select('id, api_key, settings, user_id, integration_type, instance_id')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'green_api')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      
      if (integrationError || !fallbackIntegration) {
        throw new Error('לא נמצא חיבור WhatsApp פעיל')
      }
      integration = fallbackIntegration
    }
    
    if (providerType === 'manus_wa') {
      idInstance = integration.settings?.instance_id || integration.instance_id
      apiTokenInstance = integration.api_key
      if (!idInstance || !apiTokenInstance) {
        throw new Error('הגדרות Manus WhatsApp חסרות')
      }
    } else {
      // Support both naming conventions
      idInstance = integration.settings?.idInstance || integration.settings?.instance_id || integration.instance_id
      apiTokenInstance = integration.settings?.apiTokenInstance || integration.api_key
      if (!idInstance || !apiTokenInstance) {
        throw new Error('הגדרות Green API חסרות')
      }
    }
  }
  
  // Replace template variables
  let message = replaceTemplateVariables(message_template, {
    ...data,
    ...contactRecord,
  }, tenantSlug)

  // If media_type is "link", append the URL to the message text for WhatsApp link preview
  if (config.media_type === 'link' && config.media_url) {
    const resolvedLink = replaceTemplateVariables(config.media_url, {
      ...data,
      ...contactRecord,
    }, tenantSlug)
    message = `${message}\n\n${resolvedLink}`
  }
  
  // Send message via Green API OR Manus WhatsApp
  let sendResult: any
  let mediaResult = null
  const mediaType = config.media_type
  const mediaUrl = config.media_url

  if (providerType === 'manus_wa') {
    const isGroup = chatId.includes('@g.us')
    const manusRecipient = isGroup
      ? chatId
      : chatId.replace(/[^0-9]/g, '')
    const manusBase = 'https://whatsappgw-pzpyrrww.manus.space'
    const endpoint = isGroup ? 'send/group' : 'send/text'
    const payload: Record<string, unknown> = isGroup
      ? { groupId: manusRecipient, body: message }
      : { to: manusRecipient, body: message }
    const sendResponse = await fetch(`${manusBase}/api/v1/instances/${idInstance}/${endpoint}`, {
      method: 'POST',
      headers: { 'X-Api-Key': apiTokenInstance, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    sendResult = await sendResponse.json().catch(() => ({}))
    if (!sendResponse.ok || sendResult?.success === false) {
      throw new Error(`שגיאה בשליחת הודעה (Manus): ${JSON.stringify(sendResult)}`)
    }

    if (mediaUrl && (mediaType === 'file' || mediaType === 'image')) {
      const resolvedMediaUrl = replaceTemplateVariables(mediaUrl, { ...data, ...contactRecord }, tenantSlug)
      const isImage = mediaType === 'image'
      const endpoint = isImage ? 'send/image' : 'send/file'
      const payload: Record<string, unknown> = { to: manusRecipient, caption: message }
      if (isImage) payload.imageUrl = resolvedMediaUrl
      else { payload.fileUrl = resolvedMediaUrl; payload.mimeType = config.media_mime_type || 'application/octet-stream'; payload.filename = config.media_filename || resolvedMediaUrl.split('/').pop()?.split('?')[0] || 'file' }
      const mr = await fetch(`${manusBase}/api/v1/instances/${idInstance}/${endpoint}`, {
        method: 'POST',
        headers: { 'X-Api-Key': apiTokenInstance, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      mediaResult = await mr.json().catch(() => ({}))
    }
  } else {
    const greenApiUrl = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`
    const sendResponse = await fetch(greenApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message, linkPreview: config.media_type === 'link' }),
    })
    sendResult = await sendResponse.json()
    if (!sendResponse.ok) {
      throw new Error(`שגיאה בשליחת הודעה: ${JSON.stringify(sendResult)}`)
    }

    if (mediaUrl && mediaType === 'file') {
      const resolvedMediaUrl = replaceTemplateVariables(mediaUrl, { ...data, ...contactRecord }, tenantSlug)
      const fileName = config.media_filename || resolvedMediaUrl.split('/').pop()?.split('?')[0] || 'file'
      const fileApiUrl = `https://api.green-api.com/waInstance${idInstance}/sendFileByUrl/${apiTokenInstance}`
      const fileResponse = await fetch(fileApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, urlFile: resolvedMediaUrl, fileName, caption: message }),
      })
      mediaResult = await fileResponse.json()
    }
  }

  
  return {
    success: true,
    message_sent: message,
    chat_id: chatId,
    result: sendResult,
    media_result: mediaResult,
  }
}

// Execute Green API message to campaigner action
async function executeGreenApiToCampaigner(supabase: any, config: any, data: any, tenantId: string) {
  
  const { message_template, send_target, integration_id } = config
  
  if (!message_template) {
    throw new Error('תבנית הודעה לא הוגדרה')
  }
  
  // Get tenant slug for links
  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug')
    .eq('id', tenantId)
    .single()
  const tenantSlug = tenant?.slug
  
  // Get campaigner data from the trigger data
  let campaignerPhone = data.campaigner_phone
  let campaignerGroupId = data.campaigner_whatsapp_group_id
  let campaignerId = data.campaigner_id
  
  // If no data from trigger, try to fetch from database
  if (campaignerId && (!campaignerPhone || !campaignerGroupId)) {
    const { data: campaigner } = await supabase
      .from('campaigners')
      .select('phone, whatsapp_group_id, full_name')
      .eq('id', campaignerId)
      .single()
    
    if (campaigner) {
      campaignerPhone = campaigner.phone || campaignerPhone
      campaignerGroupId = campaigner.whatsapp_group_id || campaignerGroupId
    }
  }
  
  // Determine chat ID based on send target
  let chatId: string | null = null
  
  if (send_target === 'group' && campaignerGroupId) {
    chatId = campaignerGroupId.includes('@g.us') ? campaignerGroupId : `${campaignerGroupId}@g.us`
  } else if (campaignerPhone) {
    const cleanPhone = campaignerPhone.replace(/\D/g, '')
    const last9 = cleanPhone.slice(-9)
    chatId = `972${last9}@c.us`
  }
  
  if (!chatId) {
    if (send_target === 'group') {
      throw new Error('לא נמצא מזהה קבוצת WhatsApp לקמפיינר. יש להגדיר מזהה קבוצה בכרטיס הקמפיינר')
    }
    throw new Error('לא נמצא מספר טלפון לקמפיינר')
  }
  
  // Find Green API / Manus WA integration - use specified ID or fall back to first active
  let integration: any = null
  let providerType: 'green_api' | 'manus_wa' = 'green_api'
  
  if (integration_id) {
    const { data: specificIntegration, error } = await supabase
      .from('tenant_integrations')
      .select('id, api_key, settings, user_id, integration_type, instance_id')
      .eq('id', integration_id)
      .eq('is_active', true)
      .maybeSingle()
    
    if (!error && specificIntegration) {
      integration = specificIntegration
      if (specificIntegration.integration_type === 'manus_wa') providerType = 'manus_wa'
    }
  }
  
  // Fallback to first active Green API integration
  if (!integration) {
    const { data: fallbackIntegration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('id, api_key, settings, user_id, integration_type, instance_id')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'green_api')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    
    if (integrationError || !fallbackIntegration) {
      throw new Error('לא נמצא חיבור WhatsApp פעיל')
    }
    integration = fallbackIntegration
  }
  
  let idInstance: string
  let apiTokenInstance: string
  if (providerType === 'manus_wa') {
    idInstance = integration.settings?.instance_id || integration.instance_id
    apiTokenInstance = integration.api_key
    if (!idInstance || !apiTokenInstance) {
      throw new Error('הגדרות Manus WhatsApp חסרות')
    }
  } else {
    idInstance = integration.settings?.idInstance || integration.settings?.instance_id || integration.instance_id
    apiTokenInstance = integration.settings?.apiTokenInstance || integration.api_key
    if (!idInstance || !apiTokenInstance) {
      throw new Error('הגדרות Green API חסרות')
    }
  }
  
  // Replace template variables
  const message = replaceTemplateVariables(message_template, data, tenantSlug)
  
  let sendResult: any
  if (providerType === 'manus_wa') {
    const isGroup = chatId.includes('@g.us')
    const manusBase = 'https://whatsappgw-pzpyrrww.manus.space'
    const endpoint = isGroup ? 'send/group' : 'send/text'
    const payload: Record<string, unknown> = isGroup
      ? { groupId: chatId, body: message }
      : { to: chatId.replace(/[^0-9]/g, ''), body: message }
    const sendResponse = await fetch(`${manusBase}/api/v1/instances/${idInstance}/${endpoint}`, {
      method: 'POST',
      headers: { 'X-Api-Key': apiTokenInstance, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    sendResult = await sendResponse.json().catch(() => ({}))
    if (!sendResponse.ok || sendResult?.success === false) {
      throw new Error(`שגיאה בשליחת הודעה (Manus): ${JSON.stringify(sendResult)}`)
    }
  } else {
    const greenApiUrl = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`
    const sendResponse = await fetch(greenApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
    })
    sendResult = await sendResponse.json()
    if (!sendResponse.ok) {
      throw new Error(`שגיאה בשליחת הודעה: ${JSON.stringify(sendResult)}`)
    }
  }
  
  // Save message to chat_messages for chat history
  try {
    // Determine lead_id or client_id from the chatId (phone number)
    const phoneFromChat = chatId.replace('@c.us', '').replace('@g.us', '')
    const last9Digits = phoneFromChat.slice(-9)
    
    // Try to find matching lead or client by phone
    let leadId = null
    let clientId = null
    
    const { data: matchingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('phone', `%${last9Digits}`)
      .limit(1)
      .maybeSingle()
    
    if (matchingLead) {
      leadId = matchingLead.id
    } else {
      const { data: matchingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('phone', `%${last9Digits}`)
        .limit(1)
        .maybeSingle()
      
      if (matchingClient) {
        clientId = matchingClient.id
      }
    }
    
    // Save to chat_messages
    const { error: chatError } = await supabase
      .from('chat_messages')
      .insert({
        tenant_id: tenantId,
        connection_user_id: integration.user_id,
        lead_id: leadId,
        client_id: clientId,
        sender_phone: phoneFromChat,
        message_text: message,
        direction: 'outbound',
        channel: 'whatsapp',
        provider: 'green_api',
        raw_provider_data: { automation: true, send_target, sendResult },
      })
    
    if (chatError) {
      console.error('Error saving message to chat_messages:', chatError)
    } else {
    }
  } catch (saveError) {
    console.error('Error saving to chat_messages:', saveError)
    // Don't throw - message was sent successfully, just logging failed
  }
  
  return {
    success: true,
    message_sent: message,
    chat_id: chatId,
    send_target: send_target,
    result: sendResult,
  }
}

// Execute add lead update action
async function executeAddLeadUpdate(supabase: any, config: any, data: any, tenantId: string) {
  
  const { update_template } = config
  
  if (!update_template) {
    throw new Error('תבנית עדכון לא הוגדרה')
  }
  
  // Get tenant slug for links
  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug')
    .eq('id', tenantId)
    .single()
  const tenantSlug = tenant?.slug
  
  const leadId = data.lead_id || data.id
  
  if (!leadId) {
    throw new Error('לא נמצא ליד לעדכון')
  }
  
  // Get lead data for template
  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single()
  
  if (!lead) {
    throw new Error('ליד לא נמצא')
  }
  
  // Replace template variables
  const updateContent = replaceTemplateVariables(update_template, {
    ...data,
    ...lead,
  }, tenantSlug)
  
  // Get a system user ID for the update (we'll use the first owner in the tenant)
  const { data: ownerRole } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle()
  
  const userId = ownerRole?.user_id || data.user_id
  
  if (!userId) {
    throw new Error('לא נמצא משתמש לשמירת העדכון')
  }
  
  // Insert update into lead_updates table
  const { data: insertedUpdate, error: insertError } = await supabase
    .from('lead_updates')
    .insert({
      lead_id: leadId,
      user_id: userId,
      content: updateContent,
    })
    .select()
    .single()
  
  if (insertError) {
    console.error('Error inserting lead update:', insertError)
    throw new Error(`שגיאה בשמירת עדכון: ${insertError.message}`)
  }
  
  
  return {
    success: true,
    update_id: insertedUpdate.id,
    content: updateContent,
  }
}

// Execute add client update action
async function executeAddClientUpdate(supabase: any, config: any, data: any, tenantId: string) {
  
  const { update_template } = config
  
  if (!update_template) {
    throw new Error('תבנית עדכון לא הוגדרה')
  }
  
  // Get tenant slug for links
  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug')
    .eq('id', tenantId)
    .single()
  const tenantSlug = tenant?.slug
  
  const clientId = data.client_id
  
  if (!clientId) {
    throw new Error('לא נמצא לקוח לעדכון')
  }
  
  // Get client data for template
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()
  
  if (!client) {
    throw new Error('לקוח לא נמצא')
  }
  
  // Replace template variables
  const updateContent = replaceTemplateVariables(update_template, {
    ...data,
    ...client,
  }, tenantSlug)
  
  // Get a system user ID for the update
  const { data: ownerRole } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle()
  
  const userId = ownerRole?.user_id || data.user_id
  
  if (!userId) {
    throw new Error('לא נמצא משתמש לשמירת העדכון')
  }
  
  // Insert update into client_updates table
  const { data: insertedUpdate, error: insertError } = await supabase
    .from('client_updates')
    .insert({
      client_id: clientId,
      tenant_id: tenantId,
      user_id: userId,
      content: updateContent,
    })
    .select()
    .single()
  
  if (insertError) {
    console.error('Error inserting client update:', insertError)
    throw new Error(`שגיאה בשמירת עדכון: ${insertError.message}`)
  }
  
  
  return {
    success: true,
    update_id: insertedUpdate.id,
    content: updateContent,
  }
}

// Execute create task action
async function executeCreateTask(supabase: any, config: any, data: any, tenantId: string) {
  const { task_title_template, task_notes_template, task_priority, task_due_days, default_campaigner_id, default_agency_id } = config
  
  
  // Get tenant slug for template variables
  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug')
    .eq('id', tenantId)
    .single()
  
  const tenantSlug = tenant?.slug || ''
  
  // Replace template variables
  const title = replaceTemplateVariables(task_title_template || '{{company_name}} - משימה חדשה', data, tenantSlug)
  const notes = task_notes_template ? replaceTemplateVariables(task_notes_template, data, tenantSlug) : null
  
  // Calculate due date
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + (task_due_days || 0))
  const dueDateStr = dueDate.toISOString().split('T')[0]
  
  // Get agency - prefer from data, then from config default, then first tenant agency
  let agencyId = data.agency_id || default_agency_id || null
  
  if (!agencyId) {
    const { data: agency } = await supabase
      .from('agencies')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    
    agencyId = agency?.id
  }
  
  if (!agencyId) {
    throw new Error('לא נמצאה סוכנות בארגון')
  }
  
  // Get campaigner - prefer from data, then from config default
  let campaignerId = data.campaigner_id || default_campaigner_id || null
  
  // If campaigner_name provided in data, try to resolve it
  if (!campaignerId && data.campaigner_name) {
    const { data: campaigner } = await supabase
      .from('campaigners')
      .select('id, full_name')
      .eq('tenant_id', tenantId)
      .ilike('full_name', `%${data.campaigner_name}%`)
      .limit(1)
      .maybeSingle()
    
    if (campaigner) {
      campaignerId = campaigner.id
    }
  }
  
  // Get sales person from data
  let salesPersonId = data.sales_person_id || null
  
  // If sales_person_name provided in data, try to resolve it
  if (!salesPersonId && data.sales_person_name) {
    const { data: salesPerson } = await supabase
      .from('sales_people')
      .select('id, full_name')
      .eq('tenant_id', tenantId)
      .ilike('full_name', `%${data.sales_person_name}%`)
      .limit(1)
      .maybeSingle()
    
    if (salesPerson) {
      salesPersonId = salesPerson.id
    }
  }
  
  // Resolve client by name if needed
  let clientId = data.client_id || null
  if (!clientId && data.client_name) {
    const { data: client } = await supabase
      .from('clients')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${data.client_name}%`)
      .limit(1)
      .maybeSingle()
    
    if (client) {
      clientId = client.id
    }
  }
  
  // Resolve lead by name if needed
  let leadId = data.lead_id || null
  if (!leadId && data.lead_name) {
    const { data: lead } = await supabase
      .from('leads')
      .select('id, company_name')
      .eq('tenant_id', tenantId)
      .ilike('company_name', `%${data.lead_name}%`)
      .limit(1)
      .maybeSingle()
    
    if (lead) {
      leadId = lead.id
    }
  }
  
  const taskRecord = {
    title,
    notes,
    status: 'open',
    priority: task_priority || 5,
    due_date: dueDateStr,
    tenant_id: tenantId,
    agency_id: agencyId,
    campaigner_id: campaignerId,
    sales_person_id: salesPersonId,
    lead_id: leadId,
    client_id: clientId,
  }
  
  
  // Insert task
  const { data: newTask, error: insertError } = await supabase
    .from('tasks')
    .insert(taskRecord)
    .select()
    .single()
  
  if (insertError) {
    console.error('Error creating task:', insertError)
    throw new Error(`שגיאה ביצירת משימה: ${insertError.message}`)
  }
  
  
  return {
    success: true,
    task_id: newTask.id,
    title,
  }
}

// Execute create lead action
async function executeCreateLead(supabase: any, config: any, data: any, tenantId: string) {
  
  // Extract lead data from payload
  const companyName = data.company_name || data.name || data.full_name || data.phone || 'ליד חדש'
  const contactName = data.contact_name || data.name || data.full_name || null
  const phone = data.phone || null
  const email = data.email || null
  const source = data.source || 'website'
  const notes = data.notes || null
  
  // Find default agency for this tenant
  let agencyId = data.agency_id
  
  if (!agencyId) {
    
    // First try to find default agency
    const { data: defaultAgency } = await supabase
      .from('agencies')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .eq('is_default', true)
      .limit(1)
      .maybeSingle()
    
    if (defaultAgency) {
      agencyId = defaultAgency.id
    } else {
      // Fallback to first active agency
      const { data: firstAgency } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      
      if (firstAgency) {
        agencyId = firstAgency.id
      }
    }
  }
  
  if (!agencyId) {
    throw new Error('לא נמצאה סוכנות פעילה לארגון זה')
  }
  
  // Check for duplicate by phone
  if (phone) {
    const cleanPhone = phone.replace(/[\s\-\(\)\.+]/g, '').replace(/^0/, '972')
    
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('id, company_name, phone')
      .eq('tenant_id', tenantId)
    
    const duplicateLead = existingLeads?.find((l: any) => {
      if (!l.phone) return false
      const existingClean = l.phone.replace(/[\s\-\(\)\.+]/g, '').replace(/^0/, '972')
      return existingClean === cleanPhone
    })
    
    if (duplicateLead) {
      return {
        success: true,
        lead_id: duplicateLead.id,
        message: 'ליד כבר קיים במערכת',
        duplicate: true,
      }
    }
  }
  
  // Get first pipeline stage for new lead
  const { data: firstStage } = await supabase
    .from('lead_pipeline_stages')
    .select('stage_key')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  
  const status = firstStage?.stage_key || 'new'
  
  // Create the lead
  const { data: newLead, error: insertError } = await supabase
    .from('leads')
    .insert({
      company_name: companyName,
      contact_name: contactName,
      phone: phone,
      email: email,
      source: source,
      notes: notes,
      agency_id: agencyId,
      tenant_id: tenantId,
      status: status,
    })
    .select()
    .single()
  
  if (insertError) {
    console.error('Error creating lead:', insertError)
    throw new Error(`שגיאה ביצירת ליד: ${insertError.message}`)
  }
  
  
  return {
    success: true,
    lead_id: newLead.id,
    company_name: companyName,
    phone: phone,
  }
}

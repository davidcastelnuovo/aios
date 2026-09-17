/**
 * Helpers for Carmen automation flow step read/write (get_automation_details,
 * propose_automation_add_step, edit_automation).
 */

const SENSITIVE_KEY_RE = /(api[_-]?key|token|secret|password|bearer|refresh_token|access_token|private_key)/i

export type ProposeFlowStep = {
  type?: string
  action_type?: string | null
  skin?: string
  instruction?: string
  config?: Record<string, unknown>
  label?: string
}

export function sanitizeStepConfiguration(
  config: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!config || typeof config !== 'object') return null
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      out[key] = '[REDACTED]'
      continue
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = sanitizeStepConfiguration(value as Record<string, unknown>)
    } else {
      out[key] = value
    }
  }
  return out
}

/** Map DB row → Carmen-friendly step (includes full sanitized configuration). */
export function formatAutomationStepForCarmen(step: {
  id: string
  step_type: string
  action_type?: string | null
  label?: string | null
  configuration?: Record<string, unknown> | null
  sort_order?: number | null
  parent_step_id?: string | null
  condition_branch?: string | null
}) {
  const config = sanitizeStepConfiguration(step.configuration ?? null)
  const base = {
    id: step.id,
    step_type: step.step_type,
    action_type: step.action_type,
    label: step.label,
    sort_order: step.sort_order,
    parent_step_id: step.parent_step_id,
    condition_branch: step.condition_branch,
    configuration: config,
  }
  if (step.step_type === 'trigger') {
    return { ...base, propose_format: null }
  }
  if (step.step_type === 'agent') {
    const skinSlugs = (step.configuration?.skin_slugs as string[] | undefined) || []
    return {
      ...base,
      skin_slugs: skinSlugs,
      step_instruction: step.configuration?.step_instruction ?? null,
      agent_id: step.configuration?.agent_id ?? null,
      propose_format: {
        type: 'agent',
        skin: skinSlugs[0] || undefined,
        instruction: String(step.configuration?.step_instruction || ''),
        label: step.label || 'agent',
        config: config || {},
      },
    }
  }
  return {
    ...base,
    propose_format: {
      type: 'action',
      action_type: step.action_type || 'notification',
      label: step.label || step.action_type || 'action',
      config: config || {},
    },
  }
}

export function proposeStepToDbRow(
  s: ProposeFlowStep,
  opts: {
    id: string
    automation_id: string
    tenant_id: string
    parent_step_id: string
    sort_order: number
    position_y: number
    carmenAgentId?: string | null
  },
) {
  const type = String(s.type || 'action')
  let action_type: string | null = null
  let config = (s.config && typeof s.config === 'object') ? { ...s.config } : {}
  if (type === 'agent') {
    action_type = 'agent'
    config = {
      agent_id: opts.carmenAgentId || null,
      skin_slugs: s.skin ? [String(s.skin)] : [],
      step_instruction: s.instruction || '',
      ...config,
    }
  } else if (type === 'action') {
    action_type = s.action_type ? String(s.action_type) : 'notification'
  }
  return {
    id: opts.id,
    automation_id: opts.automation_id,
    tenant_id: opts.tenant_id,
    step_type: type,
    action_type,
    configuration: config,
    position_x: 400,
    position_y: opts.position_y,
    sort_order: opts.sort_order,
    parent_step_id: opts.parent_step_id,
    condition_branch: null,
    label: s.label || type,
  }
}

/** Insert one flow step after `after_step_id` (or append after last step). */
export async function insertAutomationStepAfter(
  supabase: { from: (table: string) => any },
  opts: {
    automation_id: string
    tenant_id: string
    step: ProposeFlowStep
    after_step_id?: string | null
    carmenAgentId?: string | null
  },
): Promise<{ step_id: string; sort_order: number; inserted_after: string }> {
  const { data: existingSteps, error: loadErr } = await supabase
    .from('automation_flow_steps')
    .select('id, step_type, sort_order, parent_step_id, position_y')
    .eq('automation_id', opts.automation_id)
    .order('sort_order', { ascending: true })
  if (loadErr) throw loadErr
  const steps = (existingSteps || []) as Array<{
    id: string
    step_type: string
    sort_order: number
    parent_step_id: string | null
    position_y: number | null
  }>
  if (!steps.length) throw new Error('automation_has_no_steps')

  let anchorId = opts.after_step_id || null
  if (!anchorId) {
    const nonTrigger = steps.filter((s) => s.step_type !== 'trigger')
    anchorId = nonTrigger.length
      ? nonTrigger[nonTrigger.length - 1].id
      : steps.find((s) => s.step_type === 'trigger')!.id
  }
  const anchor = steps.find((s) => s.id === anchorId)
  if (!anchor) throw new Error('after_step_not_found')

  const childStep = steps.find((s) => s.parent_step_id === anchorId)
  const newSort = anchor.sort_order + 1
  const newY = (anchor.position_y ?? 60) + 130
  const newId = crypto.randomUUID()

  if (childStep) {
    for (const s of steps.filter((s) => s.sort_order > anchor.sort_order)) {
      const { error: bumpErr } = await supabase
        .from('automation_flow_steps')
        .update({
          sort_order: s.sort_order + 1,
          position_y: (s.position_y ?? 0) + 130,
        })
        .eq('id', s.id)
      if (bumpErr) throw bumpErr
    }
    const { error: relinkErr } = await supabase
      .from('automation_flow_steps')
      .update({ parent_step_id: newId })
      .eq('id', childStep.id)
    if (relinkErr) throw relinkErr
  }

  const row = proposeStepToDbRow(opts.step, {
    id: newId,
    automation_id: opts.automation_id,
    tenant_id: opts.tenant_id,
    parent_step_id: anchorId,
    sort_order: newSort,
    position_y: newY,
    carmenAgentId: opts.carmenAgentId,
  })
  const { error: insErr } = await supabase.from('automation_flow_steps').insert(row)
  if (insErr) throw insErr

  await supabase.from('automations').update({ is_flow: true }).eq('id', opts.automation_id)

  return { step_id: newId, sort_order: newSort, inserted_after: anchorId }
}

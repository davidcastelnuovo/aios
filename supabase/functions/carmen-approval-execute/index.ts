// Carmen Approval Execute — runs a pending row from agent_approval_queue.
// Routes to carmen-fb-tools / carmen-google-tools / carmen-save-media based on tool_name.
// Used by run-ai-agent (when Carmen calls execute_pending_approval) and by campaign-scheduler-cron.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { asUuidOrNull } from '../_shared/uuid.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TOOL_TO_FUNCTION: Record<string, { fn: string; action?: string }> = {
  fb_create_campaign: { fn: 'carmen-fb-tools', action: 'create_campaign' },
  fb_create_adset: { fn: 'carmen-fb-tools', action: 'create_adset' },
  fb_create_ad: { fn: 'carmen-fb-tools', action: 'create_ad' },
  fb_create_creative_from_media: { fn: 'carmen-fb-tools', action: 'create_creative_from_media' },
  fb_replace_lead_form: { fn: 'carmen-fb-tools', action: 'replace_lead_form' },
  fb_update_budget: { fn: 'carmen-fb-tools', action: 'update_budget' },
  fb_pause: { fn: 'carmen-fb-tools', action: 'pause' },
  fb_resume: { fn: 'carmen-fb-tools', action: 'resume' },
  // Legacy Meta tools (same queue gate; mapped to carmen-fb-tools / fb-campaign-control)
  update_facebook_budget: { fn: 'carmen-fb-tools', action: 'update_budget' },
  gads_pause: { fn: 'carmen-google-tools', action: 'pause' },
  gads_resume: { fn: 'carmen-google-tools', action: 'resume' },
  gads_update_budget: { fn: 'carmen-google-tools', action: 'update_budget' },
};

async function invokeEdgeFn(name: string, payload: any) {
  const r = await fetch(`${SB_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SB_SERVICE}`,
      'Content-Type': 'application/json',
      'apikey': SB_SERVICE,
    },
    body: JSON.stringify(payload),
  });
  const json = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(SB_URL, SB_SERVICE);
    const body = await req.json().catch(() => ({}));
    // Accept `_approval_id` too: resume-agent-run (the UI approval path) invokes
    // this function with {...tool_input, _approval_id} when routing via agent_tools.
    const approval_id = body.approval_id || body._approval_id;
    // Never write literal "system" into uuid columns (WhatsApp / automation callers).
    const approved_by = asUuidOrNull(body.approved_by);
    if (!approval_id) return new Response(JSON.stringify({ error: 'approval_id required' }), { status: 400, headers: corsHeaders });

    const { data: row, error } = await supabase.from('agent_approval_queue').select('*').eq('id', approval_id).maybeSingle();
    if (error || !row) return new Response(JSON.stringify({ error: 'approval_not_found' }), { status: 404, headers: corsHeaders });
    if (row.status === 'executed') return new Response(JSON.stringify({ success: true, already_executed: true, result: row.execution_result }), { headers: corsHeaders });
    if (row.status === 'rejected') return new Response(JSON.stringify({ error: 'rejected' }), { status: 400, headers: corsHeaders });

    // Special handling: schedule_campaign_toggle inserts into campaign_schedules instead of running FB/Google
    if (row.tool_name === 'schedule_campaign_toggle') {
      const inp = (row.tool_input as any) || {};
      const { data: schedRow, error: schedErr } = await supabase.from('campaign_schedules').insert({
        tenant_id: row.tenant_id,
        client_id: inp.client_id || null,
        entity_id: inp.entity_id,
        entity_type: inp.entity_type,
        action: inp.action,
        cron_expression: inp.cron_expression || null,
        run_at: inp.run_at || null,
        timezone: inp.timezone || 'Asia/Jerusalem',
        enabled: true,
        next_run_at: inp.next_run_at || inp.run_at || new Date(Date.now() + 60_000).toISOString(),
        approved_at: new Date().toISOString(),
        approved_by: approved_by || row.requested_by,
        created_by: row.requested_by,
        notes: inp.notes || null,
      }).select('id').single();
      const result = schedErr ? { error: schedErr.message } : { schedule_id: schedRow.id };
      await supabase.from('agent_approval_queue').update({
        status: schedErr ? 'failed' : 'executed',
        approved_by: approved_by || row.requested_by,
        approved_at: row.approved_at || new Date().toISOString(),
        executed_at: new Date().toISOString(),
        execution_result: result,
      }).eq('id', approval_id);
      return new Response(JSON.stringify({ success: !schedErr, result, approval_id }), { status: schedErr ? 400 : 200, headers: corsHeaders });
    }

    // Carmen authoring: build a (disabled) flow automation from the approved spec.
    if (row.tool_name === 'create_automation') {
      const spec = (row.tool_input as any) || {};
      const steps = Array.isArray(spec.steps) ? spec.steps : [];
      if (!spec.name || !spec.trigger_type || steps.length === 0) {
        await supabase.from('agent_approval_queue').update({ status: 'failed', executed_at: new Date().toISOString(), execution_result: { error: 'invalid_spec' } }).eq('id', approval_id);
        return new Response(JSON.stringify({ error: 'invalid_spec' }), { status: 400, headers: corsHeaders });
      }
      // Carmen (or any active agent) for agent steps.
      const { data: agents } = await supabase.from('ai_agents').select('id,name').eq('tenant_id', row.tenant_id).eq('active', true);
      const carmen = (agents as any[] || []).find((a) => /כרמן|carmen/i.test(a.name || '')) || (agents as any[] || [])[0];

      const { data: automation, error: aErr } = await supabase.from('automations').insert({
        name: String(spec.name),
        description: spec.description || null,
        tenant_id: row.tenant_id,
        trigger_type: String(spec.trigger_type),
        action_type: 'notification',
        configuration: spec.trigger_config || {},
        is_flow: true,
        active: false,
      }).select('id').single();
      if (aErr || !automation) {
        await supabase.from('agent_approval_queue').update({ status: 'failed', executed_at: new Date().toISOString(), execution_result: { error: aErr?.message || 'automation_insert_failed' } }).eq('id', approval_id);
        return new Response(JSON.stringify({ error: aErr?.message || 'automation_insert_failed' }), { status: 400, headers: corsHeaders });
      }

      const stepRows: any[] = [];
      const trigId = crypto.randomUUID();
      stepRows.push({ id: trigId, automation_id: automation.id, tenant_id: row.tenant_id, step_type: 'trigger', action_type: String(spec.trigger_type), configuration: spec.trigger_config || {}, position_x: 400, position_y: 60, sort_order: 0, parent_step_id: null, condition_branch: null, label: 'טריגר' });
      let parent = trigId, sort = 0, y = 60;
      for (const s of steps.slice(0, 20)) {
        sort++; y += 130;
        const id = crypto.randomUUID();
        const type = String(s.type || 'agent');
        let action_type: string | null = null;
        let config = (s.config && typeof s.config === 'object') ? { ...s.config } : {};
        if (type === 'agent') {
          action_type = 'agent';
          config = { agent_id: carmen?.id || null, skin_slugs: s.skin ? [String(s.skin)] : [], step_instruction: s.instruction || '', ...config };
        } else if (type === 'action') {
          action_type = s.action_type ? String(s.action_type) : 'notification';
        }
        stepRows.push({ id, automation_id: automation.id, tenant_id: row.tenant_id, step_type: type, action_type, configuration: config, position_x: 400, position_y: y, sort_order: sort, parent_step_id: parent, condition_branch: null, label: s.label || type });
        parent = id;
      }
      const { error: sErr } = await supabase.from('automation_flow_steps').insert(stepRows);
      const result = sErr ? { error: sErr.message, automation_id: automation.id } : { automation_id: automation.id, steps: stepRows.length, active: false };
      await supabase.from('agent_approval_queue').update({
        status: sErr ? 'failed' : 'executed',
        approved_by: approved_by || row.requested_by,
        approved_at: row.approved_at || new Date().toISOString(),
        executed_at: new Date().toISOString(),
        execution_result: result,
      }).eq('id', approval_id);
      return new Response(JSON.stringify({ success: !sErr, result, approval_id }), { status: sErr ? 400 : 200, headers: corsHeaders });
    }

    // ── Broadcast actions ──────────────────────────────────────────────────────
    if (row.tool_name === 'send_broadcast_now') {
      const inp = (row.tool_input as any) || {};
      if (!inp.broadcast_id) {
        await supabase.from('agent_approval_queue').update({ status: 'failed', executed_at: new Date().toISOString(), execution_result: { error: 'missing_broadcast_id' } }).eq('id', approval_id);
        return new Response(JSON.stringify({ error: 'missing_broadcast_id' }), { status: 400, headers: corsHeaders });
      }
      // 1. Enqueue recipients via broadcast-enqueue
      const enqRes = await fetch(`${SB_URL}/functions/v1/broadcast-enqueue`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SB_SERVICE}`, 'Content-Type': 'application/json', 'apikey': SB_SERVICE },
        body: JSON.stringify({ broadcastId: inp.broadcast_id, dryRun: false }),
      });
      const enqJson = await enqRes.json().catch(() => ({}));
      if (!enqRes.ok) {
        await supabase.from('agent_approval_queue').update({ status: 'failed', executed_at: new Date().toISOString(), execution_result: enqJson }).eq('id', approval_id);
        return new Response(JSON.stringify({ error: 'enqueue_failed', detail: enqJson }), { status: 400, headers: corsHeaders });
      }
      // 2. Set status=sending + started_at
      await supabase.from('broadcasts').update({ status: 'sending', started_at: new Date().toISOString() }).eq('id', inp.broadcast_id);
      const result = { success: true, broadcast_id: inp.broadcast_id, recipients: enqJson.total ?? enqJson.count ?? '?' };
      await supabase.from('agent_approval_queue').update({
        status: 'executed', approved_by: approved_by || row.requested_by,
        approved_at: row.approved_at || new Date().toISOString(),
        executed_at: new Date().toISOString(), execution_result: result,
      }).eq('id', approval_id);
      return new Response(JSON.stringify({ success: true, result, approval_id }), { headers: corsHeaders });
    }

    if (row.tool_name === 'schedule_broadcast') {
      const inp = (row.tool_input as any) || {};
      if (!inp.broadcast_id || !inp.scheduled_at) {
        await supabase.from('agent_approval_queue').update({ status: 'failed', executed_at: new Date().toISOString(), execution_result: { error: 'missing_params' } }).eq('id', approval_id);
        return new Response(JSON.stringify({ error: 'missing_params' }), { status: 400, headers: corsHeaders });
      }
      const { error: upErr } = await supabase.from('broadcasts').update({ status: 'scheduled', scheduled_at: inp.scheduled_at }).eq('id', inp.broadcast_id);
      const result = upErr ? { error: upErr.message } : { success: true, broadcast_id: inp.broadcast_id, scheduled_at: inp.scheduled_at };
      await supabase.from('agent_approval_queue').update({
        status: upErr ? 'failed' : 'executed', approved_by: approved_by || row.requested_by,
        approved_at: row.approved_at || new Date().toISOString(),
        executed_at: new Date().toISOString(), execution_result: result,
      }).eq('id', approval_id);
      return new Response(JSON.stringify({ success: !upErr, result, approval_id }), { status: upErr ? 400 : 200, headers: corsHeaders });
    }

    if (row.tool_name === 'cancel_broadcast') {
      const inp = (row.tool_input as any) || {};
      if (!inp.broadcast_id) {
        await supabase.from('agent_approval_queue').update({ status: 'failed', executed_at: new Date().toISOString(), execution_result: { error: 'missing_broadcast_id' } }).eq('id', approval_id);
        return new Response(JSON.stringify({ error: 'missing_broadcast_id' }), { status: 400, headers: corsHeaders });
      }
      const { error: upErr } = await supabase.from('broadcasts').update({ status: 'canceled' }).eq('id', inp.broadcast_id);
      const result = upErr ? { error: upErr.message } : { success: true, broadcast_id: inp.broadcast_id, status: 'canceled' };
      await supabase.from('agent_approval_queue').update({
        status: upErr ? 'failed' : 'executed', approved_by: approved_by || row.requested_by,
        approved_at: row.approved_at || new Date().toISOString(),
        executed_at: new Date().toISOString(), execution_result: result,
      }).eq('id', approval_id);
      return new Response(JSON.stringify({ success: !upErr, result, approval_id }), { status: upErr ? 400 : 200, headers: corsHeaders });
    }

    // Legacy Meta: toggle_facebook_campaign → carmen-fb-tools pause/resume
    if (row.tool_name === 'toggle_facebook_campaign') {
      const inp = (row.tool_input as any) || {};
      const entity_id = inp.campaign_id || inp.entity_id;
      const status = String(inp.status || '').toUpperCase();
      if (!entity_id || !['ACTIVE', 'PAUSED'].includes(status)) {
        await supabase.from('agent_approval_queue').update({ status: 'failed', executed_at: new Date().toISOString(), execution_result: { error: 'invalid_toggle_input' } }).eq('id', approval_id);
        return new Response(JSON.stringify({ error: 'invalid_toggle_input' }), { status: 400, headers: corsHeaders });
      }
      const r = await invokeEdgeFn('carmen-fb-tools', {
        tenant_id: row.tenant_id,
        action: status === 'PAUSED' ? 'pause' : 'resume',
        confirmed: true,
        entity_id,
        client_id: inp.client_id,
      });
      await supabase.from('agent_approval_queue').update({
        status: r.ok ? 'executed' : 'failed',
        approved_by: approved_by || row.requested_by,
        approved_at: row.approved_at || new Date().toISOString(),
        executed_at: new Date().toISOString(),
        execution_result: r.json,
      }).eq('id', approval_id);
      return new Response(JSON.stringify({ success: r.ok, result: r.json, approval_id }), { status: r.ok ? 200 : 400, headers: corsHeaders });
    }

    // Legacy Meta: duplicate_facebook_campaign → fb-campaign-control
    if (row.tool_name === 'duplicate_facebook_campaign') {
      const inp = (row.tool_input as any) || {};
      if (!inp.campaign_id) {
        await supabase.from('agent_approval_queue').update({ status: 'failed', executed_at: new Date().toISOString(), execution_result: { error: 'missing_campaign_id' } }).eq('id', approval_id);
        return new Response(JSON.stringify({ error: 'missing_campaign_id' }), { status: 400, headers: corsHeaders });
      }
      const r = await invokeEdgeFn('fb-campaign-control', {
        tenant_id: row.tenant_id,
        action: 'duplicate',
        campaign_id: inp.campaign_id,
        name_suffix: inp.name_suffix,
        confirmed: true,
      });
      await supabase.from('agent_approval_queue').update({
        status: r.ok ? 'executed' : 'failed',
        approved_by: approved_by || row.requested_by,
        approved_at: row.approved_at || new Date().toISOString(),
        executed_at: new Date().toISOString(),
        execution_result: r.json,
      }).eq('id', approval_id);
      return new Response(JSON.stringify({ success: r.ok, result: r.json, approval_id }), { status: r.ok ? 200 : 400, headers: corsHeaders });
    }

    // ── Automation mutations ────────────────────────────────────────────────
    if (row.tool_name === 'toggle_automation' || row.tool_name === 'delete_automation' || row.tool_name === 'edit_automation') {
      const inp = (row.tool_input as any) || {};
      let result: any = null;
      let failed = false;
      try {
        if (!inp.automation_id) throw new Error('automation_id required');
        const { data: auto } = await supabase.from('automations').select('id, name, tenant_id, is_flow, trigger_type').eq('id', inp.automation_id).eq('tenant_id', row.tenant_id).maybeSingle();
        if (!auto) throw new Error('automation_not_found');

        if (row.tool_name === 'toggle_automation') {
          const { data, error } = await supabase.from('automations').update({ active: !!inp.active }).eq('id', inp.automation_id).eq('tenant_id', row.tenant_id).select('id, name, active').single();
          if (error) throw error;
          result = data;
        } else if (row.tool_name === 'delete_automation') {
          const { error } = await supabase.from('automations').delete().eq('id', inp.automation_id).eq('tenant_id', row.tenant_id);
          if (error) throw error;
          result = { deleted: inp.automation_id, name: auto.name };
        } else {
          // edit_automation
          const patch: Record<string, unknown> = {};
          if (inp.name != null) patch.name = String(inp.name);
          if (inp.description != null) patch.description = inp.description;
          if (inp.trigger_type != null) patch.trigger_type = String(inp.trigger_type);
          if (inp.trigger_config && typeof inp.trigger_config === 'object') patch.configuration = inp.trigger_config;
          if (Object.keys(patch).length) {
            const { error } = await supabase.from('automations').update(patch).eq('id', inp.automation_id).eq('tenant_id', row.tenant_id);
            if (error) throw error;
          }
          let stepsReplaced = 0;
          if (Array.isArray(inp.steps) && inp.steps.length > 0) {
            await supabase.from('automation_flow_steps').delete().eq('automation_id', inp.automation_id);
            const { data: agents } = await supabase.from('ai_agents').select('id,name').eq('tenant_id', row.tenant_id).eq('active', true);
            const carmen = (agents as any[] || []).find((a) => /כרמן|carmen/i.test(a.name || '')) || (agents as any[] || [])[0];
            const stepRows: any[] = [];
            const trigId = crypto.randomUUID();
            const triggerType = inp.trigger_type || auto.trigger_type || 'manual_command';
            stepRows.push({
              id: trigId, automation_id: inp.automation_id, tenant_id: row.tenant_id,
              step_type: 'trigger', action_type: String(triggerType),
              configuration: inp.trigger_config || {},
              position_x: 400, position_y: 60, sort_order: 0, parent_step_id: null, condition_branch: null, label: 'טריגר',
            });
            let parent = trigId, sort = 0, y = 60;
            for (const s of inp.steps.slice(0, 20)) {
              sort++; y += 130;
              const id = crypto.randomUUID();
              const type = String(s.type || 'agent');
              let action_type: string | null = null;
              let config = (s.config && typeof s.config === 'object') ? { ...s.config } : {};
              if (type === 'agent') {
                action_type = 'agent';
                config = { agent_id: carmen?.id || null, skin_slugs: s.skin ? [String(s.skin)] : [], step_instruction: s.instruction || '', ...config };
              } else if (type === 'action') {
                action_type = s.action_type ? String(s.action_type) : 'notification';
              }
              stepRows.push({
                id, automation_id: inp.automation_id, tenant_id: row.tenant_id,
                step_type: type, action_type, configuration: config,
                position_x: 400, position_y: y, sort_order: sort, parent_step_id: parent, condition_branch: null,
                label: s.label || type,
              });
              parent = id;
            }
            const { error: sErr } = await supabase.from('automation_flow_steps').insert(stepRows);
            if (sErr) throw sErr;
            stepsReplaced = stepRows.length;
            await supabase.from('automations').update({ is_flow: true }).eq('id', inp.automation_id);
          }
          result = { automation_id: inp.automation_id, updated_fields: Object.keys(patch), steps_replaced: stepsReplaced };
        }
      } catch (e: any) {
        failed = true;
        result = { error: String(e?.message || e) };
      }
      await supabase.from('agent_approval_queue').update({
        status: failed ? 'failed' : 'executed',
        approved_by: approved_by || row.requested_by,
        approved_at: row.approved_at || new Date().toISOString(),
        executed_at: new Date().toISOString(),
        execution_result: result,
      }).eq('id', approval_id);
      return new Response(JSON.stringify({ success: !failed, result, approval_id }), { status: failed ? 400 : 200, headers: corsHeaders });
    }

    // ── Accounting mutations (real AccountingIntegrations tables) ────────────
    const accountingTools = new Set([
      'create_one_time_income', 'delete_one_time_income',
      'record_income_payment', 'delete_income_payment',
      'record_expense_payment', 'delete_expense_payment',
      'update_client_retainer',
    ]);
    if (accountingTools.has(row.tool_name)) {
      const inp = (row.tool_input as any) || {};
      let result: any = null;
      let failed = false;
      try {
        if (row.tool_name === 'create_one_time_income') {
          const { data, error } = await supabase.from('one_time_incomes').insert({
            tenant_id: row.tenant_id,
            client_id: inp.client_id,
            product_name: String(inp.product_name),
            amount: Number(inp.amount),
            payment_month: String(inp.payment_month),
            notes: inp.notes || null,
            created_by: approved_by || row.requested_by,
          }).select('id, product_name, amount, payment_month').single();
          if (error) throw error;
          result = { income_id: data.id, ...data };
        } else if (row.tool_name === 'delete_one_time_income') {
          const { error } = await supabase.from('one_time_incomes').delete().eq('id', inp.income_id).eq('tenant_id', row.tenant_id);
          if (error) throw error;
          result = { deleted: inp.income_id };
        } else if (row.tool_name === 'record_income_payment') {
          const { data: client } = await supabase.from('clients').select('name').eq('id', inp.client_id).maybeSingle();
          const { data, error } = await supabase.from('income_payments').insert({
            tenant_id: row.tenant_id,
            client_id: inp.client_id,
            client_name: client?.name || inp.client_name || 'unknown',
            amount: Number(inp.amount),
            payment_month: String(inp.payment_month),
            notes: inp.notes || null,
            received_by: approved_by || row.requested_by,
            received_at: new Date().toISOString(),
          }).select('id, amount, payment_month, client_name').single();
          if (error) throw error;
          result = { payment_id: data.id, ...data };
        } else if (row.tool_name === 'delete_income_payment') {
          const { error } = await supabase.from('income_payments').delete().eq('id', inp.payment_id).eq('tenant_id', row.tenant_id);
          if (error) throw error;
          result = { deleted: inp.payment_id };
        } else if (row.tool_name === 'record_expense_payment') {
          const { data, error } = await supabase.from('expense_payments').insert({
            tenant_id: row.tenant_id,
            expense_type: String(inp.expense_type),
            expense_id: inp.expense_id,
            expense_name: String(inp.expense_name),
            amount: Number(inp.amount),
            payment_month: String(inp.payment_month),
            notes: inp.notes || null,
            paid_by: approved_by || row.requested_by,
            paid_at: new Date().toISOString(),
          }).select('id, expense_type, expense_name, amount, payment_month').single();
          if (error) throw error;
          result = { payment_id: data.id, ...data };
        } else if (row.tool_name === 'delete_expense_payment') {
          const { error } = await supabase.from('expense_payments').delete().eq('id', inp.payment_id).eq('tenant_id', row.tenant_id);
          if (error) throw error;
          result = { deleted: inp.payment_id };
        } else if (row.tool_name === 'update_client_retainer') {
          if (inp.retainer == null && inp.monthly_budget == null && !inp.notes) throw new Error('retainer / monthly_budget / notes required');
          const payload: Record<string, unknown> = {
            client_id: inp.client_id,
            tenant_id: row.tenant_id,
            updated_at: new Date().toISOString(),
          };
          if (inp.retainer != null) payload.retainer = Number(inp.retainer);
          if (inp.monthly_budget != null) payload.monthly_budget = Number(inp.monthly_budget);
          if (inp.notes != null) payload.notes = inp.notes;
          const { data, error } = await supabase.from('client_tenant_financial_data')
            .upsert(payload, { onConflict: 'client_id,tenant_id' })
            .select('client_id, retainer, monthly_budget, notes').single();
          if (error) throw error;
          result = { updated: true, ...data };
        }
      } catch (e: any) {
        failed = true;
        result = { error: String(e?.message || e) };
      }
      await supabase.from('agent_approval_queue').update({
        status: failed ? 'failed' : 'executed',
        approved_by: approved_by || row.requested_by,
        approved_at: row.approved_at || new Date().toISOString(),
        executed_at: new Date().toISOString(),
        execution_result: result,
      }).eq('id', approval_id);
      return new Response(JSON.stringify({ success: !failed, result, approval_id }), { status: failed ? 400 : 200, headers: corsHeaders });
    }

    const route = TOOL_TO_FUNCTION[row.tool_name];
    if (!route) return new Response(JSON.stringify({ error: 'unknown_tool', tool_name: row.tool_name }), { status: 400, headers: corsHeaders });

    // Normalize legacy update_facebook_budget → carmen-fb-tools entity_id
    const rawInput = (row.tool_input as any) || {};
    const normalizedInput = row.tool_name === 'update_facebook_budget'
      ? { ...rawInput, entity_id: rawInput.entity_id || rawInput.campaign_id }
      : rawInput;

    const payload = {
      tenant_id: row.tenant_id,
      action: route.action,
      confirmed: true,
      ...normalizedInput,
    };

    const r = await invokeEdgeFn(route.fn, payload);

    await supabase.from('agent_approval_queue').update({
      status: r.ok ? 'executed' : 'failed',
      approved_by: approved_by || row.requested_by,
      approved_at: row.approved_at || new Date().toISOString(),
      executed_at: new Date().toISOString(),
      execution_result: r.json,
    }).eq('id', approval_id);

    return new Response(JSON.stringify({ success: r.ok, result: r.json, approval_id }), { status: r.ok ? 200 : 400, headers: corsHeaders });
  } catch (e: any) {
    console.error('[carmen-approval-execute]', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});

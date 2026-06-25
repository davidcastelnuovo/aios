// broadcast-enqueue — resolves a broadcast's audience_filter into a concrete
// recipient snapshot. Supports dryRun (count + sample, no writes) for the wizard,
// and commit mode (insert broadcast_recipients + mark broadcast ready to send).
//
// Audience filter shape (audience_filter JSONB on broadcasts):
//   { source: 'clients'|'leads'|'campaigners',
//     statuses?: string[],        // clients: client_status enum
//     serviceTags?: string[],     // clients: services[] overlap
//     statusKeys?: string[],      // leads: leads.status
//     salesPersonIds?: string[],  // leads: sales_person_id
//     tagIds?: string[],          // clients/leads: chat_contact_tags
//     roles?: string[],           // campaigners: role[] overlap
//     activeOnly?: boolean }      // campaigners (default true)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function normalizePhone(input: string | null | undefined, cc = '972'): string | null {
  if (!input) return null;
  let d = String(input).replace(/[^0-9]/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith(cc)) return d;
  if (d.startsWith('0')) return cc + d.slice(1);
  return cc + d;
}

type Recipient = {
  entity_type: 'client' | 'lead' | 'campaigner' | 'manual';
  entity_id: string | null;
  phone: string | null;
  email: string | null;
  contact_name: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const isServiceRole = token === SB_SERVICE;

    // User-scoped client respects RLS so a user can only enqueue their own tenant's data.
    const db = isServiceRole
      ? createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } })
      : createClient(SB_URL, SB_ANON, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false },
        });

    const { broadcastId, dryRun, filter: inlineFilter, channel: inlineChannel, tenantId: inlineTenant } =
      await req.json();

    // Resolve the filter + channel + tenant either from the stored broadcast or inline (dry run preview)
    let filter: any = inlineFilter;
    let channel: string = inlineChannel || 'whatsapp';
    let tenantId: string | undefined = inlineTenant;

    if (broadcastId) {
      const { data: b, error } = await db
        .from('broadcasts')
        .select('id, tenant_id, channel, audience_filter, status')
        .eq('id', broadcastId)
        .single();
      if (error || !b) {
        return new Response(JSON.stringify({ error: 'broadcast_not_found' }), { status: 404, headers: corsHeaders });
      }
      filter = b.audience_filter || {};
      channel = b.channel;
      tenantId = b.tenant_id;
    }

    if (!filter || !filter.source) {
      return new Response(JSON.stringify({ error: 'missing_filter_source' }), { status: 400, headers: corsHeaders });
    }
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'missing_tenant' }), { status: 400, headers: corsHeaders });
    }

    const source: string = filter.source;
    let recipients: Recipient[] = [];

    // ── Source: saved mailing list (short-circuits CRM resolution) ──
    if (source === 'list') {
      if (!filter.listId) {
        return new Response(JSON.stringify({ error: 'missing_listId' }), { status: 400, headers: corsHeaders });
      }
      const { data: members, error } = await db
        .from('broadcast_list_members')
        .select('entity_type, entity_id, name, phone, email')
        .eq('tenant_id', tenantId)
        .eq('list_id', filter.listId);
      if (error) throw error;
      recipients = (members || []).map((m: any) => ({
        entity_type: (m.entity_type || 'manual') as Recipient['entity_type'],
        entity_id: m.entity_id || null,
        phone: m.phone || null,
        email: m.email || null,
        contact_name: m.name || null,
      }));
      return finalizeReach(recipients, channel, db, tenantId, dryRun, broadcastId);
    }

    // ── Tag prefilter (chat_contact_tags maps tags → client_id / lead_id) ──
    let tagEntityIds: Set<string> | null = null;
    if (Array.isArray(filter.tagIds) && filter.tagIds.length > 0 && (source === 'clients' || source === 'leads')) {
      const col = source === 'clients' ? 'client_id' : 'lead_id';
      const { data: tagged } = await db
        .from('chat_contact_tags')
        .select(col)
        .eq('tenant_id', tenantId)
        .in('tag_id', filter.tagIds)
        .not(col, 'is', null);
      tagEntityIds = new Set((tagged || []).map((r: any) => r[col]).filter(Boolean));
      if (tagEntityIds.size === 0) {
        // tag filter matches nothing → empty audience
        return finalize([], { dryRun, broadcastId, db, tenantId, channel });
      }
    }

    if (source === 'clients') {
      let q = db.from('clients').select('id, contact_name, name, phone, email, status, services').eq('tenant_id', tenantId);
      if (Array.isArray(filter.statuses) && filter.statuses.length > 0) q = q.in('status', filter.statuses);
      if (Array.isArray(filter.serviceTags) && filter.serviceTags.length > 0) q = q.overlaps('services', filter.serviceTags);
      const { data, error } = await q;
      if (error) throw error;
      recipients = (data || [])
        .filter((c: any) => !tagEntityIds || tagEntityIds.has(c.id))
        .map((c: any) => ({
          entity_type: 'client' as const,
          entity_id: c.id,
          phone: c.phone || null,
          email: c.email || null,
          contact_name: c.contact_name || c.name || null,
        }));
    } else if (source === 'leads') {
      let q = db.from('leads').select('id, contact_name, company_name, phone, email, status, sales_person_id').eq('tenant_id', tenantId);
      if (Array.isArray(filter.statusKeys) && filter.statusKeys.length > 0) q = q.in('status', filter.statusKeys);
      if (Array.isArray(filter.salesPersonIds) && filter.salesPersonIds.length > 0) q = q.in('sales_person_id', filter.salesPersonIds);
      const { data, error } = await q;
      if (error) throw error;
      recipients = (data || [])
        .filter((l: any) => !tagEntityIds || tagEntityIds.has(l.id))
        .map((l: any) => ({
          entity_type: 'lead' as const,
          entity_id: l.id,
          phone: l.phone || null,
          email: l.email || null,
          contact_name: l.contact_name || l.company_name || null,
        }));
    } else if (source === 'campaigners') {
      let q = db.from('campaigners').select('id, full_name, phone, email, role, active').eq('tenant_id', tenantId);
      if (filter.activeOnly !== false) q = q.eq('active', true);
      const { data, error } = await q;
      if (error) throw error;
      recipients = (data || [])
        .filter((c: any) => {
          if (Array.isArray(filter.roles) && filter.roles.length > 0) {
            const roles: string[] = Array.isArray(c.role) ? c.role : [];
            return roles.some((r) => filter.roles.includes(r));
          }
          return true;
        })
        .map((c: any) => ({
          entity_type: 'campaigner' as const,
          entity_id: c.id,
          phone: c.phone || null,
          email: c.email || null,
          contact_name: c.full_name || null,
        }));
    } else {
      return new Response(JSON.stringify({ error: 'unknown_source' }), { status: 400, headers: corsHeaders });
    }

    // ── Manual include / exclude specific contacts by entity id ──
    if (Array.isArray(filter.includeIds) && filter.includeIds.length > 0) {
      const inc = new Set(filter.includeIds);
      recipients = recipients.filter((r) => r.entity_id && inc.has(r.entity_id));
    }
    if (Array.isArray(filter.excludeIds) && filter.excludeIds.length > 0) {
      const exc = new Set(filter.excludeIds);
      recipients = recipients.filter((r) => !r.entity_id || !exc.has(r.entity_id));
    }

    return finalizeReach(recipients, channel, db, tenantId, dryRun, broadcastId);
  } catch (e: any) {
    console.error('[broadcast-enqueue]', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});

// Shared tail: channel reachability + normalize/dedup + opt-out removal + finalize.
async function finalizeReach(
  recipients: Recipient[],
  channel: string,
  db: any,
  tenantId: string,
  dryRun: boolean | undefined,
  broadcastId: string | undefined,
) {
  const reachable = recipients.filter((r) => (channel === 'email' ? !!r.email : !!r.phone));

  const seen = new Set<string>();
  const deduped: Recipient[] = [];
  for (const r of reachable) {
    const key = channel === 'email' ? (r.email || '').toLowerCase() : normalizePhone(r.phone);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...r, phone: channel === 'email' ? r.phone : (key as string) });
  }

  const { data: optOuts } = await db
    .from('broadcast_opt_outs')
    .select('phone, email, channel')
    .eq('tenant_id', tenantId)
    .in('channel', [channel, 'all']);
  const optPhones = new Set((optOuts || []).map((o: any) => o.phone).filter(Boolean));
  const optEmails = new Set((optOuts || []).map((o: any) => (o.email || '').toLowerCase()).filter(Boolean));
  const finalRecipients = deduped.filter((r) =>
    channel === 'email' ? !optEmails.has((r.email || '').toLowerCase()) : !optPhones.has(r.phone || ''),
  );

  return finalize(finalRecipients, { dryRun, broadcastId, db, tenantId, channel });
}

async function finalize(
  recipients: Recipient[],
  ctx: { dryRun?: boolean; broadcastId?: string; db: any; tenantId: string; channel: string },
) {
  const total = recipients.length;
  const sample = recipients.slice(0, 10).map((r) => ({ name: r.contact_name, phone: r.phone, email: r.email }));

  if (ctx.dryRun || !ctx.broadcastId) {
    return new Response(JSON.stringify({ success: true, total, sample }), { status: 200, headers: corsHeaders });
  }

  // Commit: clear any previous snapshot for re-enqueue, then insert fresh.
  await ctx.db.from('broadcast_recipients').delete().eq('broadcast_id', ctx.broadcastId);

  if (total > 0) {
    const rows = recipients.map((r) => ({
      broadcast_id: ctx.broadcastId,
      tenant_id: ctx.tenantId,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      phone: r.phone,
      email: r.email,
      contact_name: r.contact_name,
      status: 'pending',
    }));
    // Chunk inserts to stay within payload limits
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await ctx.db.from('broadcast_recipients').insert(chunk);
      if (error && !String(error.message).includes('duplicate')) throw error;
    }
  }

  await ctx.db
    .from('broadcasts')
    .update({ stats: { total, sent: 0, delivered: 0, failed: 0, opted_out: 0 } })
    .eq('id', ctx.broadcastId);

  return new Response(JSON.stringify({ success: true, total, sample }), { status: 200, headers: corsHeaders });
}

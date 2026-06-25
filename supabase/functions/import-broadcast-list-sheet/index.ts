// import-broadcast-list-sheet — imports/syncs contacts from a Google Sheet into a
// broadcast list. Mirrors import-leads-from-sheets: reads via the Sheets API with
// GOOGLE_API_KEY (sheet must be link-viewable). Two modes:
//   fetchHeadersOnly=true → return headers + preview rows for the column-mapping UI
//   otherwise             → import rows using fieldMap { "<header>": "name|phone|email" }
// Callable by an authenticated user (frontend) or by service role (sync cron).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = String(phone).replace(/[^0-9]/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('972')) return d;
  if (d.startsWith('0')) return '972' + d.slice(1);
  return d.length >= 9 ? '972' + d : d;
}

// Accept either a bare sheet id or a full Google Sheets URL.
function extractSheetId(input: string): string {
  const m = String(input || '').match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : String(input || '').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!GOOGLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'google_not_configured', details: 'GOOGLE_API_KEY secret missing' }), { status: 400, headers: corsHeaders });
    }
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const isServiceRole = token === SB_SERVICE;

    const body = await req.json();
    const { listId, sheetId: rawSheet, range, fieldMap, fetchHeadersOnly } = body;
    let tenantId: string | undefined = body.tenantId;

    // Resolve / verify tenant
    if (!isServiceRole) {
      const userClient = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
      const { data: { user } } = await userClient.auth.getUser(token);
      if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
      if (!tenantId) {
        const { data: at } = await userClient.from('user_active_tenant').select('tenant_id').eq('user_id', user.id).maybeSingle();
        tenantId = at?.tenant_id;
      }
    }
    if (!tenantId) return new Response(JSON.stringify({ error: 'missing_tenant' }), { status: 400, headers: corsHeaders });

    const sheetId = extractSheetId(rawSheet);
    if (!sheetId) return new Response(JSON.stringify({ error: 'missing_sheet' }), { status: 400, headers: corsHeaders });

    const sheetRange = range || 'A:Z';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetRange)}?key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: 'sheet_fetch_failed', status: res.status, details: t.slice(0, 300) }), { status: 400, headers: corsHeaders });
    }
    const sheet = await res.json();
    const rows: any[][] = sheet.values || [];
    if (rows.length < 1) return new Response(JSON.stringify({ error: 'empty_sheet' }), { status: 400, headers: corsHeaders });

    const headers = rows[0].map((h) => String(h).trim());

    if (fetchHeadersOnly) {
      const previewRows = rows.slice(1, 6).map((r) => r.map((c) => String(c ?? '').trim()));
      // Suggest a mapping by common header names (he/en)
      const guess: Record<string, string> = {};
      headers.forEach((h) => {
        const l = h.toLowerCase();
        if (/(שם|name|איש קשר|contact)/.test(l)) guess[h] = 'name';
        else if (/(טלפון|נייד|phone|mobile|whatsapp)/.test(l)) guess[h] = 'phone';
        else if (/(מייל|אימייל|email|mail)/.test(l)) guess[h] = 'email';
      });
      return new Response(JSON.stringify({ headers, previewRows, suggestedMap: guess }), { status: 200, headers: corsHeaders });
    }

    if (!listId) return new Response(JSON.stringify({ error: 'missing_listId' }), { status: 400, headers: corsHeaders });
    const map: Record<string, string> = fieldMap || {};
    const idx: Record<string, number> = {};
    headers.forEach((h, i) => { const f = map[h] || map[h.trim()]; if (f) idx[f] = i; });
    if (idx.phone === undefined && idx.email === undefined) {
      return new Response(JSON.stringify({ error: 'no_phone_or_email_mapped' }), { status: 400, headers: corsHeaders });
    }

    const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
    const members: any[] = [];
    const seen = new Set<string>();
    for (const row of rows.slice(1)) {
      const phone = idx.phone !== undefined ? normalizePhone(String(row[idx.phone] ?? '')) : null;
      const email = idx.email !== undefined ? String(row[idx.email] ?? '').trim().toLowerCase() || null : null;
      const name = idx.name !== undefined ? String(row[idx.name] ?? '').trim() || null : null;
      if (!phone && !email) continue;
      const key = phone || email!;
      if (seen.has(key)) continue;
      seen.add(key);
      members.push({ list_id: listId, tenant_id: tenantId, entity_type: 'manual', name, phone, email, added_via: 'sheet' });
    }

    let inserted = 0;
    for (let i = 0; i < members.length; i += 500) {
      const chunk = members.slice(i, i + 500);
      const { error, count } = await db
        .from('broadcast_list_members')
        .upsert(chunk, { onConflict: 'list_id,phone', ignoreDuplicates: true, count: 'exact' });
      if (error && !String(error.message).includes('duplicate')) throw error;
      inserted += count ?? 0;
    }

    // Recompute member count + sync metadata
    const { count: total } = await db.from('broadcast_list_members').select('id', { count: 'exact', head: true }).eq('list_id', listId);
    await db.from('broadcast_lists').update({
      member_count: total ?? 0,
      last_synced_at: new Date().toISOString(),
      last_sync_status: 'success',
      source: 'google_sheet',
      source_config: { sheetId, range: sheetRange, fieldMap: map },
    }).eq('id', listId);

    return new Response(JSON.stringify({ success: true, parsed: members.length, total: total ?? 0 }), { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error('[import-broadcast-list-sheet]', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});

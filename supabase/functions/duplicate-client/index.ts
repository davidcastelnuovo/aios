import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DuplicateOptions {
  clientId: string;
  newName: string;
  includeContacts?: boolean;
  includeTeam?: boolean;
  includeCredentials?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as DuplicateOptions;
    const { clientId, newName, includeContacts, includeTeam, includeCredentials } = body;

    if (!clientId || !newName?.trim()) {
      return new Response(JSON.stringify({ error: 'clientId and newName are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role for the duplication (bypasses RLS for cross-table writes,
    // but we already verified the user can read the source via RLS check below)
    const admin = createClient(supabaseUrl, serviceKey);

    // Verify the user can read the source client (respects RLS)
    const { data: source, error: srcErr } = await userClient
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .maybeSingle();
    if (srcErr || !source) {
      return new Response(JSON.stringify({ error: 'Source client not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build the new client row — copy everything except identity / unique chat keys
    const {
      id: _id,
      created_at: _ca,
      updated_at: _ua,
      manychat_subscriber_id: _mc,
      whatsapp_group_id: _wg,
      whatsapp_avatar_url: _wa,
      ...rest
    } = source as any;

    const newRow: any = {
      ...rest,
      name: newName.trim(),
      manychat_subscriber_id: null,
      whatsapp_group_id: null,
      whatsapp_avatar_url: null,
    };

    const { data: inserted, error: insErr } = await admin
      .from('clients')
      .insert(newRow)
      .select('id, tenant_id')
      .single();
    if (insErr || !inserted) {
      console.error('Insert failed:', insErr);
      return new Response(JSON.stringify({ error: insErr?.message || 'Insert failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const newClientId = inserted.id;
    const newTenantId = inserted.tenant_id;

    const stats: Record<string, number> = {};

    // 1) Additional contacts
    if (includeContacts) {
      const { data: contacts } = await admin
        .from('client_contacts')
        .select('contact_name, email, phone, role, is_primary')
        .eq('client_id', clientId);
      if (contacts && contacts.length > 0) {
        const rows = contacts.map((c: any) => ({
          ...c,
          client_id: newClientId,
          tenant_id: newTenantId,
        }));
        const { error } = await admin.from('client_contacts').insert(rows);
        if (!error) stats.contacts = rows.length;
      }
    }

    // 2) Team (campaigners assignment)
    if (includeTeam) {
      const { data: team } = await admin
        .from('client_team')
        .select('campaigner_id, role_on_account, allocation_percent, campaigner_payment, start_date, end_date, notes')
        .eq('client_id', clientId);
      if (team && team.length > 0) {
        const rows = team.map((t: any) => ({ ...t, client_id: newClientId }));
        const { error } = await admin.from('client_team').insert(rows);
        if (!error) stats.team = rows.length;
      }
    }

    // 3) Credentials
    if (includeCredentials) {
      const { data: creds } = await admin
        .from('client_credentials')
        .select('service_name, username, password, url, notes')
        .eq('client_id', clientId);
      if (creds && creds.length > 0) {
        const rows = creds.map((c: any) => ({
          ...c,
          client_id: newClientId,
          tenant_id: newTenantId,
        }));
        const { error } = await admin.from('client_credentials').insert(rows);
        if (!error) stats.credentials = rows.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, newClientId, stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('duplicate-client error:', e);
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

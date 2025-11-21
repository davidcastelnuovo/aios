import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users').select('tenant_id').eq('user_id', user.id).single();

    if (tenantError || !tenantUser) {
      console.error('Tenant lookup error:', tenantError, 'user_id:', user.id);
      return new Response(JSON.stringify({ 
        error: 'No tenant found', 
        details: tenantError?.message || 'User not associated with any tenant' 
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Found tenant:', tenantUser.tenant_id, 'for user:', user.id);

    const method = req.method;
    let body: any = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch (e) {}

    if (method === 'GET') {
      const url = new URL(req.url);
      const table_id = url.searchParams.get('table_id');
      if (!table_id) {
        return new Response(JSON.stringify({ error: 'table_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: records, error } = await supabase.from('crm_records')
        .select('*').eq('table_id', table_id).eq('tenant_id', tenantUser.tenant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify(records), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (method === 'POST') {
      const { table_id, data: recordData, agency_id } = body;
      if (!table_id || !recordData) {
        return new Response(JSON.stringify({ error: 'table_id and data required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: record, error } = await supabase.from('crm_records').insert({
        table_id, tenant_id: tenantUser.tenant_id, agency_id: agency_id || null,
        data: recordData, created_by: user.id
      }).select().single();

      if (error) throw error;
      return new Response(JSON.stringify(record), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (method === 'PATCH') {
      const { record_id, data: recordData } = body;
      if (!record_id || !recordData) {
        return new Response(JSON.stringify({ error: 'record_id and data required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: existing } = await supabase.from('crm_records')
        .select('data, tenant_id').eq('id', record_id).single();

      if (!existing || existing.tenant_id !== tenantUser.tenant_id) {
        return new Response(JSON.stringify({ error: 'Record not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: record, error } = await supabase.from('crm_records')
        .update({ data: { ...existing.data, ...recordData } })
        .eq('id', record_id).select().single();

      if (error) throw error;
      return new Response(JSON.stringify(record), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (method === 'DELETE') {
      const { record_id } = body;
      if (!record_id) {
        return new Response(JSON.stringify({ error: 'record_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: record } = await supabase.from('crm_records')
        .select('tenant_id').eq('id', record_id).single();

      if (!record || record.tenant_id !== tenantUser.tenant_id) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { error } = await supabase.from('crm_records').delete().eq('id', record_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

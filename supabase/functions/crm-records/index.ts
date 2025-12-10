import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

// Helper to get date range for filtering
function getDateRange(filter: string): { startDate: string | null; endDate: string | null } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let startDate: string | null = null;
  let endDate: string | null = null;
  
  switch (filter) {
    case 'today':
      startDate = today.toISOString().split('T')[0];
      endDate = startDate;
      break;
    case 'yesterday':
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      startDate = yesterday.toISOString().split('T')[0];
      endDate = startDate;
      break;
    case 'this_week':
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(today.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
      startDate = startOfWeek.toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
      break;
    case 'last_7_days':
      startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
      break;
    case 'last_14_days':
      startDate = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
      break;
    case 'last_30_days':
      startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
      break;
    case 'this_month':
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = startOfMonth.toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
      break;
    case 'last_90_days':
      startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
      break;
    case 'last_180_days':
      startDate = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
      break;
    case 'last_365_days':
      startDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
      break;
  }
  
  return { startDate, endDate };
}

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

    const { data: tenantId, error: tenantError } = await supabase
      .rpc('get_user_tenant_id', { _user_id: user.id });

    if (tenantError || !tenantId) {
      console.error('Tenant lookup error:', tenantError, 'user_id:', user.id);
      return new Response(JSON.stringify({ 
        error: 'No tenant found', 
        details: tenantError?.message || 'User not associated with any tenant' 
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Found tenant:', tenantId, 'for user:', user.id);

    const method = req.method;
    let body: any = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch (e) {}

    if (method === 'GET') {
      const url = new URL(req.url);
      const table_id = url.searchParams.get('table_id');
      const date_filter = url.searchParams.get('date_filter');
      
      if (!table_id) {
        return new Response(JSON.stringify({ error: 'table_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // First get all records
      const { data: records, error } = await supabase.from('crm_records')
        .select('*')
        .eq('table_id', table_id)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter by date in data->'date' field if filter is provided
      let filteredRecords = records || [];
      
      if (date_filter && date_filter !== 'all') {
        const { startDate, endDate } = getDateRange(date_filter);
        
        if (startDate) {
          filteredRecords = filteredRecords.filter((record: any) => {
            const recordDate = record.data?.date;
            if (!recordDate) return false;
            
            // Compare dates as strings (YYYY-MM-DD format)
            if (endDate) {
              return recordDate >= startDate && recordDate <= endDate;
            }
            return recordDate >= startDate;
          });
        }
      }

      // Sort by date descending (newest first)
      filteredRecords.sort((a: any, b: any) => {
        const dateA = a.data?.date || '';
        const dateB = b.data?.date || '';
        return dateB.localeCompare(dateA);
      });

      return new Response(JSON.stringify(filteredRecords), {
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
        table_id, tenant_id: tenantId, agency_id: agency_id || null,
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

      if (!existing || existing.tenant_id !== tenantId) {
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

      if (!record || record.tenant_id !== tenantId) {
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

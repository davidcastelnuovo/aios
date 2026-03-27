import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

// Helper to get date range for filtering
function getDateRange(filter: string, customFrom?: string, customTo?: string): { startDate: string | null; endDate: string | null } {
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
      // Start of current week (Sunday)
      const dayOfWeek = now.getDay();
      const startOfThisWeek = new Date(today.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
      startDate = startOfThisWeek.toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
      break;
    case 'last_week':
      // Previous complete week (Sunday to Saturday)
      const currentDayOfWeek = now.getDay();
      const endOfLastWeek = new Date(today.getTime() - (currentDayOfWeek + 1) * 24 * 60 * 60 * 1000);
      const startOfLastWeek = new Date(endOfLastWeek.getTime() - 6 * 24 * 60 * 60 * 1000);
      startDate = startOfLastWeek.toISOString().split('T')[0];
      endDate = endOfLastWeek.toISOString().split('T')[0];
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
    case 'last_70_days':
      startDate = new Date(today.getTime() - 70 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
      break;
    case 'this_month':
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = startOfMonth.toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
      break;
    case 'last_month':
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      startDate = startOfLastMonth.toISOString().split('T')[0];
      endDate = endOfLastMonth.toISOString().split('T')[0];
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
    case 'custom':
      if (customFrom && customTo) {
        startDate = customFrom;
        endDate = customTo;
      }
      break;
  }
  
  return { startDate, endDate };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role to bypass RLS row limits for reading
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: tenantId, error: tenantError } = await supabaseAuth
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

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    console.log('🔑 Service role key available:', !!serviceRoleKey);
    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration: missing service role key' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role for data operations to bypass RLS row limits
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    );

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
      const date_from = url.searchParams.get('date_from');
      const date_to = url.searchParams.get('date_to');
      const aggregated = url.searchParams.get('aggregated');
      
      if (!table_id) {
        return new Response(JSON.stringify({ error: 'table_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Fetch table info to determine access and correct tenant_id for filtering
      const { data: tableInfo, error: tableError } = await supabase
        .from('crm_tables')
        .select('tenant_id, agency_id')
        .eq('id', table_id)
        .single();

      if (tableError || !tableInfo) {
        console.error('Table not found:', table_id);
        return new Response(JSON.stringify({ error: 'Table not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check access: user's tenant matches table's tenant OR table's agency is shared with user's tenant
      let hasAccess = tableInfo.tenant_id === tenantId;
      
      if (!hasAccess && tableInfo.agency_id) {
        // Check if this agency is shared with the user's tenant
        const { data: sharedAccess } = await supabase
          .from('agency_tenant_access')
          .select('id')
          .eq('agency_id', tableInfo.agency_id)
          .eq('accessing_tenant_id', tenantId)
          .limit(1);
        
        hasAccess = !!(sharedAccess && sharedAccess.length > 0);
      }

      if (!hasAccess) {
        console.error('Access denied: user tenant', tenantId, 'cannot access table from tenant', tableInfo.tenant_id);
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Use the TABLE's tenant_id for filtering records, not the user's tenant_id
      const effectiveTenantId = tableInfo.tenant_id;
      console.log(`📊 User tenant: ${tenantId}, Table tenant: ${effectiveTenantId}, Agency: ${tableInfo.agency_id}`);

      // Check if aggregated data is requested (for dashboards like Search Console)
      if (aggregated === 'search_console') {
        console.log(`📊 Fetching aggregated Search Console data for table ${table_id}`);
        
        const pageSize = 1000;
        const allRecords: any[] = [];
        
        for (let from = 0; ; from += pageSize) {
          const { data: page, error } = await supabase
            .from('crm_records')
            .select('id, data')
            .eq('table_id', table_id)
            .eq('tenant_id', effectiveTenantId)
            .range(from, from + pageSize - 1);

          if (error) throw error;
          if (!page || page.length === 0) break;
          allRecords.push(...page);
          if (page.length < pageSize) break;
        }

        console.log(`📊 Total records fetched: ${allRecords.length}`);

        // Aggregate by query
        const queryMap = new Map<string, { clicks: number; impressions: number; ctr: number; position: number; count: number }>();
        
        allRecords.forEach((r: any) => {
          const query = r.data?.query || '';
          const existing = queryMap.get(query) || { clicks: 0, impressions: 0, ctr: 0, position: 0, count: 0 };
          
          queryMap.set(query, {
            clicks: existing.clicks + (Number(r.data?.clicks) || 0),
            impressions: existing.impressions + (Number(r.data?.impressions) || 0),
            ctr: existing.ctr + (Number(r.data?.ctr) || 0),
            position: existing.position + (Number(r.data?.position) || 0),
            count: existing.count + 1,
          });
        });

        // Convert to array and calculate averages
        const queryData = Array.from(queryMap.entries()).map(([query, data]) => ({
          query,
          clicks: data.clicks,
          impressions: data.impressions,
          ctr: data.count > 0 ? data.ctr / data.count : 0,
          position: data.count > 0 ? data.position / data.count : 0,
        }));

        // Sort by impressions desc and take top 100
        queryData.sort((a, b) => b.impressions - a.impressions);
        const topQueries = queryData.slice(0, 100);

        // Calculate totals
        const totals = {
          clicks: queryData.reduce((sum, q) => sum + q.clicks, 0),
          impressions: queryData.reduce((sum, q) => sum + q.impressions, 0),
          avgCtr: queryData.length > 0 ? queryData.reduce((sum, q) => sum + q.ctr, 0) / queryData.length : 0,
          firstPageQueries: queryData.filter(q => q.position <= 10 && q.position > 0).length,
          totalQueries: queryData.length,
        };

        console.log(`📊 Aggregated ${queryData.length} unique queries, returning top 100. Totals: ${totals.clicks} clicks, ${totals.impressions} impressions`);

        return new Response(JSON.stringify({
          queries: topQueries,
          totals,
          totalRecords: allRecords.length,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch records with pagination (PostgREST enforces a 1000-row cap per request)
      const pageSize = 1000;
      const maxRows = 100000;
      const allRecords: any[] = [];

      for (let from = 0; from < maxRows; from += pageSize) {
        const to = from + pageSize - 1;

        const { data: page, error } = await supabase
          .from('crm_records')
          .select('*')
          .eq('table_id', table_id)
          .eq('tenant_id', effectiveTenantId)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;
        if (!page || page.length === 0) break;

        allRecords.push(...page);
        if (page.length < pageSize) break;
      }

      const records = allRecords;

      console.log(`📊 Fetched ${records?.length || 0} records for table ${table_id}`);

      // Filter by date in data->'date' field if filter is provided
      let filteredRecords = records || [];
      
      if (date_filter && date_filter !== 'all') {
        const { startDate, endDate } = getDateRange(date_filter, date_from || undefined, date_to || undefined);
        
        if (startDate) {
          filteredRecords = filteredRecords.filter((record: any) => {
            const recordDate = record.data?.date;
            // Keep records that don't have a date field (aggregated/summary records)
            if (!recordDate) return true;
            
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

      // Calculate totals for logging
      const totalClicks = filteredRecords.reduce((sum: number, r: any) => sum + (Number(r.data?.clicks) || 0), 0);
      const totalImpressions = filteredRecords.reduce((sum: number, r: any) => sum + (Number(r.data?.impressions) || 0), 0);
      console.log(`📈 Returning ${filteredRecords.length} records with ${totalClicks} clicks and ${totalImpressions} impressions`);

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

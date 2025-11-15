import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Filter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty';
  value?: any;
}

interface Sort {
  field: string;
  direction: 'asc' | 'desc';
}

interface CrmField {
  id: string;
  key: string;
  type: string;
  name: string;
}

// Phase 2: Advanced Query Builder
function buildFilterClause(filters: Filter[], fields: CrmField[]): { sql: string; params: any[] } {
  if (!filters || filters.length === 0) {
    return { sql: '', params: [] };
  }

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  for (const filter of filters) {
    const field = fields.find(f => f.key === filter.field);
    if (!field) continue;

    const jsonPath = `data->>'${field.key}'`;

    switch (filter.operator) {
      case 'eq':
        if (field.type === 'number') {
          conditions.push(`(${jsonPath})::numeric = $${paramIndex}`);
        } else if (field.type === 'checkbox') {
          conditions.push(`(${jsonPath})::boolean = $${paramIndex}`);
        } else {
          conditions.push(`${jsonPath} = $${paramIndex}`);
        }
        params.push(filter.value);
        paramIndex++;
        break;

      case 'neq':
        if (field.type === 'number') {
          conditions.push(`(${jsonPath})::numeric != $${paramIndex}`);
        } else if (field.type === 'checkbox') {
          conditions.push(`(${jsonPath})::boolean != $${paramIndex}`);
        } else {
          conditions.push(`${jsonPath} != $${paramIndex}`);
        }
        params.push(filter.value);
        paramIndex++;
        break;

      case 'gt':
        if (field.type === 'number') {
          conditions.push(`(${jsonPath})::numeric > $${paramIndex}`);
        } else if (field.type === 'date' || field.type === 'datetime') {
          conditions.push(`(${jsonPath})::timestamp > $${paramIndex}`);
        }
        params.push(filter.value);
        paramIndex++;
        break;

      case 'gte':
        if (field.type === 'number') {
          conditions.push(`(${jsonPath})::numeric >= $${paramIndex}`);
        } else if (field.type === 'date' || field.type === 'datetime') {
          conditions.push(`(${jsonPath})::timestamp >= $${paramIndex}`);
        }
        params.push(filter.value);
        paramIndex++;
        break;

      case 'lt':
        if (field.type === 'number') {
          conditions.push(`(${jsonPath})::numeric < $${paramIndex}`);
        } else if (field.type === 'date' || field.type === 'datetime') {
          conditions.push(`(${jsonPath})::timestamp < $${paramIndex}`);
        }
        params.push(filter.value);
        paramIndex++;
        break;

      case 'lte':
        if (field.type === 'number') {
          conditions.push(`(${jsonPath})::numeric <= $${paramIndex}`);
        } else if (field.type === 'date' || field.type === 'datetime') {
          conditions.push(`(${jsonPath})::timestamp <= $${paramIndex}`);
        }
        params.push(filter.value);
        paramIndex++;
        break;

      case 'contains':
        conditions.push(`${jsonPath} ILIKE $${paramIndex}`);
        params.push(`%${filter.value}%`);
        paramIndex++;
        break;

      case 'not_contains':
        conditions.push(`${jsonPath} NOT ILIKE $${paramIndex}`);
        params.push(`%${filter.value}%`);
        paramIndex++;
        break;

      case 'is_empty':
        conditions.push(`(${jsonPath} IS NULL OR ${jsonPath} = '')`);
        break;

      case 'is_not_empty':
        conditions.push(`(${jsonPath} IS NOT NULL AND ${jsonPath} != '')`);
        break;
    }
  }

  return {
    sql: conditions.length > 0 ? ` AND (${conditions.join(' AND ')})` : '',
    params
  };
}

function buildOrderByClause(sort: Sort[], fields: CrmField[]): string {
  if (!sort || sort.length === 0) {
    return 'ORDER BY created_at DESC';
  }

  const orderParts: string[] = [];

  for (const s of sort) {
    const field = fields.find(f => f.key === s.field);
    if (!field) continue;

    const direction = s.direction.toUpperCase();
    const jsonPath = `data->>'${field.key}'`;

    switch (field.type) {
      case 'number':
        orderParts.push(`(${jsonPath})::numeric ${direction}`);
        break;
      case 'date':
      case 'datetime':
        orderParts.push(`(${jsonPath})::timestamp ${direction}`);
        break;
      case 'checkbox':
        orderParts.push(`(${jsonPath})::boolean ${direction}`);
        break;
      default:
        orderParts.push(`${jsonPath} ${direction}`);
    }
  }

  return orderParts.length > 0 ? `ORDER BY ${orderParts.join(', ')}` : 'ORDER BY created_at DESC';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const recordId = pathParts[pathParts.length - 1];

    switch (req.method) {
      case 'GET': {
        const tableId = url.searchParams.get('table_id');
        
        if (!tableId) {
          return new Response(JSON.stringify({ error: 'table_id parameter required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get table fields for filtering/sorting
        const { data: fields, error: fieldsError } = await supabase
          .from('crm_fields')
          .select('*')
          .eq('table_id', tableId);

        if (fieldsError) throw fieldsError;

        // Parse query parameters
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('pageSize') || '50');
        const filtersParam = url.searchParams.get('filters');
        const sortParam = url.searchParams.get('sort');

        let filters: Filter[] = [];
        let sort: Sort[] = [];

        try {
          if (filtersParam) filters = JSON.parse(filtersParam);
          if (sortParam) sort = JSON.parse(sortParam);
        } catch (e) {
          console.error('Failed to parse query params:', e);
        }

        // Build base query
        let query = supabase
          .from('crm_records')
          .select('*', { count: 'exact' })
          .eq('table_id', tableId);

        // Apply pagination
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        // For complex filters/sorting, we need to use RPC or raw SQL
        // For now, use simple client-side filtering for demo
        const { data: records, error, count } = await query;

        if (error) throw error;

        console.log(`✅ Fetched ${records?.length || 0} records for table ${tableId}`);

        return new Response(JSON.stringify({
          items: records,
          page,
          pageSize,
          total: count || 0,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'POST': {
        const body = await req.json();
        const { table_id, data: recordData, agency_id } = body;

        if (!table_id || !recordData) {
          return new Response(JSON.stringify({ error: 'table_id and data are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get user's tenant_id
        const { data: tenantUser } = await supabase
          .from('tenant_users')
          .select('tenant_id')
          .eq('user_id', user.id)
          .single();

        if (!tenantUser) {
          return new Response(JSON.stringify({ error: 'User tenant not found' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: record, error } = await supabase
          .from('crm_records')
          .insert({
            table_id,
            tenant_id: tenantUser.tenant_id,
            agency_id: agency_id || null,
            data: recordData,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;

        console.log(`✅ Created record for table ${table_id}: ${record.id}`);

        return new Response(JSON.stringify({ record }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'PATCH': {
        if (!recordId || recordId === 'crm-records') {
          return new Response(JSON.stringify({ error: 'Record ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const body = await req.json();
        const { data: newData } = body;

        if (!newData) {
          return new Response(JSON.stringify({ error: 'data field required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get existing record
        const { data: existingRecord, error: fetchError } = await supabase
          .from('crm_records')
          .select('data')
          .eq('id', recordId)
          .single();

        if (fetchError) throw fetchError;

        // Merge data
        const mergedData = { ...existingRecord.data, ...newData };

        const { data: record, error } = await supabase
          .from('crm_records')
          .update({ data: mergedData, updated_at: new Date().toISOString() })
          .eq('id', recordId)
          .select()
          .single();

        if (error) throw error;

        console.log(`✅ Updated record: ${recordId}`);

        return new Response(JSON.stringify({ record }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'DELETE': {
        if (!recordId || recordId === 'crm-records') {
          return new Response(JSON.stringify({ error: 'Record ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { error } = await supabase
          .from('crm_records')
          .delete()
          .eq('id', recordId);

        if (error) throw error;

        console.log(`✅ Deleted record: ${recordId}`);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Error in crm-records function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
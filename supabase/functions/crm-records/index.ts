import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const lastPart = pathParts[pathParts.length - 1];
    const recordId = lastPart !== 'crm-records' ? lastPart : null;

    switch (req.method) {
      case 'GET': {
        const tableId = url.searchParams.get('table_id');
        
        if (!tableId) {
          return new Response(JSON.stringify({ error: 'table_id parameter required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('pageSize') || '50');

        let query = supabase
          .from('crm_records')
          .select('*', { count: 'exact' })
          .eq('table_id', tableId);

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data: records, error, count } = await query;

        if (error) throw error;

        console.log(`✅ Fetched ${records?.length || 0} records for table ${tableId}`);

        return new Response(JSON.stringify({
          items: records || [],
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
        if (!recordId) {
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

        const { data: existingRecord, error: fetchError } = await supabase
          .from('crm_records')
          .select('data')
          .eq('id', recordId)
          .single();

        if (fetchError) throw fetchError;

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
        if (!recordId) {
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
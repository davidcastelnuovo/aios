import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

const VALID_FIELD_TYPES = [
  'text', 'long_text', 'number', 'date', 'datetime', 'checkbox',
  'single_select', 'multi_select', 'reference', 'email', 'phone', 'url'
];

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

    switch (req.method) {
      case 'GET': {
        const tableId = url.searchParams.get('table_id');
        
        if (!tableId) {
          return new Response(JSON.stringify({ error: 'table_id parameter required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: fields, error } = await supabase
          .from('crm_fields')
          .select('*')
          .eq('table_id', tableId)
          .order('position', { ascending: true });

        if (error) throw error;

        console.log(`✅ Fetched ${fields?.length || 0} fields for table ${tableId}`);

        return new Response(JSON.stringify({ fields: fields || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'POST': {
        let body;
        try {
          const text = await req.text();
          body = text ? JSON.parse(text) : {};
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Support body JSON and fallback to query params for table_id
        const table_id = (body && body.table_id) ?? url.searchParams.get('table_id');
        const name = body?.name;
        const key = body?.key;
        const type = body?.type;
        const position = body?.position ?? 0;
        const is_required = body?.is_required ?? false;
        const is_visible = body?.is_visible ?? true;
        const config = body?.config ?? {};

        if (!table_id || !name || !key || !type) {
          return new Response(JSON.stringify({ error: 'table_id, name, key, and type are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!VALID_FIELD_TYPES.includes(type)) {
          return new Response(JSON.stringify({ error: `Invalid field type. Must be one of: ${VALID_FIELD_TYPES.join(', ')}` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: table, error: tableError } = await supabase
          .from('crm_tables')
          .select('id')
          .eq('id', table_id)
          .single();

        if (tableError || !table) {
          return new Response(JSON.stringify({ error: 'Table not found or access denied' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: field, error } = await supabase
          .from('crm_fields')
          .insert({
            table_id,
            name,
            key,
            type,
            position,
            is_required,
            is_visible,
            config,
          })
          .select()
          .single();

        if (error) {
          // Handle duplicate key gracefully
          // @ts-ignore - edge runtime error shape
          if (error.code === '23505') {
            return new Response(JSON.stringify({ error: 'Field key already exists for this table' }), {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          throw error;
        }

        console.log(`✅ Created field: ${name} (${key}) for table ${table_id}`);

        return new Response(JSON.stringify({ field }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'PATCH': {
        let body;
        try {
          const text = await req.text();
          body = text ? JSON.parse(text) : {};
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const { field_id, name, position, is_required, is_visible, config } = body;
        
        if (!field_id) {
          return new Response(JSON.stringify({ error: 'field_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const updateData: any = { updated_at: new Date().toISOString() };
        if (name) updateData.name = name;
        if (position !== undefined) updateData.position = position;
        if (is_required !== undefined) updateData.is_required = is_required;
        if (is_visible !== undefined) updateData.is_visible = is_visible;
        if (config !== undefined) updateData.config = config;

        const { data: field, error } = await supabase
          .from('crm_fields')
          .update(updateData)
          .eq('id', field_id)
          .select()
          .single();

        if (error) throw error;

        console.log(`✅ Updated field: ${field_id}`);

        return new Response(JSON.stringify({ field }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'DELETE': {
        let body;
        try {
          const text = await req.text();
          body = text ? JSON.parse(text) : {};
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const { field_id } = body;
        
        if (!field_id) {
          return new Response(JSON.stringify({ error: 'field_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { error } = await supabase
          .from('crm_fields')
          .delete()
          .eq('id', field_id);

        if (error) throw error;

        console.log(`✅ Deleted field: ${field_id}`);

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
    console.error('Error in crm-fields function:', error);
    const err: any = error as any;
    const errorMessage = (err && err.message) ? err.message : String(error) || 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage, details: err }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
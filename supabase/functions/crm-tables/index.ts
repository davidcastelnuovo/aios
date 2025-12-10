import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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
    const agencyIdFilter = url.searchParams.get('agency_id');

    switch (req.method) {
      case 'GET': {
        let query = supabase
          .from('crm_tables')
          .select('*')
          .order('category', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false });

        // Filter by agency_id if provided
        if (agencyIdFilter && agencyIdFilter !== 'all') {
          query = query.or(`agency_id.eq.${agencyIdFilter},agency_id.is.null`);
        }

        const { data: tables, error } = await query;

        if (error) throw error;

        console.log(`✅ Fetched ${tables?.length || 0} tables`);

        return new Response(JSON.stringify(tables || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'POST': {
        const body = await req.json();
        const { name, slug, description, icon, category, integration_type, integration_settings, agency_id, client_id } = body;

        if (!name || !slug) {
          return new Response(JSON.stringify({ error: 'Name and slug are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Use RPC function to get tenant_id (handles user_active_tenant fallback)
        const { data: tenantId, error: tenantError } = await supabase
          .rpc('get_user_tenant_id', { _user_id: user.id });

        if (tenantError || !tenantId) {
          console.error('Tenant lookup error:', tenantError);
          return new Response(JSON.stringify({ 
            error: 'User tenant not found. Please ensure you are assigned to a tenant.' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: table, error } = await supabase
          .from('crm_tables')
          .insert({
            tenant_id: tenantId,
            name,
            slug,
            description,
            icon,
            category,
            integration_type: integration_type || null,
            integration_settings: integration_settings || {},
            agency_id: agency_id || null,
            client_id: client_id || null,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;

        console.log(`✅ Created table: ${name} (${table.id})${integration_type ? ` [${integration_type}]` : ''} agency_id: ${agency_id || 'none'} client_id: ${client_id || 'none'}`);

        return new Response(JSON.stringify(table), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'PATCH': {
        const body = await req.json();
        const { table_id, name, slug, description, icon, category, agency_id, client_id } = body;

        if (!table_id) {
          return new Response(JSON.stringify({ error: 'Table ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const updateData: any = { updated_at: new Date().toISOString() };
        if (name) updateData.name = name;
        if (slug) updateData.slug = slug;
        if (description !== undefined) updateData.description = description;
        if (icon !== undefined) updateData.icon = icon;
        if (category !== undefined) updateData.category = category;
        if (agency_id !== undefined) updateData.agency_id = agency_id || null;
        if (client_id !== undefined) updateData.client_id = client_id || null;

        const { data: table, error } = await supabase
          .from('crm_tables')
          .update(updateData)
          .eq('id', table_id)
          .select()
          .single();

        if (error) throw error;

        console.log(`✅ Updated table: ${table_id}`);

        return new Response(JSON.stringify({ table }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'DELETE': {
        const body = await req.json();
        const { table_id } = body;
        
        if (!table_id) {
          return new Response(JSON.stringify({ error: 'Table ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { error } = await supabase
          .from('crm_tables')
          .delete()
          .eq('id', table_id);

        if (error) throw error;

        console.log(`✅ Deleted table: ${table_id}`);

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
    console.error('Error in crm-tables function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

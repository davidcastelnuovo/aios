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
    const tableId = lastPart !== 'crm-tables' ? lastPart : null;

    switch (req.method) {
      case 'GET': {
        const { data: tables, error } = await supabase
          .from('crm_tables')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        console.log(`✅ Fetched ${tables?.length || 0} tables`);

        return new Response(JSON.stringify({ tables: tables || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'POST': {
        const body = await req.json();
        const { name, slug, description, icon } = body;

        if (!name || !slug) {
          return new Response(JSON.stringify({ error: 'Name and slug are required' }), {
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

        const { data: table, error } = await supabase
          .from('crm_tables')
          .insert({
            tenant_id: tenantUser.tenant_id,
            name,
            slug,
            description,
            icon,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;

        console.log(`✅ Created table: ${name} (${table.id})`);

        return new Response(JSON.stringify({ table }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'PATCH': {
        if (!tableId) {
          return new Response(JSON.stringify({ error: 'Table ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const body = await req.json();
        const { name, slug, description, icon } = body;

        const updateData: any = { updated_at: new Date().toISOString() };
        if (name) updateData.name = name;
        if (slug) updateData.slug = slug;
        if (description !== undefined) updateData.description = description;
        if (icon !== undefined) updateData.icon = icon;

        const { data: table, error } = await supabase
          .from('crm_tables')
          .update(updateData)
          .eq('id', tableId)
          .select()
          .single();

        if (error) throw error;

        console.log(`✅ Updated table: ${tableId}`);

        return new Response(JSON.stringify({ table }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'DELETE': {
        if (!tableId) {
          return new Response(JSON.stringify({ error: 'Table ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { error } = await supabase
          .from('crm_tables')
          .delete()
          .eq('id', tableId);

        if (error) throw error;

        console.log(`✅ Deleted table: ${tableId}`);

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
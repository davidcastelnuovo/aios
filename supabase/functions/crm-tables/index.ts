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
        // Get user's tenant_id for filtering
        const { data: tenantId } = await supabase
          .rpc('get_user_tenant_id', { _user_id: user.id });

        // Foreign agencies shared into our tenant
        const { data: sharedAgencies } = await supabase
          .from('agency_tenant_access')
          .select('agency_id')
          .eq('accessing_tenant_id', tenantId);
        const sharedAgencyIds = sharedAgencies?.map(sa => sa.agency_id) || [];

        // Agencies OWNED by our tenant (to catch tables created in another tenant
        // but linked to one of our agencies — e.g. cross-tenant user added a table
        // from their own tenant context but assigned it to our agency).
        const { data: ownedAgencies } = await supabase
          .from('agencies')
          .select('id')
          .eq('tenant_id', tenantId);
        const ownedAgencyIds = ownedAgencies?.map(a => a.id) || [];

        let allTables: any[] = [];

        // 1) Tables from user's own tenant
        let ownQuery = supabase
          .from('crm_tables')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('category', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false });

        if (agencyIdFilter && agencyIdFilter !== 'all') {
          ownQuery = ownQuery.or(`agency_id.eq.${agencyIdFilter},agency_id.is.null`);
        }

        const { data: ownTables, error: ownError } = await ownQuery;
        if (ownError) throw ownError;
        allTables = ownTables || [];

        // 2) Tables in foreign tenants from shared agencies
        if (sharedAgencyIds.length > 0) {
          let sharedQuery = supabase
            .from('crm_tables')
            .select('*')
            .neq('tenant_id', tenantId)
            .in('agency_id', sharedAgencyIds)
            .order('category', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: false });

          if (agencyIdFilter && agencyIdFilter !== 'all') {
            sharedQuery = sharedQuery.eq('agency_id', agencyIdFilter);
          }

          const { data: sharedTables, error: sharedError } = await sharedQuery;
          if (sharedError) {
            console.error('Error fetching shared tables:', sharedError);
          } else if (sharedTables) {
            allTables = [...allTables, ...sharedTables];
          }
        }

        // 3) Tables in foreign tenants linked to agencies WE own
        if (ownedAgencyIds.length > 0) {
          let ownedForeignQuery = supabase
            .from('crm_tables')
            .select('*')
            .neq('tenant_id', tenantId)
            .in('agency_id', ownedAgencyIds)
            .order('category', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: false });

          if (agencyIdFilter && agencyIdFilter !== 'all') {
            ownedForeignQuery = ownedForeignQuery.eq('agency_id', agencyIdFilter);
          }

          const { data: ownedForeignTables, error: ownedForeignError } = await ownedForeignQuery;
          if (ownedForeignError) {
            console.error('Error fetching owned-agency foreign tables:', ownedForeignError);
          } else if (ownedForeignTables) {
            allTables = [...allTables, ...ownedForeignTables];
          }
        }

        // Dedupe by id
        const seen = new Set<string>();
        allTables = allTables.filter(t => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });

        return new Response(JSON.stringify(allTables), {
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

        // Resolve tenant_id: prefer the owning tenant of the selected agency, so a table
        // created by a cross-tenant user lives under the agency's tenant (and shows up
        // there without relying on cross-tenant lookups).
        let tenantId: string | null = null;
        if (agency_id) {
          const { data: agencyRow } = await supabase
            .from('agencies')
            .select('tenant_id')
            .eq('id', agency_id)
            .maybeSingle();
          tenantId = agencyRow?.tenant_id ?? null;
        }
        if (!tenantId) {
          const { data: fallbackTenantId, error: tenantError } = await supabase
            .rpc('get_user_tenant_id', { _user_id: user.id });
          if (tenantError || !fallbackTenantId) {
            console.error('Tenant lookup error:', tenantError);
            return new Response(JSON.stringify({
              error: 'User tenant not found. Please ensure you are assigned to a tenant.'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          tenantId = fallbackTenantId;
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


        return new Response(JSON.stringify(table), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'PATCH': {
        const body = await req.json();
        const { table_id, name, slug, description, icon, category, agency_id, client_id, integration_settings } = body;

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
        if (integration_settings !== undefined) {
          // Merge with existing integration_settings to avoid overwriting
          const { data: existingTable } = await supabase
            .from('crm_tables')
            .select('integration_settings')
            .eq('id', table_id)
            .single();
          
          updateData.integration_settings = {
            ...(existingTable?.integration_settings as Record<string, unknown> || {}),
            ...integration_settings,
          };
        }

        const { data: table, error } = await supabase
          .from('crm_tables')
          .update(updateData)
          .eq('id', table_id)
          .select()
          .single();

        if (error) throw error;


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

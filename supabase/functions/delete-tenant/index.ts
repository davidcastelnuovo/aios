import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteTenantRequest {
  tenant_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { tenant_id }: DeleteTenantRequest = await req.json();
    
    if (!tenant_id) {
      throw new Error('tenant_id is required');
    }

    console.log(`Delete tenant request from user ${user.id} for tenant ${tenant_id}`);

    // Check user permissions
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role, tenant_id')
      .eq('user_id', user.id);

    if (rolesError) throw rolesError;

    const isSuperAdmin = userRoles?.some(r => r.role === 'super_admin' && r.tenant_id === null);
    const isOwner = userRoles?.some(r => r.role === 'owner' && r.tenant_id === tenant_id);

    if (!isSuperAdmin && !isOwner) {
      throw new Error('Only super admins or tenant owners can delete tenants');
    }

    // Check for children
    const { data: children, error: childrenError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('parent_tenant_id', tenant_id);

    if (childrenError) throw childrenError;

    if (children && children.length > 0) {
      throw new Error(`Cannot delete tenant with ${children.length} sub-organizations. Please delete them first.`);
    }

    // Get tenant info before deletion
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, org_type')
      .eq('id', tenant_id)
      .single();

    console.log(`Deleting tenant: ${tenant?.name} (${tenant?.org_type})`);

    // Start cascading deletion (order matters for foreign keys)
    
    // 1. Delete time entries
    await supabase.from('time_entries').delete().eq('tenant_id', tenant_id);
    
    // 2. Delete import history
    await supabase.from('import_history').delete().eq('tenant_id', tenant_id);
    
    // 3. Delete task updates (via tasks)
    const { data: tasks } = await supabase.from('tasks').select('id').eq('tenant_id', tenant_id);
    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map(t => t.id);
      await supabase.from('task_updates').delete().in('task_id', taskIds);
    }
    
    // 4. Delete tasks
    await supabase.from('tasks').delete().eq('tenant_id', tenant_id);
    
    // 5. Delete lead updates (via leads)
    const { data: leads } = await supabase.from('leads').select('id').eq('tenant_id', tenant_id);
    if (leads && leads.length > 0) {
      const leadIds = leads.map(l => l.id);
      await supabase.from('lead_updates').delete().in('lead_id', leadIds);
    }
    
    // 6. Delete leads
    await supabase.from('leads').delete().eq('tenant_id', tenant_id);
    
    // 7. Delete client onboarding
    await supabase.from('client_onboarding').delete().eq('tenant_id', tenant_id);
    
    // 8. Delete client team (via clients)
    const { data: clients } = await supabase.from('clients').select('id').eq('tenant_id', tenant_id);
    if (clients && clients.length > 0) {
      const clientIds = clients.map(c => c.id);
      await supabase.from('client_team').delete().in('client_id', clientIds);
      await supabase.from('client_suppliers').delete().in('client_id', clientIds);
      await supabase.from('client_tenant_financial_data').delete().eq('tenant_id', tenant_id);
    }
    
    // 9. Delete clients
    await supabase.from('clients').delete().eq('tenant_id', tenant_id);
    
    // 10. Delete campaigner agencies (via campaigners)
    const { data: campaigners } = await supabase.from('campaigners').select('id').eq('tenant_id', tenant_id);
    if (campaigners && campaigners.length > 0) {
      const campaignerIds = campaigners.map(c => c.id);
      await supabase.from('campaigner_agencies').delete().in('campaigner_id', campaignerIds);
    }
    
    // 11. Delete campaigners
    await supabase.from('campaigners').delete().eq('tenant_id', tenant_id);
    
    // 12. Delete sales person agencies (via sales people)
    const { data: salesPeople } = await supabase.from('sales_people').select('id').eq('tenant_id', tenant_id);
    if (salesPeople && salesPeople.length > 0) {
      const salesPersonIds = salesPeople.map(sp => sp.id);
      await supabase.from('sales_person_agencies').delete().in('sales_person_id', salesPersonIds);
    }
    
    // 13. Delete sales people
    await supabase.from('sales_people').delete().eq('tenant_id', tenant_id);
    
    // 14. Delete suppliers
    await supabase.from('suppliers').delete().eq('tenant_id', tenant_id);
    
    // 15. Delete products
    await supabase.from('products').delete().eq('tenant_id', tenant_id);
    
    // 16. Delete agency tenant access
    await supabase.from('agency_tenant_access').delete().eq('source_tenant_id', tenant_id);
    await supabase.from('agency_tenant_access').delete().eq('accessing_tenant_id', tenant_id);
    
    // 17. Delete agencies
    await supabase.from('agencies').delete().eq('tenant_id', tenant_id);
    
    // 18. Delete automations and logs
    const { data: automations } = await supabase.from('automations').select('id').eq('tenant_id', tenant_id);
    if (automations && automations.length > 0) {
      const automationIds = automations.map(a => a.id);
      await supabase.from('automation_logs').delete().in('automation_id', automationIds);
    }
    await supabase.from('automations').delete().eq('tenant_id', tenant_id);
    
    // 19. Delete tenant integrations
    await supabase.from('tenant_integrations').delete().eq('tenant_id', tenant_id);
    
    // 20. Delete tenant settings
    await supabase.from('tenant_settings').delete().eq('tenant_id', tenant_id);
    
    // 21. Delete custom fields
    await supabase.from('custom_fields').delete().eq('tenant_id', tenant_id);
    
    // 22. Delete menu items
    await supabase.from('menu_items').delete().eq('tenant_id', tenant_id);
    
    // 23. Delete invitation tokens
    await supabase.from('invitation_tokens').delete().eq('tenant_id', tenant_id);
    
    // 24. Delete user managed agencies
    const { data: tenantUsers } = await supabase
      .from('tenant_users')
      .select('user_id')
      .eq('tenant_id', tenant_id);
    
    if (tenantUsers && tenantUsers.length > 0) {
      const userIds = tenantUsers.map(tu => tu.user_id);
      
      // Delete managed agencies for these users
      await supabase.from('user_managed_agencies').delete().in('user_id', userIds);
    }
    
    // 25. Delete user roles (only tenant-specific roles!)
    await supabase.from('user_roles').delete().eq('tenant_id', tenant_id);
    
    // 26. Delete user active tenant
    await supabase.from('user_active_tenant').delete().eq('tenant_id', tenant_id);
    
    // 27. Delete tenant users
    await supabase.from('tenant_users').delete().eq('tenant_id', tenant_id);
    
    // 28. Finally, delete the tenant itself
    const { error: deleteTenantError } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenant_id);

    if (deleteTenantError) throw deleteTenantError;

    console.log(`Successfully deleted tenant ${tenant_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Tenant "${tenant?.name}" deleted successfully`,
        deleted_tenant_id: tenant_id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error deleting tenant:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: 'Failed to delete tenant. Please check logs.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

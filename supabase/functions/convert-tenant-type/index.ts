import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConvertTenantRequest {
  tenant_id: string;
  new_org_type: 'organization' | 'sub_organization';
  new_parent_id?: string;
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

    const { tenant_id, new_org_type, new_parent_id }: ConvertTenantRequest = await req.json();
    
    if (!tenant_id || !new_org_type) {
      throw new Error('tenant_id and new_org_type are required');
    }

    console.log(`Convert tenant request from user ${user.id} for tenant ${tenant_id} to ${new_org_type}`);

    // Check user permissions - only super_admin can convert
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role, tenant_id')
      .eq('user_id', user.id);

    if (rolesError) throw rolesError;

    const isSuperAdmin = userRoles?.some(r => r.role === 'super_admin' && r.tenant_id === null);

    if (!isSuperAdmin) {
      throw new Error('Only super admins can convert tenant types');
    }

    // Get current tenant info
    const { data: currentTenant, error: tenantError } = await supabase
      .from('tenants')
      .select('name, org_type, parent_tenant_id')
      .eq('id', tenant_id)
      .single();

    if (tenantError) throw tenantError;
    if (!currentTenant) throw new Error('Tenant not found');

    // Cannot convert to root (only created as root)
    if (new_org_type === 'root' as any) {
      throw new Error('Cannot convert to root organization. Root organizations must be created as such.');
    }

    // Validate conversion based on children
    const { data: children, error: childrenError } = await supabase
      .from('tenants')
      .select('id, name, org_type')
      .eq('parent_tenant_id', tenant_id);

    if (childrenError) throw childrenError;

    // If converting to sub_organization, cannot have children
    if (new_org_type === 'sub_organization' && children && children.length > 0) {
      throw new Error(`Cannot convert to sub-organization while having ${children.length} child organizations. Please reassign or delete them first.`);
    }

    // If converting to sub_organization, must provide parent_id
    if (new_org_type === 'sub_organization' && !new_parent_id) {
      throw new Error('new_parent_id is required when converting to sub-organization');
    }

    // If converting to sub_organization, validate parent is not sub_organization
    if (new_org_type === 'sub_organization' && new_parent_id) {
      const { data: parentTenant } = await supabase
        .from('tenants')
        .select('org_type')
        .eq('id', new_parent_id)
        .single();

      if (parentTenant?.org_type === 'sub_organization') {
        throw new Error('Cannot set a sub-organization as parent. Parent must be root or organization.');
      }
    }

    // If converting from sub_organization to organization, clear parent_id
    const updates: any = {
      org_type: new_org_type,
    };

    if (new_org_type === 'organization') {
      updates.parent_tenant_id = null;
    } else if (new_org_type === 'sub_organization' && new_parent_id) {
      updates.parent_tenant_id = new_parent_id;
    }

    // Perform the update
    const { error: updateError } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', tenant_id);

    if (updateError) throw updateError;

    console.log(`Successfully converted tenant ${tenant_id} from ${currentTenant.org_type} to ${new_org_type}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Tenant "${currentTenant.name}" converted from ${currentTenant.org_type} to ${new_org_type}`,
        tenant_id,
        old_type: currentTenant.org_type,
        new_type: new_org_type,
        new_parent_id: updates.parent_tenant_id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error converting tenant type:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: 'Failed to convert tenant type. Please check logs.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

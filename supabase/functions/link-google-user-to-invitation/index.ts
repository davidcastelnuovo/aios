import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinkRequest {
  token: string;
  user_id: string;
  email: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables');
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, user_id, email }: LinkRequest = await req.json();

    console.log('Received request:', { token, user_id, email });

    // Validate inputs
    if (!token || !user_id || !email) {
      console.error('Missing required fields:', { token: !!token, user_id: !!user_id, email: !!email });
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify invitation token
    const { data: invitation, error: inviteError } = await supabase
      .from('invitation_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .maybeSingle();

    if (inviteError || !invitation) {
      console.error('Invitation verification error:', inviteError);
      return new Response(
        JSON.stringify({ error: 'Invalid or used invitation token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token has expired
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Invitation token has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If invitation has a specific email, verify it matches
    if (invitation.email && invitation.email !== email) {
      return new Response(
        JSON.stringify({ error: 'Email does not match invitation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract metadata from invitation
    const metadata = invitation.metadata || {};
    const fullName = metadata.full_name || '';
    const role = metadata.role || 'campaigner';
    const agencyIds = metadata.agencyIds || [];
    const modulePermissions = metadata.modulePermissions || [];
    const campaignerId = metadata.campaignerId || null;
    const salesPersonId = metadata.salesPersonId || null;

    // Update user profile - use update instead of upsert since profile should already exist from trigger
    console.log('Updating profile for user:', user_id, {
      full_name: fullName,
      campaigner_id: campaignerId,
      sales_person_id: salesPersonId,
    });

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        campaigner_id: campaignerId,
        sales_person_id: salesPersonId,
      })
      .eq('id', user_id);

    if (profileError) {
      console.error('Profile update error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to update profile: ' + profileError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Profile updated successfully');

    // Delete existing user roles
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', user_id);

    // Insert new role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: user_id,
        role: role,
      });

    if (roleError) {
      console.error('Role assignment error:', roleError);
      return new Response(
        JSON.stringify({ error: 'Failed to assign role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clear existing permissions
    await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', user_id);

    // Insert new permissions
    if (modulePermissions && modulePermissions.length > 0) {
      const permissionsToInsert = modulePermissions.map((permission: any) => ({
        user_id: user_id,
        module: permission.module,
        can_access: permission.can_access,
      }));

      const { error: permError } = await supabase
        .from('user_permissions')
        .insert(permissionsToInsert);

      if (permError) {
        console.error('Permissions assignment error:', permError);
        // Don't fail if permissions assignment fails
      }
    }

    // Link campaigner to agencies if applicable
    if (campaignerId && agencyIds && agencyIds.length > 0) {
      const agencyLinks = agencyIds.map((agencyId: string) => ({
        campaigner_id: campaignerId,
        agency_id: agencyId,
      }));

      const { error: agencyError } = await supabase
        .from('campaigner_agencies')
        .insert(agencyLinks);

      if (agencyError) {
        console.error('Campaigner-agency link error:', agencyError);
        // Don't fail if linking fails
      }
    }

    // Add user to tenant if tenant_id exists in invitation
    if (invitation.tenant_id) {
      const { error: tenantError } = await supabase
        .from('tenant_users')
        .insert({
          user_id: user_id,
          tenant_id: invitation.tenant_id,
        });

      if (tenantError) {
        console.error('Tenant assignment error:', tenantError);
        // Don't fail if tenant assignment fails
      }
    }

    // Mark invitation as used
    const { error: updateError } = await supabase
      .from('invitation_tokens')
      .update({
        used: true,
        used_at: new Date().toISOString(),
        used_by_user_id: user_id,
      })
      .eq('token', token);

    if (updateError) {
      console.error('Token update error:', updateError);
      // Don't fail if token update fails
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Link google user error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

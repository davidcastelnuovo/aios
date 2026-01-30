import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tenantId, tagId = 79380109, resetFirst = false } = await req.json();

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing tenantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if there's already a running job for this tenant
    const { data: existingJob } = await supabase
      .from('sync_jobs')
      .select('id, status')
      .eq('tenant_id', tenantId)
      .eq('job_type', 'manychat_sync')
      .in('status', ['pending', 'running'])
      .maybeSingle();

    if (existingJob) {
      return new Response(
        JSON.stringify({ error: 'A sync job is already running', jobId: existingJob.id }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If resetFirst, reset all manychat_subscriber_id for this tenant (including conflicts)
    if (resetFirst) {
      console.log('Resetting all manychat_subscriber_id for tenant', tenantId);
      // Reset NULL leads
      await supabase
        .from('leads')
        .update({ manychat_subscriber_id: null })
        .eq('tenant_id', tenantId)
        .is('manychat_subscriber_id', null);
      
      // Reset SYNC_CONFLICT leads
      await supabase
        .from('leads')
        .update({ manychat_subscriber_id: null })
        .eq('tenant_id', tenantId)
        .eq('manychat_subscriber_id', 'SYNC_CONFLICT');
      
      // Reset NEEDS_MANUAL_LINK leads
      await supabase
        .from('leads')
        .update({ manychat_subscriber_id: null })
        .eq('tenant_id', tenantId)
        .eq('manychat_subscriber_id', 'NEEDS_MANUAL_LINK');
        
      console.log('Reset complete for tenant', tenantId);
    }

    // Count total leads to sync
    const { count: totalLeads } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('manychat_subscriber_id', null)
      .not('phone', 'is', null);

    if (!totalLeads || totalLeads === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No leads to sync', jobId: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create sync job
    const { data: job, error: jobError } = await supabase
      .from('sync_jobs')
      .insert({
        tenant_id: tenantId,
        job_type: 'manychat_sync',
        status: 'pending',
        progress: {
          processed: 0,
          failed: 0,
          remaining: totalLeads,
          conflicts: 0,
          total: totalLeads,
          results: [],
        },
        settings: {
          tagId,
          delayMs: 1000,
        },
      })
      .select()
      .single();

    if (jobError) {
      console.error('Failed to create job:', jobError);
      return new Response(
        JSON.stringify({ error: 'Failed to create sync job', details: jobError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Created sync job:', job.id);

    // Trigger run-sync-job in background (fire and forget)
    const runUrl = `${supabaseUrl}/functions/v1/run-sync-job`;
    fetch(runUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ jobId: job.id }),
    }).catch((err) => {
      console.error('Failed to trigger run-sync-job:', err);
    });

    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        totalLeads,
        message: 'Sync job started. You can close this tab.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Start sync error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

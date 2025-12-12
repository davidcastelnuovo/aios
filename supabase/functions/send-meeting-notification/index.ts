import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      tenantId, 
      leadId, 
      clientId, 
      contactName,
      meetingDate, 
      meetingTime, 
      meetingLocation 
    } = await req.json();

    if (!tenantId || (!leadId && !clientId)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: tenantId and (leadId or clientId)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sending meeting notification:', { tenantId, leadId, clientId, contactName, meetingDate, meetingTime, meetingLocation });

    // Get ManyChat integration with settings
    const { data: integration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('api_key, is_active, settings')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'manychat')
      .maybeSingle();

    if (integrationError) {
      console.error('Error fetching integration:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch integration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!integration || !integration.is_active || !integration.api_key) {
      console.log('ManyChat integration not active or API key missing');
      return new Response(
        JSON.stringify({ error: 'ManyChat integration not configured', skipped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get subscriber_id from lead or client
    let subscriberId: string | null = null;
    
    if (leadId) {
      const { data: lead } = await supabase
        .from('leads')
        .select('manychat_subscriber_id')
        .eq('id', leadId)
        .maybeSingle();
      subscriberId = lead?.manychat_subscriber_id;
    } else if (clientId) {
      const { data: client } = await supabase
        .from('clients')
        .select('manychat_subscriber_id')
        .eq('id', clientId)
        .maybeSingle();
      subscriberId = client?.manychat_subscriber_id;
    }

    if (!subscriberId) {
      console.log('No ManyChat subscriber ID found for lead/client');
      return new Response(
        JSON.stringify({ error: 'No ManyChat subscriber ID found', skipped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found subscriber ID:', subscriberId);

    // Get settings for custom field IDs and trigger name
    const settings = integration.settings as Record<string, any> || {};
    const triggerName = settings.meeting_trigger_name || 'meeting_scheduled';
    
    // Custom field IDs - these need to be configured in ManyChat settings
    const customFieldIds = settings.meeting_custom_fields || {};

    // Step 1: Set custom fields if field IDs are configured
    const fieldUpdates = [];
    
    if (customFieldIds.meeting_date && meetingDate) {
      fieldUpdates.push({
        field_id: parseInt(customFieldIds.meeting_date),
        field_value: meetingDate
      });
    }
    
    if (customFieldIds.meeting_time && meetingTime) {
      fieldUpdates.push({
        field_id: parseInt(customFieldIds.meeting_time),
        field_value: meetingTime
      });
    }
    
    if (customFieldIds.meeting_location && meetingLocation) {
      fieldUpdates.push({
        field_id: parseInt(customFieldIds.meeting_location),
        field_value: meetingLocation
      });
    }
    
    if (customFieldIds.contact_name && contactName) {
      fieldUpdates.push({
        field_id: parseInt(customFieldIds.contact_name),
        field_value: contactName
      });
    }

    // Update custom fields in ManyChat
    for (const fieldUpdate of fieldUpdates) {
      console.log('Setting custom field:', fieldUpdate);
      const fieldResponse = await fetch('https://api.manychat.com/fb/subscriber/setCustomField', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriber_id: subscriberId,
          field_id: fieldUpdate.field_id,
          field_value: fieldUpdate.field_value,
        }),
      });

      if (!fieldResponse.ok) {
        const errorText = await fieldResponse.text();
        console.error('Failed to set custom field:', errorText);
        // Continue with other fields even if one fails
      } else {
        console.log('Custom field set successfully');
      }
    }

    // Step 2: Trigger the automation flow
    console.log('Triggering automation:', triggerName);
    
    // Use the sendFlow endpoint with the trigger
    const triggerResponse = await fetch('https://api.manychat.com/fb/sending/sendFlow', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: subscriberId,
        flow_ns: triggerName, // This is the flow namespace/trigger name
      }),
    });

    if (!triggerResponse.ok) {
      const errorText = await triggerResponse.text();
      console.error('Failed to trigger automation:', errorText);
      
      // If flow not found, try with external trigger endpoint
      console.log('Trying external trigger...');
      const externalTriggerResponse = await fetch(`https://api.manychat.com/fb/subscriber/triggerFlow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriber_id: subscriberId,
          flow_ns: triggerName,
        }),
      });

      if (!externalTriggerResponse.ok) {
        const extErrorText = await externalTriggerResponse.text();
        console.error('External trigger also failed:', extErrorText);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to trigger automation',
            details: extErrorText,
            fieldsUpdated: fieldUpdates.length 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Meeting notification sent successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Meeting notification sent',
        fieldsUpdated: fieldUpdates.length,
        automationTriggered: triggerName
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-meeting-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

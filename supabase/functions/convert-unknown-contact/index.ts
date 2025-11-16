import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { senderPhone, contactId, contactType, tenantId } = await req.json();

    if (!senderPhone || !contactId || !contactType || !tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('🔄 Converting unknown contact:', { senderPhone, contactId, contactType, tenantId });

    // Update all messages from this sender_phone to the new contact
    const updateData: any = {
      [contactType === 'client' ? 'client_id' : 'lead_id']: contactId,
    };

    const { data, error } = await supabaseClient
      .from('chat_messages')
      .update(updateData)
      .eq('sender_phone', senderPhone)
      .eq('tenant_id', tenantId)
      .is('client_id', null)
      .is('lead_id', null)
      .select();

    if (error) {
      console.error('❌ Failed to update messages:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Successfully updated', data?.length || 0, 'messages');

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated_count: data?.length || 0,
        contact_id: contactId,
        contact_type: contactType
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

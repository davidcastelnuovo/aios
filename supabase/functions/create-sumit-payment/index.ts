import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentRequest {
  clientId: string;
  amount: number;
  description: string;
  sendEmail: boolean;
  expirationDays?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token for RLS
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user info
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Error getting user:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clientId, amount, description, sendEmail, expirationDays = 30 }: PaymentRequest = await req.json();

    console.log('Creating payment link for client:', clientId, 'amount:', amount);

    // Get user's tenant
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (tenantError || !tenantUser) {
      console.error('Error getting tenant:', tenantError);
      return new Response(
        JSON.stringify({ error: 'Could not find user tenant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = tenantUser.tenant_id;

    // Get client details
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email, phone, contact_name')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .single();

    if (clientError || !client) {
      console.error('Error getting client:', clientError);
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Sumit integration settings
    const { data: integration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('settings')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'sumit')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.error('Error getting Sumit integration:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Sumit integration not configured. Please set up Sumit in Accounting Settings.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sumitSettings = integration.settings as { api_key?: string; company_id?: string };
    const apiKey = sumitSettings?.api_key;
    const companyId = sumitSettings?.company_id;

    if (!apiKey || !companyId) {
      console.error('Missing Sumit credentials');
      return new Response(
        JSON.stringify({ error: 'Missing Sumit API Key or Company ID. Please configure in Accounting Settings.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare Sumit API request
    const sumitPayload = {
      CompanyID: companyId,
      APIKey: apiKey,
      Credentials: {
        CompanyID: parseInt(companyId),
        APIKey: apiKey
      },
      Customer: {
        Name: client.contact_name || client.name,
        EmailAddress: client.email || '',
        Phone: client.phone || ''
      },
      Items: [{
        Description: description,
        UnitPrice: amount,
        Quantity: 1
      }],
      SendEmail: sendEmail,
      MaxNumberOfPayments: 12,
      ExpirationDays: expirationDays,
      Language: 'he',
      Currency: 'ILS'
    };

    console.log('Calling Sumit API with payload:', JSON.stringify(sumitPayload, null, 2));

    // Call Sumit API
    const sumitResponse = await fetch('https://api.sumit.co.il/billing/payments/paymentpage/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sumitPayload)
    });

    const sumitResult = await sumitResponse.json();
    console.log('Sumit API response:', JSON.stringify(sumitResult, null, 2));

    if (!sumitResponse.ok || sumitResult.Status === 'Error' || !sumitResult.Data?.PaymentPageUrl) {
      const errorMessage = sumitResult.UserErrorMessage || sumitResult.TechnicalErrorDetails || 'Unknown Sumit API error';
      console.error('Sumit API error:', errorMessage);
      return new Response(
        JSON.stringify({ error: `Sumit API error: ${errorMessage}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentUrl = sumitResult.Data.PaymentPageUrl;
    const sumitPaymentId = sumitResult.Data.PaymentPageID?.toString() || null;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    // Save payment link to database
    const { data: paymentLink, error: saveError } = await supabase
      .from('payment_links')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        amount: amount,
        description: description,
        payment_url: paymentUrl,
        sumit_payment_id: sumitPaymentId,
        status: 'pending',
        send_email: sendEmail,
        expires_at: expiresAt.toISOString(),
        created_by: user.id
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving payment link:', saveError);
      // Still return success since Sumit payment was created
    }

    console.log('Payment link created successfully:', paymentUrl);

    return new Response(
      JSON.stringify({
        success: true,
        paymentUrl: paymentUrl,
        paymentId: paymentLink?.id || sumitPaymentId,
        expiresAt: expiresAt.toISOString(),
        emailSent: sendEmail && !!client.email
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating payment link:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
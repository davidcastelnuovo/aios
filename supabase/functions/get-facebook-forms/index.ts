import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { tenant_id, page_id, access_token } = await req.json();

    console.log('Fetching Facebook forms for page:', page_id);

    if (!access_token) {
      return new Response(JSON.stringify({ error: 'Access token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If no page_id provided, first get the pages the user has access to
    if (!page_id) {
      const url = `https://graph.facebook.com/v21.0/me/accounts?access_token=${access_token}&fields=id,name,access_token`;
      console.log('Fetching pages from URL (token hidden)');
      
      const pagesResponse = await fetch(url);
      const pagesData = await pagesResponse.json();
      
      console.log('Facebook API response status:', pagesResponse.status);
      console.log('Facebook API response:', JSON.stringify(pagesData));

      if (!pagesResponse.ok || pagesData.error) {
        console.error('Error fetching pages:', pagesData.error || pagesData);
        return new Response(JSON.stringify({ 
          error: 'Failed to fetch pages', 
          details: pagesData.error || pagesData 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Pages found:', pagesData.data?.length || 0);

      return new Response(JSON.stringify({ pages: pagesData.data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch lead forms for the specified page
    const formsResponse = await fetch(
      `https://graph.facebook.com/v21.0/${page_id}/leadgen_forms?access_token=${access_token}&fields=id,name,status,questions`
    );

    if (!formsResponse.ok) {
      const errorData = await formsResponse.json();
      console.error('Error fetching forms:', errorData);
      return new Response(JSON.stringify({ error: 'Failed to fetch forms', details: errorData }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formsData = await formsResponse.json();
    console.log('Forms found:', formsData.data?.length);

    // Parse forms and their fields
    const forms = (formsData.data || []).map((form: any) => {
      const fields = (form.questions || []).map((q: any) => ({
        key: q.key,
        label: q.label || q.key,
        type: q.type,
      }));

      return {
        id: form.id,
        name: form.name,
        status: form.status,
        fields,
      };
    });

    return new Response(JSON.stringify({ forms }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in get-facebook-forms:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

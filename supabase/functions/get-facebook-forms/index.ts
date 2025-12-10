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
    const body = await req.json();
    const { tenant_id, page_id, access_token, page_access_token } = body;

    console.log('Fetching Facebook forms for page:', page_id);

    if (!access_token) {
      return new Response(JSON.stringify({ error: 'Access token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If no page_id provided, first get the pages the user has access to
    if (!page_id) {
      const allPages: Array<{ id: string; name: string; access_token?: string }> = [];
      let nextUrl = `https://graph.facebook.com/v21.0/me/accounts?access_token=${access_token}&fields=id,name,access_token&limit=100`;
      
      // Paginate through all pages
      while (nextUrl) {
        console.log('Fetching pages batch...');
        const pagesResponse: Response = await fetch(nextUrl);
        const pagesData: { data?: Array<{ id: string; name: string; access_token?: string }>; paging?: { next?: string }; error?: unknown } = await pagesResponse.json();
        
        console.log('Facebook API response status:', pagesResponse.status);

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

        // Add pages from this batch
        if (pagesData.data) {
          allPages.push(...pagesData.data);
        }
        
        // Check if there's a next page
        nextUrl = pagesData.paging?.next || '';
        console.log('Pages in batch:', pagesData.data?.length || 0, 'Total so far:', allPages.length, 'Has next:', !!nextUrl);
        
        if (!nextUrl) break;
      }

      console.log('Total pages found:', allPages.length);

      // Return pages with their access tokens
      const pages = allPages.map((page) => ({
        id: page.id,
        name: page.name,
        access_token: page.access_token,
      }));

      return new Response(JSON.stringify({ pages }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use page_access_token if provided, otherwise fallback to access_token
    const tokenToUse = page_access_token || access_token;

    // Fetch lead forms for the specified page using page access token
    console.log('Fetching forms for page:', page_id, 'with token type:', page_access_token ? 'page token' : 'user token');
    
    const formsResponse = await fetch(
      `https://graph.facebook.com/v21.0/${page_id}/leadgen_forms?access_token=${tokenToUse}&fields=id,name,status,questions`
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

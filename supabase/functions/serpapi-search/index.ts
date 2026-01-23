import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SerpApiRequest {
  action: "test" | "search" | "bulk_search";
  projectId?: string;
  keywordIds?: string[];
  keyword?: string;
  domain?: string;
  country?: string;
  language?: string;
  device?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's tenant
    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return new Response(JSON.stringify({ error: "No tenant found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get SerpAPI key from tenant_integrations
    const { data: integration } = await supabase
      .from("tenant_integrations")
      .select("config")
      .eq("tenant_id", tenantUser.tenant_id)
      .eq("integration_type", "serpapi")
      .eq("is_active", true)
      .single();

    const serpApiKey = integration?.config?.api_key;
    if (!serpApiKey) {
      return new Response(JSON.stringify({ error: "SerpAPI not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: SerpApiRequest = await req.json();
    const { action } = body;

    if (action === "test") {
      // Test API connection with a simple search
      const testUrl = `https://serpapi.com/search.json?engine=google&q=test&api_key=${serpApiKey}&num=1`;
      const testResponse = await fetch(testUrl);
      
      if (!testResponse.ok) {
        const errorData = await testResponse.json();
        return new Response(JSON.stringify({ 
          success: false, 
          error: errorData.error || "API key invalid" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const testData = await testResponse.json();
      return new Response(JSON.stringify({ 
        success: true, 
        account_info: testData.search_metadata?.google_url ? true : false,
        searches_remaining: testData.search_metadata?.total_time_taken || "Unknown"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "search" && body.keyword && body.domain) {
      // Single keyword search
      const { keyword, domain, country = "il", language = "he", device = "desktop" } = body;
      
      const searchParams = new URLSearchParams({
        engine: "google",
        q: keyword,
        google_domain: country === "il" ? "google.co.il" : "google.com",
        gl: country,
        hl: language,
        device: device === "mobile" ? "mobile" : "desktop",
        num: "100", // Get top 100 results
        api_key: serpApiKey,
      });

      const searchUrl = `https://serpapi.com/search.json?${searchParams}`;
      const searchResponse = await fetch(searchUrl);
      
      if (!searchResponse.ok) {
        const errorData = await searchResponse.json();
        return new Response(JSON.stringify({ error: errorData.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const searchData = await searchResponse.json();
      const organicResults = searchData.organic_results || [];
      
      // Find domain position
      let position: number | null = null;
      let foundUrl: string | null = null;
      const normalizedDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, "").toLowerCase();
      
      for (let i = 0; i < organicResults.length; i++) {
        const resultDomain = organicResults[i].link
          ?.replace(/^(https?:\/\/)?(www\.)?/, "")
          .toLowerCase()
          .split("/")[0];
        
        if (resultDomain?.includes(normalizedDomain)) {
          position = i + 1;
          foundUrl = organicResults[i].link;
          break;
        }
      }

      // Get SERP features
      const serpFeatures: string[] = [];
      if (searchData.answer_box) serpFeatures.push("answer_box");
      if (searchData.knowledge_graph) serpFeatures.push("knowledge_graph");
      if (searchData.local_results) serpFeatures.push("local_pack");
      if (searchData.shopping_results) serpFeatures.push("shopping");
      if (searchData.related_questions) serpFeatures.push("people_also_ask");
      if (searchData.inline_videos) serpFeatures.push("videos");
      if (searchData.inline_images) serpFeatures.push("images");

      // Get top competitors
      const competitors = organicResults.slice(0, 10).map((result: any, index: number) => ({
        position: index + 1,
        domain: result.link?.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0],
        url: result.link,
        title: result.title,
      }));

      return new Response(JSON.stringify({
        success: true,
        keyword,
        position,
        found_url: foundUrl,
        serp_features: serpFeatures,
        competitors,
        total_results: searchData.search_information?.total_results,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "bulk_search" && body.projectId) {
      // Bulk search for a project
      const { projectId } = body;

      // Get project details
      const { data: project, error: projectError } = await supabase
        .from("rank_tracking_projects")
        .select("*")
        .eq("id", projectId)
        .eq("tenant_id", tenantUser.tenant_id)
        .single();

      if (projectError || !project) {
        return new Response(JSON.stringify({ error: "Project not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get keywords to check
      let keywordQuery = supabase
        .from("rank_tracking_keywords")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true);

      if (body.keywordIds && body.keywordIds.length > 0) {
        keywordQuery = keywordQuery.in("id", body.keywordIds);
      }

      const { data: keywords, error: keywordsError } = await keywordQuery;

      if (keywordsError || !keywords || keywords.length === 0) {
        return new Response(JSON.stringify({ error: "No keywords to check" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results: any[] = [];
      const normalizedDomain = project.domain.replace(/^(https?:\/\/)?(www\.)?/, "").toLowerCase();

      // Process each keyword
      for (const kw of keywords) {
        const searchParams = new URLSearchParams({
          engine: "google",
          q: kw.keyword,
          google_domain: project.country === "il" ? "google.co.il" : "google.com",
          gl: project.country,
          hl: project.language,
          device: project.device === "mobile" ? "mobile" : "desktop",
          num: "100",
          api_key: serpApiKey,
        });

        try {
          const searchUrl = `https://serpapi.com/search.json?${searchParams}`;
          const searchResponse = await fetch(searchUrl);
          
          if (!searchResponse.ok) {
            results.push({ keyword_id: kw.id, error: "Search failed" });
            continue;
          }

          const searchData = await searchResponse.json();
          const organicResults = searchData.organic_results || [];

          // Find position
          let position: number | null = null;
          let foundUrl: string | null = null;

          for (let i = 0; i < organicResults.length; i++) {
            const resultDomain = organicResults[i].link
              ?.replace(/^(https?:\/\/)?(www\.)?/, "")
              .toLowerCase()
              .split("/")[0];

            if (resultDomain?.includes(normalizedDomain)) {
              position = i + 1;
              foundUrl = organicResults[i].link;
              break;
            }
          }

          // Calculate position change
          const previousPosition = kw.current_position;
          const positionChange = previousPosition && position 
            ? previousPosition - position 
            : null;

          // Update keyword
          const updateData: any = {
            previous_position: kw.current_position,
            current_position: position,
            position_change: positionChange,
            found_url: foundUrl,
            last_checked_at: new Date().toISOString(),
          };

          // Update best/worst positions
          if (position) {
            if (!kw.best_position || position < kw.best_position) {
              updateData.best_position = position;
            }
            if (!kw.worst_position || position > kw.worst_position) {
              updateData.worst_position = position;
            }
          }

          await supabase
            .from("rank_tracking_keywords")
            .update(updateData)
            .eq("id", kw.id);

          // Get SERP features
          const serpFeatures: string[] = [];
          if (searchData.answer_box) serpFeatures.push("answer_box");
          if (searchData.knowledge_graph) serpFeatures.push("knowledge_graph");
          if (searchData.local_results) serpFeatures.push("local_pack");
          if (searchData.shopping_results) serpFeatures.push("shopping");

          // Get competitors data
          const competitorsData = organicResults.slice(0, 10).map((result: any, idx: number) => ({
            position: idx + 1,
            domain: result.link?.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0],
            url: result.link,
          }));

          // Insert history record
          await supabase.from("rank_tracking_history").insert({
            keyword_id: kw.id,
            position,
            url_found: foundUrl,
            serp_features: serpFeatures,
            competitors_data: competitorsData,
          });

          results.push({
            keyword_id: kw.id,
            keyword: kw.keyword,
            position,
            previous_position: previousPosition,
            position_change: positionChange,
            found_url: foundUrl,
          });

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          results.push({ keyword_id: kw.id, error: String(err) });
        }
      }

      // Update project last_checked_at
      await supabase
        .from("rank_tracking_projects")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("id", projectId);

      return new Response(JSON.stringify({
        success: true,
        project_id: projectId,
        results,
        checked_count: results.filter(r => !r.error).length,
        error_count: results.filter(r => r.error).length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("SerpAPI search error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchRequest {
  action: "test" | "search" | "bulk_search";
  projectId?: string;
  keywordIds?: string[];
  keyword?: string;
  domain?: string;
  country?: string;
  language?: string;
  device?: string;
}

// Location code mapping for DataForSEO
const locationCodes: Record<string, number> = {
  "il": 2376,  // Israel
  "us": 2840,  // United States
  "uk": 2826,  // United Kingdom
  "de": 2276,  // Germany
  "fr": 2250,  // France
  "es": 2724,  // Spain
  "it": 2380,  // Italy
  "nl": 2528,  // Netherlands
  "au": 2036,  // Australia
  "ca": 2124,  // Canada
};

// Language code mapping
const languageCodes: Record<string, string> = {
  "he": "he",
  "en": "en",
  "de": "de",
  "fr": "fr",
  "es": "es",
  "it": "it",
  "nl": "nl",
};

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

    // Get user's tenant - prioritize user_active_tenant, fallback to tenant_users
    let tenantId: string | null = null;

    const { data: activeTenant } = await supabase
      .from("user_active_tenant")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (activeTenant?.tenant_id) {
      tenantId = activeTenant.tenant_id;
    } else {
      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      
      if (tenantUser?.tenant_id) {
        tenantId = tenantUser.tenant_id;
      }
    }

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "No tenant found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get DataForSEO credentials - check dataforseo first, then fallback to serpapi
    let base64Token: string | null = null;
    let usingSerpApi = false;
    let serpApiKey: string | null = null;

    const { data: dataforSeoIntegration } = await supabase
      .from("tenant_integrations")
      .select("settings")
      .eq("tenant_id", tenantId)
      .eq("integration_type", "dataforseo")
      .eq("is_active", true)
      .single();

    const settings = dataforSeoIntegration?.settings as Record<string, any> | null;

    if (settings?.email && settings?.password) {
      base64Token = btoa(`${settings.email}:${settings.password}`);
    } else {
      // Fallback to SerpAPI
      const { data: serpIntegration } = await supabase
        .from("tenant_integrations")
        .select("api_key")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "serpapi")
        .eq("is_active", true)
        .single();

      if (serpIntegration?.api_key) {
        usingSerpApi = true;
        serpApiKey = serpIntegration.api_key;
      }
    }

    if (!base64Token && !serpApiKey) {
      return new Response(JSON.stringify({ error: "DataForSEO not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: SearchRequest = await req.json();
    const { action } = body;

    if (action === "test") {
      // Test API connection
      if (usingSerpApi && serpApiKey) {
        const testUrl = `https://serpapi.com/search.json?engine=google&q=test&api_key=${serpApiKey}&num=1`;
        const testResponse = await fetch(testUrl);
        
        if (!testResponse.ok) {
          return new Response(JSON.stringify({ success: false, error: "API key invalid" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, provider: "serpapi" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Test DataForSEO
      const testResponse = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
        method: "GET",
        headers: {
          "Authorization": `Basic ${base64Token}`,
          "Content-Type": "application/json",
        },
      });

      if (!testResponse.ok) {
        return new Response(JSON.stringify({ success: false, error: "Invalid credentials" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const testData = await testResponse.json();
      return new Response(JSON.stringify({ 
        success: testData.status_code === 20000, 
        provider: "dataforseo",
        balance: testData.tasks?.[0]?.result?.[0]?.money?.balance,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "search" && body.keyword && body.domain) {
      // Single keyword search
      const { keyword, domain, country = "il", language = "he", device = "desktop" } = body;
      
      if (usingSerpApi && serpApiKey) {
        // Use SerpAPI (legacy)
        return await handleSerpApiSearch(keyword, domain, country, language, device, serpApiKey);
      }

      // Use DataForSEO
      const locationCode = locationCodes[country] || 2376;
      const languageCode = languageCodes[language] || "he";

      const searchResponse = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${base64Token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{
          keyword,
          location_code: locationCode,
          language_code: languageCode,
          device: device === "mobile" ? "mobile" : "desktop",
          depth: 100,
        }]),
      });

      if (!searchResponse.ok) {
        const errorData = await searchResponse.json();
        return new Response(JSON.stringify({ error: errorData.status_message || "Search failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const searchData = await searchResponse.json();
      
      if (searchData.status_code !== 20000) {
        return new Response(JSON.stringify({ error: searchData.status_message || "Search error" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const items = searchData.tasks?.[0]?.result?.[0]?.items || [];
      const organicResults = items.filter((item: any) => item.type === "organic");
      
      // Find domain position
      let position: number | null = null;
      let foundUrl: string | null = null;
      const normalizedDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, "").toLowerCase();
      
      for (const result of organicResults) {
        const resultDomain = result.domain?.toLowerCase() || "";
        if (resultDomain.includes(normalizedDomain)) {
          position = result.rank_group;
          foundUrl = result.url;
          break;
        }
      }

      // Get SERP features
      const serpFeatures: string[] = [];
      for (const item of items) {
        if (item.type === "featured_snippet") serpFeatures.push("featured_snippet");
        if (item.type === "knowledge_graph") serpFeatures.push("knowledge_graph");
        if (item.type === "local_pack") serpFeatures.push("local_pack");
        if (item.type === "shopping") serpFeatures.push("shopping");
        if (item.type === "people_also_ask") serpFeatures.push("people_also_ask");
        if (item.type === "video") serpFeatures.push("videos");
        if (item.type === "images") serpFeatures.push("images");
      }

      // Get top competitors
      const competitors = organicResults.slice(0, 10).map((result: any) => ({
        position: result.rank_group,
        domain: result.domain,
        url: result.url,
        title: result.title,
      }));

      return new Response(JSON.stringify({
        success: true,
        keyword,
        position,
        found_url: foundUrl,
        serp_features: [...new Set(serpFeatures)],
        competitors,
        total_results: searchData.tasks?.[0]?.result?.[0]?.se_results_count,
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
        .eq("tenant_id", tenantId)
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
      const locationCode = locationCodes[project.country] || 2376;
      const languageCode = languageCodes[project.language] || "he";

      // Process each keyword
      for (const kw of keywords) {
        try {
          let position: number | null = null;
          let foundUrl: string | null = null;
          let serpFeatures: string[] = [];
          let competitorsData: any[] = [];

          if (usingSerpApi && serpApiKey) {
            // Use SerpAPI (legacy)
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

            const searchUrl = `https://serpapi.com/search.json?${searchParams}`;
            const searchResponse = await fetch(searchUrl);
            
            if (!searchResponse.ok) {
              results.push({ keyword_id: kw.id, error: "Search failed" });
              continue;
            }

            const searchData = await searchResponse.json();
            const organicResults = searchData.organic_results || [];

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

            if (searchData.answer_box) serpFeatures.push("answer_box");
            if (searchData.knowledge_graph) serpFeatures.push("knowledge_graph");
            if (searchData.local_results) serpFeatures.push("local_pack");
            if (searchData.shopping_results) serpFeatures.push("shopping");

            competitorsData = organicResults.slice(0, 10).map((result: any, idx: number) => ({
              position: idx + 1,
              domain: result.link?.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0],
              url: result.link,
            }));
          } else {
            // Use DataForSEO
            const searchResponse = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
              method: "POST",
              headers: {
                "Authorization": `Basic ${base64Token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify([{
                keyword: kw.keyword,
                location_code: locationCode,
                language_code: languageCode,
                device: project.device === "mobile" ? "mobile" : "desktop",
                depth: 100,
              }]),
            });

            if (!searchResponse.ok) {
              results.push({ keyword_id: kw.id, error: "Search failed" });
              continue;
            }

            const searchData = await searchResponse.json();
            
            if (searchData.status_code !== 20000) {
              results.push({ keyword_id: kw.id, error: searchData.status_message || "API Error" });
              continue;
            }

            const items = searchData.tasks?.[0]?.result?.[0]?.items || [];
            const organicResults = items.filter((item: any) => item.type === "organic");

            // Find position
            for (const result of organicResults) {
              const resultDomain = result.domain?.toLowerCase() || "";
              if (resultDomain.includes(normalizedDomain)) {
                position = result.rank_group;
                foundUrl = result.url;
                break;
              }
            }

            // Get SERP features
            for (const item of items) {
              if (item.type === "featured_snippet") serpFeatures.push("featured_snippet");
              if (item.type === "knowledge_graph") serpFeatures.push("knowledge_graph");
              if (item.type === "local_pack") serpFeatures.push("local_pack");
              if (item.type === "shopping") serpFeatures.push("shopping");
            }
            serpFeatures = [...new Set(serpFeatures)];

            competitorsData = organicResults.slice(0, 10).map((result: any) => ({
              position: result.rank_group,
              domain: result.domain,
              url: result.url,
            }));
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
          await new Promise(resolve => setTimeout(resolve, 300));
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
    console.error("Search error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper function for legacy SerpAPI search
async function handleSerpApiSearch(
  keyword: string, 
  domain: string, 
  country: string, 
  language: string, 
  device: string, 
  apiKey: string
) {
  const searchParams = new URLSearchParams({
    engine: "google",
    q: keyword,
    google_domain: country === "il" ? "google.co.il" : "google.com",
    gl: country,
    hl: language,
    device: device === "mobile" ? "mobile" : "desktop",
    num: "100",
    api_key: apiKey,
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

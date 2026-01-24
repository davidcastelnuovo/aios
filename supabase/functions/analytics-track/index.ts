import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface TrackingPayload {
  tracking_id: string;
  visitor_fingerprint: string;
  session_id?: string;
  event_type: "pageview" | "event" | "session_start" | "session_end" | "heartbeat";
  data: {
    // Pageview data
    page_url?: string;
    page_path?: string;
    page_title?: string;
    scroll_depth?: number;
    time_on_page?: number;
    // Event data
    event_name?: string;
    event_category?: string;
    event_label?: string;
    event_value?: number;
    event_data?: Record<string, unknown>;
    // Session data
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    referrer?: string;
    landing_page?: string;
    device_type?: string;
    browser?: string;
    os?: string;
    screen_resolution?: string;
    // Identify data
    email?: string;
    phone?: string;
    name?: string;
  };
  timestamp: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: TrackingPayload = await req.json();
    const { tracking_id, visitor_fingerprint, event_type, data, timestamp } = payload;

    if (!tracking_id || !visitor_fingerprint) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tracking config
    const { data: config, error: configError } = await supabase
      .from("site_tracking_configs")
      .select("id, tenant_id, is_active, settings")
      .eq("tracking_id", tracking_id)
      .single();

    if (configError || !config || !config.is_active) {
      return new Response(
        JSON.stringify({ error: "Invalid or inactive tracking ID" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tracking_config_id = config.id;
    const tenant_id = config.tenant_id;

    // Get or create visitor
    let { data: visitor } = await supabase
      .from("site_visitors")
      .select("id, visit_count")
      .eq("tracking_config_id", tracking_config_id)
      .eq("visitor_fingerprint", visitor_fingerprint)
      .single();

    if (!visitor) {
      // Create new visitor
      const firstUtm = data.utm_source ? {
        source: data.utm_source,
        medium: data.utm_medium,
        campaign: data.utm_campaign,
        content: data.utm_content,
        term: data.utm_term,
      } : null;

      const { data: newVisitor, error: visitorError } = await supabase
        .from("site_visitors")
        .insert({
          tracking_config_id,
          visitor_fingerprint,
          first_utm: firstUtm,
          tenant_id,
        })
        .select("id, visit_count")
        .single();

      if (visitorError) {
        console.error("Error creating visitor:", visitorError);
        return new Response(
          JSON.stringify({ error: "Failed to create visitor" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      visitor = newVisitor;
    } else {
      // Update last visit
      await supabase
        .from("site_visitors")
        .update({ last_visit: new Date().toISOString() })
        .eq("id", visitor.id);
    }

    let session_id = payload.session_id;
    let current_session = null;

    // Handle session
    if (event_type === "session_start" || !session_id) {
      // Create new session
      const { data: newSession, error: sessionError } = await supabase
        .from("site_sessions")
        .insert({
          visitor_id: visitor.id,
          tracking_config_id,
          utm_source: data.utm_source,
          utm_medium: data.utm_medium,
          utm_campaign: data.utm_campaign,
          utm_content: data.utm_content,
          utm_term: data.utm_term,
          referrer: data.referrer,
          landing_page: data.landing_page || data.page_url,
          device_type: data.device_type,
          browser: data.browser,
          os: data.os,
          screen_resolution: data.screen_resolution,
          tenant_id,
        })
        .select("id")
        .single();

      if (sessionError) {
        console.error("Error creating session:", sessionError);
      } else {
        session_id = newSession.id;
        current_session = newSession;
        
        // Increment visit count
        await supabase
          .from("site_visitors")
          .update({ visit_count: (visitor.visit_count || 0) + 1 })
          .eq("id", visitor.id);

        // Save the initial pageview for session_start
        if (event_type === "session_start" && data.page_url) {
          const { error: pageviewError } = await supabase
            .from("site_pageviews")
            .insert({
              session_id,
              visitor_id: visitor.id,
              tracking_config_id,
              page_url: data.page_url,
              page_path: data.page_path,
              page_title: data.page_title,
              scroll_depth: data.scroll_depth || 0,
              tenant_id,
            });

          if (pageviewError) {
            console.error("Error creating initial pageview:", pageviewError);
          } else {
            // Set initial page count to 1
            await supabase
              .from("site_sessions")
              .update({ page_count: 1 })
              .eq("id", session_id);
          }
        }
      }
    } else {
      // Get existing session
      const { data: existingSession } = await supabase
        .from("site_sessions")
        .select("id")
        .eq("id", session_id)
        .single();
      
      current_session = existingSession;
    }

    // Handle different event types
    if (event_type === "pageview" && session_id && data.page_url) {
      // Update previous pageview's time_on_page
      if (data.time_on_page) {
        await supabase
          .from("site_pageviews")
          .update({ 
            time_on_page: data.time_on_page,
            left_at: new Date().toISOString()
          })
          .eq("session_id", session_id)
          .is("left_at", null)
          .order("viewed_at", { ascending: false })
          .limit(1);
      }

      // Insert new pageview
      const { error: pageviewError } = await supabase
        .from("site_pageviews")
        .insert({
          session_id,
          visitor_id: visitor.id,
          tracking_config_id,
          page_url: data.page_url,
          page_path: data.page_path,
          page_title: data.page_title,
          scroll_depth: data.scroll_depth || 0,
          tenant_id,
        });

      if (pageviewError) {
        console.error("Error creating pageview:", pageviewError);
      }

      // Update session page count
      const { data: currentSession } = await supabase
        .from("site_sessions")
        .select("page_count")
        .eq("id", session_id)
        .single();
      
      if (currentSession) {
        await supabase
          .from("site_sessions")
          .update({ page_count: (currentSession.page_count || 0) + 1 })
          .eq("id", session_id);
      }
    }

    if (event_type === "event" && session_id && data.event_name) {
      // Extract event value for e-commerce events from event_data if not in event_value
      const eventValue = data.event_value || 
        (data.event_data as Record<string, unknown>)?.value || 
        (data.event_data as Record<string, unknown>)?.revenue || 
        null;
      
      const { error: eventError } = await supabase
        .from("site_events")
        .insert({
          session_id,
          visitor_id: visitor.id,
          tracking_config_id,
          event_name: data.event_name,
          event_category: data.event_category,
          event_label: data.event_label,
          event_value: typeof eventValue === 'number' ? eventValue : null,
          event_data: data.event_data,
          page_url: data.page_url,
          tenant_id,
        });

      if (eventError) {
        console.error("Error creating event:", eventError);
      }
    }

    if (event_type === "heartbeat" && session_id) {
      // Update session duration and scroll depth
      const { data: session } = await supabase
        .from("site_sessions")
        .select("started_at")
        .eq("id", session_id)
        .single();

      if (session) {
        const duration = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
        await supabase
          .from("site_sessions")
          .update({ 
            duration_seconds: duration,
            is_bounce: false // If we get a heartbeat, it's not a bounce
          })
          .eq("id", session_id);
      }

      // Update current pageview scroll depth
      if (data.scroll_depth) {
        await supabase
          .from("site_pageviews")
          .update({ scroll_depth: data.scroll_depth })
          .eq("session_id", session_id)
          .is("left_at", null)
          .order("viewed_at", { ascending: false })
          .limit(1);
      }
    }

    if (event_type === "session_end" && session_id) {
      const { data: session } = await supabase
        .from("site_sessions")
        .select("started_at, page_count")
        .eq("id", session_id)
        .single();

      if (session) {
        const duration = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
        await supabase
          .from("site_sessions")
          .update({
            ended_at: new Date().toISOString(),
            duration_seconds: duration,
            exit_page: data.page_url,
            is_bounce: session.page_count <= 1,
          })
          .eq("id", session_id);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        session_id,
        visitor_id: visitor.id 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Analytics track error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

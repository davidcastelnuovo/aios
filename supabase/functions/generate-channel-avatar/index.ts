import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { prompt, channelId, tenantId } = await req.json();
    if (!prompt || !channelId) {
      return new Response(JSON.stringify({ error: "Missing prompt or channelId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate image via OpenAI (gpt-image-1) — returns base64.
    const aiResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: `A square avatar/icon image for a chat channel. Clean, modern, works well as a small icon, on a solid white background. Description: ${prompt}`,
        n: 1,
        size: "1024x1024",
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("OpenAI image error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "יותר מדי בקשות, נסה שוב בעוד דקה" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`OpenAI image error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const base64Data = aiData?.data?.[0]?.b64_json;

    if (!base64Data) {
      throw new Error("No image generated from AI");
    }

    const imageType = "png";

    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to storage
    const filePath = `avatars/${channelId}-${Date.now()}.${imageType}`;
    const { error: uploadError } = await supabase.storage
      .from("team-chat-files")
      .upload(filePath, bytes, {
        contentType: `image/${imageType}`,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw new Error("Failed to upload avatar to storage");
    }

    const { data: urlData } = supabase.storage
      .from("team-chat-files")
      .getPublicUrl(filePath);

    // Update channel avatar_url
    const { error: updateError } = await supabase
      .from("team_channels")
      .update({ avatar_url: urlData.publicUrl })
      .eq("id", channelId);

    if (updateError) {
      console.error("Channel update error:", updateError);
      throw new Error("Failed to update channel avatar");
    }

    return new Response(
      JSON.stringify({ avatar_url: urlData.publicUrl }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("generate-channel-avatar error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

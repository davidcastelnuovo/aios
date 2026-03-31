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
    const { prompt, tenant_id, post_id } = await req.json();

    if (!prompt || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "prompt and tenant_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Generate image using Nano Banana (Gemini Flash Image)
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: `Generate a professional social media post image: ${prompt}. Make it visually appealing, modern, and suitable for social media marketing.`,
            },
          ],
          modalities: ["image", "text"],
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI API error: ${aiResponse.status} - ${errText}`);
    }

    const aiData = await aiResponse.json();
    const base64Image =
      aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!base64Image) {
      throw new Error("No image returned from AI");
    }

    // Decode base64 and upload to Supabase Storage
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), (c) =>
      c.charCodeAt(0)
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const fileName = `${Date.now()}-ai.png`;
    const filePath = `${tenant_id}/social-posts/${post_id || "generated"}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("entity-attachments")
      .upload(filePath, imageBytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload error: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from("entity-attachments")
      .getPublicUrl(filePath);

    return new Response(
      JSON.stringify({ image_url: urlData.publicUrl }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

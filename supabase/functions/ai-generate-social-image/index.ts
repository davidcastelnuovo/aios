import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveOpenAIKey } from "../_shared/ai.ts";

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

    const openaiKey = await resolveOpenAIKey();
    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY not configured — set the Supabase secret or add the key in Settings → Integrations → LLM");
    }

    // Generate image using OpenAI Images (gpt-image-1)
    const aiResponse = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: `Professional social media post image: ${prompt}. Visually appealing, modern, suitable for social media marketing.`,
          n: 1,
          size: "1024x1024",
          output_format: "png",
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI API error: ${aiResponse.status} - ${errText}`);
    }

    const aiData = await aiResponse.json();
    const b64 = aiData?.data?.[0]?.b64_json;
    const base64Image = b64 ? `data:image/png;base64,${b64}` : undefined;

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

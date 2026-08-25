import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveOpenAIKey } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUBLIC_PATH = /\/storage\/v1\/object\/public\/entity-attachments\/([^?]+)/;
const SIGNED_PATH = /\/storage\/v1\/object\/sign\/entity-attachments\/([^?]+)/;

const extractAttachmentPath = (url: string): string | null => {
  const match = url.match(PUBLIC_PATH) ?? url.match(SIGNED_PATH);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const CONCEPT_LEAD = /MUST FOLLOW THIS APPROVED VISUAL CONCEPT/i;

const wrapSocialImagePrompt = (prompt: string) => {
  const trimmed = prompt.trim();
  if (CONCEPT_LEAD.test(trimmed)) return trimmed;
  return `Professional social media post image: ${trimmed}. Visually appealing, modern, suitable for social media marketing.`;
};

const uniqueUrls = (urls: unknown[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    if (typeof url !== "string" || !url.trim() || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }
  return result;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, tenant_id, post_id, reference_image_url, reference_image_urls } = await req.json();

    if (!prompt || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "prompt and tenant_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const openaiKey = await resolveOpenAIKey();
    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY not configured — set the Supabase secret or add the key in Settings → Integrations → LLM");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const refs = uniqueUrls([
      ...(Array.isArray(reference_image_urls) ? reference_image_urls : []),
      reference_image_url,
    ]).slice(0, 2);

    const loadReferenceBytes = async (url: string): Promise<Uint8Array | null> => {
      const path = extractAttachmentPath(url);
      if (path) {
        const { data, error } = await supabase.storage.from("entity-attachments").download(path);
        if (!error && data) return new Uint8Array(await data.arrayBuffer());
      }
      const res = await fetch(url);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    };

    const generateFromPrompt = () =>
      fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: wrapSocialImagePrompt(prompt),
          n: 1,
          size: "1024x1024",
          quality: "medium",
          output_format: "png",
        }),
      });

    const files: File[] = [];
    for (const [index, url] of refs.entries()) {
      const bytes = await loadReferenceBytes(url);
      if (!bytes) continue;
      const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      files.push(new File([copy], `reference-${index + 1}.png`, { type: "image/png" }));
    }

    let usedReference = false;
    let aiResponse: Response;
    if (files.length > 0) {
      const form = new FormData();
      form.append("model", "gpt-image-1");
      form.append(
        "prompt",
        `Continue this exact visual world. Match faces, wardrobe, lighting, lens and color grade from the reference. ${prompt}`,
      );
      form.append("n", "1");
      form.append("size", "1024x1024");
      form.append("quality", "medium");
      form.append("output_format", "png");
      form.append("input_fidelity", "high");
      for (const file of files) form.append("image", file);
      aiResponse = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: form,
      });
      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("image edits failed, falling back to generations", errText);
        aiResponse = await generateFromPrompt();
      } else {
        usedReference = true;
      }
    } else {
      aiResponse = await generateFromPrompt();
    }

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

    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

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
      JSON.stringify({ image_url: urlData.publicUrl, used_reference: usedReference }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

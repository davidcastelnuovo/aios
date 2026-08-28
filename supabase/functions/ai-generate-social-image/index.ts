import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAiUsage, resolveOpenAIKey } from "../_shared/ai.ts";

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
  return trimmed;
};

const parseImageUsage = (usage: unknown, quality: string, size: string) => {
  if (!usage || typeof usage !== "object") return null;
  const row = usage as {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { text_tokens?: number; image_tokens?: number };
  };
  const details = row.input_tokens_details;
  const textTokens = Number(details?.text_tokens ?? (details ? 0 : row.input_tokens) ?? 0);
  const imageInTokens = Number(details?.image_tokens ?? 0);
  const outputTokens = Number(row.output_tokens ?? 0);
  if (textTokens + imageInTokens + outputTokens <= 0) return null;
  const costUsd = +((textTokens * 5 + imageInTokens * 10 + outputTokens * 40) / 1e6).toFixed(6);
  return {
    model: "gpt-image-1",
    quality,
    size,
    textTokens,
    imageInTokens,
    outputTokens,
    totalTokens: textTokens + imageInTokens + outputTokens,
    costUsd,
    source: "api",
  };
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
    const {
      prompt,
      tenant_id,
      post_id,
      reference_image_url,
      reference_image_urls,
      reference_role: requestedRole,
      live_text_layers: requestedLiveText,
      size: requestedSize,
      quality: requestedQuality,
      mask_png_base64: maskPngBase64,
      image_png_base64: imagePngBase64,
    } = await req.json();

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

    const allowedSizes = new Set(["1024x1024", "1024x1536", "1536x1024"]);
    const size = allowedSizes.has(requestedSize) ? requestedSize : "1024x1024";
    const quality = requestedQuality === "high" || requestedQuality === "low" ? requestedQuality : "medium";

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
          size,
          quality,
          output_format: "png",
        }),
      });

    const decodePng = (raw: unknown): Uint8Array | null => {
      if (typeof raw !== "string" || !raw.trim()) return null;
      const b64 = raw.replace(/^data:image\/\w+;base64,/, "").replace(/\s/g, "");
      try {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let index = 0; index < bin.length; index += 1) bytes[index] = bin.charCodeAt(index);
        return bytes;
      } catch {
        return null;
      }
    };

    const maskBytes = decodePng(maskPngBase64);
    const overrideBytes = decodePng(imagePngBase64);

    const files: File[] = [];
    if (overrideBytes) {
      const copy = overrideBytes.buffer.slice(overrideBytes.byteOffset, overrideBytes.byteOffset + overrideBytes.byteLength);
      files.push(new File([copy], "image.png", { type: "image/png" }));
    } else {
      for (const [index, url] of refs.entries()) {
        const bytes = await loadReferenceBytes(url);
        if (!bytes) continue;
        const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        files.push(new File([copy], `reference-${index + 1}.png`, { type: "image/png" }));
      }
    }

    let usedReference = false;
    let aiResponse: Response;
    if (files.length > 0) {
      const form = new FormData();
      form.append("model", "gpt-image-1");
      const liveTextLayers = requestedLiveText === true || (requestedLiveText !== false && requestedRole !== "revision");
      const referenceRole = requestedRole === "technique"
        ? "technique"
        : requestedRole === "talent"
          ? "talent"
          : requestedRole === "revision"
            ? "revision"
            : "continuity";
      const letterRule = liveTextLayers
        ? "Output must contain zero letters, digits, or logos. "
        : "Output a finished advertising still. Paint quoted Hebrew RTL type exactly (unreversed glyphs). Do not garble type. Do not invent extra slogans. ";
      const referencePrefix = maskBytes
        ? "Image 1 is the exact still. The attached MASK (transparent pixels) is the region to DELETE. Reconstruct only that region from the surrounding photograph. Do not add letters, logos, or new objects. Keep every unmasked pixel. "
        : referenceRole === "revision"
        ? (liveTextLayers
          ? "Image 1 is the exact still to revise. Change only the director request. If a second image is talent, keep that face. Output a letter-empty PNG — do not copy baked type. "
          : "Image 1 is the exact ad to revise. Change only what the director requests. Keep the rest of the photograph, talent, lighting, composition, and finished RTL Hebrew type unless asked to change it. If a second image is talent, keep that face. ")
        : referenceRole === "technique"
          ? `Use attached image(s) as TECHNIQUE only (material, paper, ink, light, color family). Do not copy faces, pose, crop, logos, or layout. ${letterRule}`
          : referenceRole === "talent"
            ? `Image 1 is the exact talent/spokesman. Keep this face, glasses, age, hair, and body. Photograph a NEW scene with THIS person. Do not copy the source ad's layout, lettering, logo, or UI chrome. If a second image is attached it is technique only. ${letterRule}`
            : `Continue this exact visual world. Match faces, wardrobe, lighting, lens and color grade from the reference. Do not invent logos. ${letterRule}`;
      form.append(
        "prompt",
        `${referencePrefix}${prompt}`,
      );
      form.append("n", "1");
      form.append("size", size);
      form.append("quality", quality);
      form.append("output_format", "png");
      form.append("input_fidelity", "high");
      for (const file of files) form.append("image", file);
      if (maskBytes) {
        const maskCopy = maskBytes.buffer.slice(maskBytes.byteOffset, maskBytes.byteOffset + maskBytes.byteLength);
        form.append("mask", new File([maskCopy], "mask.png", { type: "image/png" }));
      }
      aiResponse = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: form,
      });
      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        if (maskBytes) {
          throw new Error(`AI inpaint error: ${aiResponse.status} - ${errText}`);
        }
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
    const usage = parseImageUsage(aiData?.usage, quality, size);
    if (usage) {
      logAiUsage({
        source: "ai-generate-social-image",
        model: "gpt-image-1",
        tenant_id,
        tokens_in: usage.textTokens + usage.imageInTokens,
        tokens_out: usage.outputTokens,
        cost_usd: usage.costUsd,
        meta: { size, quality, used_reference: usedReference, post_id },
      });
    }
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
      JSON.stringify({ image_url: urlData.publicUrl, used_reference: usedReference, usage }),
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

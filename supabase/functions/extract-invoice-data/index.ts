import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOOL = {
  type: "function",
  function: {
    name: "extract_invoice",
    description: "Extract invoice fields from the document image/PDF.",
    parameters: {
      type: "object",
      properties: {
        vendor_name: { type: "string", description: "Supplier / business name issuing the invoice" },
        invoice_number: { type: "string" },
        invoice_date: { type: "string", description: "ISO date YYYY-MM-DD" },
        total_amount: { type: "number", description: "Total amount including VAT" },
        vat_amount: { type: "number", description: "VAT amount only" },
        currency: { type: "string", description: "ILS, USD, EUR..." },
        description: { type: "string", description: "Short description of what was purchased" },
        suggested_category: { type: "string", description: "Hebrew expense category" },
      },
      required: ["vendor_name", "total_amount"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error("invoice_id required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: row, error: rowErr } = await admin
      .from("invoice_uploads")
      .select("id, file_path, mime_type, tenant_id")
      .eq("id", invoice_id)
      .single();
    if (rowErr || !row) throw new Error("invoice not found");

    // Download file
    const { data: file, error: dlErr } = await admin.storage
      .from("invoices")
      .download(row.file_path);
    if (dlErr || !file) throw new Error("download failed: " + dlErr?.message);

    const buf = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    const b64 = btoa(binary);
    const mime = row.mime_type || file.type || "image/jpeg";
    const dataUrl = `data:${mime};base64,${b64}`;

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: "system",
            content:
              "You extract structured data from Israeli/Hebrew invoices and receipts. Always call the tool extract_invoice with the data you find. Use ILS as default currency unless otherwise specified.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the invoice fields from this document." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "extract_invoice" } },
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI error", aiResp.status, text);
      await admin
        .from("invoice_uploads")
        .update({ status: "failed", error_message: `AI ${aiResp.status}` })
        .eq("id", invoice_id);
      const status = aiResp.status === 429 || aiResp.status === 402 ? aiResp.status : 500;
      return new Response(JSON.stringify({ error: text }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const call = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let extracted: any = {};
    if (call?.function?.arguments) {
      try { extracted = JSON.parse(call.function.arguments); } catch { extracted = {}; }
    }

    const update: any = {
      status: "processed",
      raw_extraction: extracted,
      vendor_name: extracted.vendor_name ?? null,
      invoice_number: extracted.invoice_number ?? null,
      invoice_date: extracted.invoice_date ?? null,
      total_amount: extracted.total_amount ?? null,
      vat_amount: extracted.vat_amount ?? null,
      currency: extracted.currency ?? "ILS",
      description: extracted.description ?? extracted.suggested_category ?? null,
      error_message: null,
    };

    // Try to auto-link a supplier by fuzzy name match
    if (extracted.vendor_name) {
      const { data: matchedSupplier } = await admin
        .from("suppliers")
        .select("id, name")
        .eq("tenant_id", row.tenant_id);
      if (matchedSupplier?.length) {
        const lower = extracted.vendor_name.toLowerCase();
        const hit = matchedSupplier.find(
          (s: any) =>
            s.name && (s.name.toLowerCase().includes(lower) || lower.includes(s.name.toLowerCase()))
        );
        if (hit) update.supplier_id = hit.id;
      }
    }

    const { error: updErr } = await admin
      .from("invoice_uploads")
      .update(update)
      .eq("id", invoice_id);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ success: true, extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
